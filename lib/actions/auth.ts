"use server";

import { z } from "zod";
import { newId, nextSequence, one, query, tx } from "@/lib/db";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  hashToken,
  randomToken,
  verifyPassword,
  clientMeta,
} from "@/lib/auth";
import { isStaffRole } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { attributeReferral } from "@/lib/services/referrals";
import { fail, formBool, formString, friendlyDbError, safeNextPath } from "./helpers";
import { redirect } from "next/navigation";

const registerSchema = z.object({
  fullName: z.string().min(3, "Enter your full name.").max(120),
  email: z.string().email("Enter a valid email address.").max(200),
  mobile: z
    .string()
    .min(8, "Enter a valid mobile number.")
    .max(24)
    .regex(/^\+?[0-9][0-9\s\-()]{6,22}$/, "Enter a valid mobile number."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(128)
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
});

export async function registerAction(formData: FormData) {
  const settings = await getSettings();
  if (!settings.registration_open) fail("/register", "Registration is currently closed.");
  if (settings.maintenance_mode) fail("/register", "The platform is in maintenance mode. Please try again later.");

  const meta = await clientMeta();
  const limited = rateLimit(`register:${meta.ip}`, 10, 60 * 60 * 1000);
  if (!limited.ok) fail("/register", "Too many registration attempts. Please try again later.");

  const parsed = registerSchema.safeParse({
    fullName: formString(formData, "fullName", 120),
    email: formString(formData, "email", 200).toLowerCase(),
    mobile: formString(formData, "mobile", 24),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) fail("/register", parsed.error.issues[0]?.message ?? "Please check your details.");

  const confirm = String(formData.get("confirmPassword") ?? "");
  if (parsed.data.password !== confirm) fail("/register", "Passwords do not match.");
  if (!formString(formData, "terms")) fail("/register", "You must accept the terms to register.");
  const referralCode = formString(formData, "referralCode", 40).toUpperCase();

  const existing = await one<{ id: string }>(
    "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
    [parsed.data.email],
  );
  if (existing) fail("/register", "An account with this email already exists.");

  let userId = "";
  try {
    const passwordHash = await hashPassword(parsed.data.password);
    const year = new Date().getFullYear();
    userId = await tx(async (client) => {
      const memberSeq = await nextSequence("member_id_seq");
      const referralSeq = await nextSequence("referral_code_seq");
      const memberId = `UB-${year}-${String(memberSeq).padStart(6, "0")}`;
      const ownReferralCode = `UBREF${String(referralSeq).padStart(6, "0")}`;
      const id = newId("usr");
      const plan = await client.query<{ id: string }>(
        "SELECT id FROM membership_plans WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1",
      );
      await client.query(
        `INSERT INTO users (id, member_id, full_name, email, mobile, password_hash, role,
           account_status, referral_code)
         VALUES ($1,$2,$3,$4,$5,$6,'MEMBER','PENDING_ACTIVATION',$7)`,
        [id, memberId, parsed.data.fullName, parsed.data.email, parsed.data.mobile, passwordHash, ownReferralCode],
      );
      if (plan.rows[0]) {
        await client.query(
          `INSERT INTO memberships (id, user_id, plan_id, status) VALUES ($1,$2,$3,'PENDING')`,
          [newId("mem"), id, plan.rows[0].id],
        );
      }
      await client.query(`INSERT INTO wallets (id, user_id) VALUES ($1,$2)`, [newId("wal"), id]);
      if (referralCode) {
        await attributeReferral(client, {
          newUserId: id,
          code: referralCode,
          email: parsed.data.email,
          mobile: parsed.data.mobile,
        });
      }
      await notify(
        {
          userId: id,
          type: "WELCOME",
          title: "Welcome to the platform",
          body: "Your account is ready. Complete your DEMO membership activation to unlock campaigns and rewards.",
          link: "/dashboard/membership",
        },
        client,
      );
      return id;
    });
  } catch (err) {
    fail("/register", friendlyDbError(err));
  }

  await audit({
    actorLabel: parsed.data.email,
    action: "auth.registered",
    targetType: "user",
    targetId: userId,
    metadata: { referralCode: referralCode || null },
    ip: meta.ip,
  });
  await createSession(userId);
  redirect("/dashboard?toast=Welcome! Your account has been created.");
}

export async function loginAction(formData: FormData) {
  const email = formString(formData, "email", 200).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(formData.get("next"));
  const meta = await clientMeta();

  const limited = rateLimit(`login:${meta.ip}:${email}`, 8, 15 * 60 * 1000);
  if (!limited.ok) fail("/login", `Too many sign-in attempts. Try again in ${limited.retryAfter} seconds.`);

  const user = await one<{
    id: string;
    email: string;
    password_hash: string;
    role: string;
    account_status: string;
    failed_login_attempts: number;
    locked_until: Date | null;
  }>(
    `SELECT id, email, password_hash, role, account_status, failed_login_attempts, locked_until
       FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );

  if (!user) {
    await audit({ actorLabel: email, action: "auth.login_failed", targetType: "user", metadata: { reason: "unknown_email" }, ip: meta.ip });
    fail("/login", "Incorrect email or password.");
  }
  if (user.locked_until && user.locked_until > new Date()) {
    fail("/login", "This account is temporarily locked after repeated failed attempts. Try again later.");
  }
  if (user.account_status === "BLOCKED" || user.account_status === "DEACTIVATED") {
    fail("/login", "This account is not permitted to sign in. Please contact support.");
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    const attempts = user.failed_login_attempts + 1;
    const lock = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await query(`UPDATE users SET failed_login_attempts = $2, locked_until = $3 WHERE id = $1`, [
      user.id,
      attempts,
      lock,
    ]);
    await audit({ actorLabel: email, action: "auth.login_failed", targetType: "user", targetId: user.id, metadata: { attempts }, ip: meta.ip });
    fail("/login", attempts >= 5 ? "Too many failed attempts. This account is locked for 15 minutes." : "Incorrect email or password.");
  }

  await query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]);
  resetRateLimit(`login:${meta.ip}:${email}`);
  const remember = formBool(formData, "remember");
  await createSession(user.id, remember ? 14 : 1);
  await audit({ actorLabel: email, action: "auth.login", targetType: "user", targetId: user.id, ip: meta.ip });

  if (isStaffRole(user.role)) redirect("/admin/dashboard?toast=Signed in to the admin portal.");
  redirect(next ?? "/dashboard?toast=Welcome back.");
}

export async function adminLoginAction(formData: FormData) {
  const email = formString(formData, "email", 200).toLowerCase();
  const password = String(formData.get("password") ?? "");
  const meta = await clientMeta();
  const limited = rateLimit(`admin-login:${meta.ip}`, 6, 15 * 60 * 1000);
  if (!limited.ok) fail("/admin/login", `Too many attempts. Try again in ${limited.retryAfter} seconds.`);

  const user = await one<{ id: string; password_hash: string; role: string; account_status: string }>(
    `SELECT id, password_hash, role, account_status FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  if (!user || !(await verifyPassword(password, user.password_hash)) || !isStaffRole(user.role)) {
    await audit({ actorLabel: email, action: "admin.login_failed", targetType: "admin", ip: meta.ip });
    fail("/admin/login", "Invalid administrator credentials.");
  }
  if (user.account_status !== "ACTIVE") fail("/admin/login", "This administrator account is not active.");

  await query(`UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`, [user.id]);
  await createSession(user.id);
  await audit({ actorLabel: email, action: "admin.login", targetType: "admin", targetId: user.id, ip: meta.ip });
  redirect("/admin/dashboard?toast=Administrator session started.");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  if (user) await audit({ actor: user, action: "auth.logout", targetType: "user", targetId: user.id });
  await destroySession();
  redirect("/login?toast=You have been signed out.");
}

export async function adminLogoutAction() {
  const user = await getCurrentUser();
  if (user) await audit({ actor: user, action: "admin.logout", targetType: "admin", targetId: user.id });
  await destroySession();
  redirect("/admin/login?toast=Administrator session ended.");
}

export async function forgotPasswordAction(formData: FormData) {
  const email = formString(formData, "email", 200).toLowerCase();
  if (!email) fail("/forgot-password", "Enter your email address.");
  const meta = await clientMeta();
  const limited = rateLimit(`forgot:${meta.ip}`, 5, 30 * 60 * 1000);
  if (!limited.ok) fail("/forgot-password", "Too many reset requests. Please try again later.");

  const user = await one<{ id: string; account_status: string }>(
    `SELECT id, account_status FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email],
  );
  if (!user || user.account_status === "BLOCKED" || user.account_status === "DEACTIVATED") {
    redirect("/forgot-password?sent=1");
  }

  const token = randomToken(32);
  await query(
    `INSERT INTO password_reset_tokens (id, token_hash, user_id, expires_at)
     VALUES ($1,$2,$3, now() + interval '45 minutes')`,
    [newId("rst"), hashToken(token), user.id],
  );
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${base}/reset-password?token=${token}`;
  console.log(`[demo] Password reset link for ${email}: ${link}`);
  await audit({ actorLabel: email, action: "auth.password_reset_requested", targetType: "user", targetId: user.id, ip: meta.ip });

  const showDebug = process.env.AUTH_DEBUG_LOG_RESET_LINKS === "true";
  redirect(`/forgot-password?sent=1${showDebug ? `&devLink=${encodeURIComponent(`/reset-password?token=${token}`)}` : ""}`);
}

export async function resetPasswordAction(formData: FormData) {
  const token = formString(formData, "token", 200);
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    fail(`/reset-password?token=${encodeURIComponent(token)}`, "Password must be 8+ characters with upper case, lower case and a number.");
  }
  if (password !== confirm) fail(`/reset-password?token=${encodeURIComponent(token)}`, "Passwords do not match.");

  const row = await one<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
    `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = $1`,
    [hashToken(token)],
  );
  if (!row || row.used_at || row.expires_at < new Date()) {
    fail("/reset-password", "This password reset link is invalid or has expired.");
  }

  await tx(async (client) => {
    await client.query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
      row.user_id,
      await hashPassword(password),
    ]);
    await client.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [row.id]);
    await client.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [row.user_id]);
  });
  await audit({ actorLabel: "password-reset", action: "auth.password_reset_completed", targetType: "user", targetId: row.user_id });
  redirect("/login?toast=Password updated. Please sign in.");
}
