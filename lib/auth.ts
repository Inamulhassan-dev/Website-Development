import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import bcrypt from "bcryptjs";
import { one, query } from "./db";
import { isStaffRole, roleHasPermission, type Permission, type UserRole } from "./constants";

export const SESSION_COOKIE = "ub_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS ?? 14);

export type SessionUser = {
  id: string;
  memberId: string;
  fullName: string;
  email: string;
  role: UserRole;
  accountStatus: string;
  membershipStatus: string;
  referralCode: string;
  lastLoginAt: string | null;
  createdAt: string;
};

type UserRow = {
  id: string;
  member_id: string;
  full_name: string;
  email: string;
  role: UserRole;
  account_status: string;
  referral_code: string;
  membership_status: string | null;
  last_login_at: Date | null;
  created_at: Date;
};

function mapUser(row: UserRow): SessionUser {
  return {
    id: row.id,
    memberId: row.member_id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    accountStatus: row.account_status,
    membershipStatus: row.membership_status ?? "PENDING",
    referralCode: row.referral_code,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export async function clientMeta() {
  const h = await headers();
  return {
    ip:
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      "127.0.0.1",
    userAgent: h.get("user-agent")?.slice(0, 300) ?? "unknown",
  };
}

/** Create a database-backed session and set the httpOnly cookie. */
export async function createSession(userId: string, ttlDays = SESSION_TTL_DAYS) {
  const token = randomToken(32);
  const meta = await clientMeta();
  const days = Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : SESSION_TTL_DAYS;
  const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO sessions (id, token_hash, user_id, ip, user_agent, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [`ses_${randomBytes(10).toString("hex")}`, hashToken(token), userId, meta.ip, meta.userAgent, expires],
  );
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  await query("UPDATE users SET last_login_at = now() WHERE id = $1", [userId]);
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query("UPDATE sessions SET revoked_at = now() WHERE token_hash = $1", [hashToken(token)]);
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Resolve the signed-in user. Blocked/deactivated accounts are treated as
 * signed out so they cannot keep using a live session.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await one<UserRow>(
    `SELECT u.id, u.member_id, u.full_name, u.email, u.role, u.account_status,
            u.referral_code, u.last_login_at, u.created_at, m.status AS membership_status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       LEFT JOIN memberships m ON m.user_id = u.id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.account_status NOT IN ('BLOCKED','DEACTIVATED')
      LIMIT 1`,
    [hashToken(token)],
  );
  return row ? mapUser(row) : null;
});

export async function requireUser(nextPath = "/dashboard"): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function requireMember(nextPath = "/dashboard"): Promise<SessionUser> {
  const user = await requireUser(nextPath);
  if (isStaffRole(user.role)) redirect("/admin/dashboard");
  return user;
}

/** Admin page guard. Redirects unauthenticated users and blocks missing permissions. */
export async function requireAdminPage(permission?: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) redirect("/admin/login");
  if (permission && !roleHasPermission(user.role, permission)) redirect("/admin/dashboard?denied=1");
  return user;
}

/** API guard: returns the user, or null so the route can answer with JSON 401/403. */
export async function getAdminApi(permission?: Permission): Promise<
  { user: SessionUser } | { error: "unauthenticated" | "forbidden" }
> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) return { error: "unauthenticated" };
  if (permission && !roleHasPermission(user.role, permission)) return { error: "forbidden" };
  return { user };
}

export function can(user: SessionUser | null, permission: Permission) {
  return !!user && roleHasPermission(user.role, permission);
}

/** Basic same-origin check for API routes that mutate data. */
export async function assertSameOrigin(req: Request) {
  const h = await headers();
  const origin = req.headers.get("origin");
  const host = h.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
