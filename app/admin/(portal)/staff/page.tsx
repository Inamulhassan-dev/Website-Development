import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound, ShieldCheck, UserCog, UserPlus, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { createStaffAction, setStaffStatusAction, updateStaffRoleAction } from "@/lib/actions/admin";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { PasswordInput, SubmitButton } from "@/components/ui/interactive";
import { formatDate, relativeTime } from "@/lib/format";
import { ACCOUNT_STATUS_LABELS, ROLE_LABELS, ROLES, STATUS_TONE, statusLabel, permissionsForRole } from "@/lib/constants";

export const metadata: Metadata = { title: "Staff accounts" };
export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const admin = await requireAdminPage("staff.manage");
  const [staff, counts] = await Promise.all([
    query<{
      id: string; member_id: string; full_name: string; email: string; mobile: string; role: string;
      account_status: string; last_login_at: Date | null; created_at: Date; assigned_tickets: number;
    }>(
      `SELECT u.id, u.member_id, u.full_name, u.email, u.mobile, u.role, u.account_status, u.last_login_at, u.created_at,
              (SELECT count(*)::int FROM support_tickets t WHERE t.assigned_to = u.id AND t.status NOT IN ('RESOLVED','CLOSED')) AS assigned_tickets
         FROM users u WHERE u.role <> 'MEMBER'
        ORDER BY CASE u.role WHEN 'SUPER_ADMIN' THEN 0 WHEN 'FINANCE_ADMIN' THEN 1 WHEN 'SUPPORT_ADMIN' THEN 2 ELSE 3 END, u.full_name`,
    ),
    one<{ total: number; active: number; suspended: number; supers: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE account_status = 'ACTIVE')::int AS active,
              count(*) FILTER (WHERE account_status IN ('SUSPENDED','BLOCKED'))::int AS suspended,
              count(*) FILTER (WHERE role = 'SUPER_ADMIN' AND account_status = 'ACTIVE')::int AS supers
         FROM users WHERE role <> 'MEMBER'`,
    ),
  ]);

  const c = counts ?? { total: 0, active: 0, suspended: 0, supers: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Staff accounts"
        description="Create and manage role-based staff access. Every staff action is attributed and audited."
        actions={<Badge tone="brand"><ShieldCheck className="h-3.5 w-3.5" /> Super Admin only</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Staff accounts" value={c.total} icon={<UserCog className="h-5 w-5" />} />
        <StatCard label="Active" value={c.active} icon={<Users className="h-5 w-5" />} tone="success" />
        <StatCard label="Suspended / blocked" value={c.suspended} icon={<ShieldCheck className="h-5 w-5" />} tone={c.suspended ? "danger" : "neutral"} />
        <StatCard label="Active Super Admins" value={c.supers} hint="At least one must remain" icon={<KeyRound className="h-5 w-5" />} tone="warning" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.5fr]">
        <Card className="h-fit">
          <CardHeader title="Create a staff account" description="Use a strong temporary password and share it securely." actions={<UserPlus className="h-4 w-4 text-muted" />} />
          <CardBody>
            <form action={createStaffAction} className="space-y-4">
              <Field label="Full name" htmlFor="fullName">
                <Input id="fullName" name="fullName" required minLength={3} maxLength={120} placeholder="Alex Morgan" />
              </Field>
              <Field label="Work email" htmlFor="email">
                <Input id="email" name="email" type="email" required maxLength={200} placeholder="alex@umarbaig.demo" />
              </Field>
              <Field label="Mobile" htmlFor="mobile" hint="Optional in this demonstration.">
                <Input id="mobile" name="mobile" maxLength={24} placeholder="+1 555 0100" />
              </Field>
              <Field label="Role" htmlFor="role">
                <Select id="role" name="role" defaultValue="SUPPORT_ADMIN" required>
                  {ROLES.map((role) => (
                    <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Temporary password" htmlFor="password" hint="10+ characters with upper case, lower case and a number.">
                <PasswordInput id="password" name="password" required minLength={10} autoComplete="new-password" placeholder="Temporary password" />
              </Field>
              <SubmitButton className="w-full" pendingLabel="Creating account…" confirm="Create this staff account with portal access?">
                <UserPlus className="h-4 w-4" /> Create staff account
              </SubmitButton>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Staff directory" description="Role changes take effect immediately and revoke nothing automatically." />
          {staff.length === 0 ? (
            <EmptyState icon={<UserCog className="h-5 w-5" />} title="No staff accounts" />
          ) : (
            <TableWrap>
              <Table className="min-w-[980px]">
                <thead>
                  <tr><Th>Staff member</Th><Th>Role</Th><Th>Status</Th><Th className="text-right">Open tickets</Th><Th>Last login</Th><Th>Created</Th><Th>Actions</Th></tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <Tr key={member.id}>
                      <Td>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={member.full_name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-navy">
                              {member.full_name}
                              {member.id === admin.id ? <span className="ml-1.5 text-[10px] font-semibold text-brand">(you)</span> : null}
                            </p>
                            <p className="truncate text-[10.5px] text-muted">{member.email} · {member.member_id}</p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        {member.id === admin.id ? (
                          <Badge tone="brand">{ROLE_LABELS[member.role as keyof typeof ROLE_LABELS] ?? statusLabel(member.role)}</Badge>
                        ) : (
                          <form action={updateStaffRoleAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="userId" value={member.id} />
                            <Select name="role" defaultValue={member.role} className="h-8 w-[142px] text-[11.5px]" aria-label={`Role for ${member.full_name}`}>
                              {ROLES.map((role) => (
                                <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                              ))}
                            </Select>
                            <SubmitButton size="sm" variant="secondary" pendingLabel="…">Set</SubmitButton>
                          </form>
                        )}
                      </Td>
                      <Td><Badge tone={STATUS_TONE[member.account_status] ?? "neutral"}>{ACCOUNT_STATUS_LABELS[member.account_status as keyof typeof ACCOUNT_STATUS_LABELS] ?? statusLabel(member.account_status)}</Badge></Td>
                      <Td className="text-right text-muted">{member.assigned_tickets}</Td>
                      <Td className="whitespace-nowrap text-muted">{member.last_login_at ? relativeTime(member.last_login_at) : "Never"}</Td>
                      <Td className="whitespace-nowrap text-muted">{formatDate(member.created_at)}</Td>
                      <Td>
                        {member.id === admin.id ? (
                          <span className="text-[10.5px] text-muted">Cannot modify self</span>
                        ) : (
                          <form action={setStaffStatusAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="userId" value={member.id} />
                            <Select name="status" defaultValue={member.account_status === "PENDING_ACTIVATION" ? "ACTIVE" : member.account_status} className="h-8 w-[108px] text-[11.5px]" aria-label={`Status for ${member.full_name}`}>
                              <option value="ACTIVE">Active</option>
                              <option value="SUSPENDED">Suspended</option>
                              <option value="BLOCKED">Blocked</option>
                            </Select>
                            <SubmitButton size="sm" variant="secondary" pendingLabel="…">Set</SubmitButton>
                          </form>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((role) => (
          <Card key={role} className="p-4">
            <p className="text-[12.5px] font-semibold text-navy">{ROLE_LABELS[role]}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              {role === "SUPER_ADMIN"
                ? "Full platform access, staff management and settings."
                : role === "FINANCE_ADMIN"
                  ? "Wallet ledger, transactions, withdrawals and reports."
                  : role === "SUPPORT_ADMIN"
                    ? "Member support, notifications and membership visibility."
                    : "Advertising review, sessions and moderation."}
            </p>
            <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand">
              {permissionsForRole(role).length} permissions
            </p>
            <Link href="/admin/roles" className="mt-2 inline-block text-[11px] font-semibold text-muted hover:text-brand">
              View matrix
            </Link>
          </Card>
        ))}
      </div>

      <div className="rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
        <span className="font-semibold text-navy">Security notes.</span> Staff passwords are hashed with bcrypt and sessions are
        database-backed and revocable. Suspending or blocking a staff account revokes their live sessions immediately. At least
        one active Super Admin must always remain.
      </div>
    </div>
  );
}
