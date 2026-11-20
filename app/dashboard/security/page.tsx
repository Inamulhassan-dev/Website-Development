import type { Metadata } from "next";
import { CheckCircle2, KeyRound, Laptop, Lock, ShieldCheck, Smartphone } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { changePasswordAction } from "@/lib/actions/member";
import { Badge, Card, CardBody, CardHeader, Field, Input, PageHeader, Table, TableWrap, Td, Th, Tr } from "@/components/ui/primitives";
import { PasswordInput, SubmitButton } from "@/components/ui/interactive";
import { formatDate, relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Security" };
export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const user = await requireMember("/dashboard/security");
  const sessions = await query<{ id: string; ip: string | null; user_agent: string | null; created_at: Date; expires_at: Date; revoked_at: Date | null }>(
    `SELECT id, ip, user_agent, created_at, expires_at, revoked_at FROM sessions
      WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
    [user.id],
  );
  const activeSessions = sessions.filter((session) => !session.revoked_at && new Date(session.expires_at) > new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Security"
        description="Manage your password and review where your account is signed in."
        actions={<Badge tone="success"><CheckCircle2 className="h-3.5 w-3.5" /> Account protected</Badge>}
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="Change password" description="Other sessions are signed out when you change your password." />
          <CardBody>
            <form action={changePasswordAction} className="space-y-4">
              <Field label="Current password" htmlFor="currentPassword">
                <PasswordInput name="currentPassword" id="currentPassword" placeholder="Current password" autoComplete="current-password" required />
              </Field>
              <Field label="New password" htmlFor="newPassword" hint="At least 8 characters with upper case, lower case and a number.">
                <PasswordInput name="newPassword" id="newPassword" placeholder="New password" autoComplete="new-password" minLength={8} required />
              </Field>
              <Field label="Confirm new password" htmlFor="confirmPassword">
                <PasswordInput name="confirmPassword" id="confirmPassword" placeholder="Repeat new password" autoComplete="new-password" minLength={8} required />
              </Field>
              <SubmitButton className="w-full" pendingLabel="Updating password…">
                <KeyRound className="h-4 w-4" /> Update password
              </SubmitButton>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Password guidance" actions={<Lock className="h-4 w-4 text-muted" />} />
            <CardBody>
              <ul className="space-y-2.5 text-[12px] leading-relaxed text-muted">
                {[
                  "Use a unique password that you do not use anywhere else.",
                  "Never share your password with support or another member.",
                  "Changing your password signs out every other session.",
                  "Repeated failed sign-ins temporarily lock the account for 15 minutes.",
                ].map((tip) => (
                  <li key={tip} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {tip}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Active sessions" description={`${activeSessions.length} active session${activeSessions.length === 1 ? "" : "s"}.`} />
            <CardBody className="space-y-2">
              {activeSessions.length === 0 ? (
                <p className="text-[12.5px] text-muted">No active sessions found.</p>
              ) : (
                activeSessions.map((session) => {
                  const agent = session.user_agent ?? "Unknown device";
                  const mobile = /mobile|android|iphone/i.test(agent);
                  return (
                    <div key={session.id} className="flex items-start gap-2.5 rounded-xl border border-line px-3 py-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface text-muted">
                        {mobile ? <Smartphone className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-medium text-ink">{agent.slice(0, 70)}</p>
                        <p className="text-[10.5px] text-muted">
                          {session.ip ?? "Unknown IP"} · started {relativeTime(session.created_at)} · expires {formatDate(session.expires_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Recent sign-in sessions" description="The 10 most recent sessions on your account." actions={<ShieldCheck className="h-4 w-4 text-muted" />} />
        <TableWrap>
          <Table>
            <thead>
              <tr>
                <Th>Device / agent</Th>
                <Th>IP address</Th>
                <Th>Started</Th>
                <Th>Expires</Th>
                <Th>State</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => {
                const revoked = !!session.revoked_at;
                const expired = new Date(session.expires_at) <= new Date();
                return (
                  <Tr key={session.id}>
                    <Td className="max-w-[320px]">
                      <span className="line-clamp-1 text-[12px]">{session.user_agent ?? "Unknown device"}</span>
                    </Td>
                    <Td className="text-muted">{session.ip ?? "—"}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(session.created_at, true)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(session.expires_at, true)}</Td>
                    <Td>
                      <Badge tone={revoked || expired ? "neutral" : "success"}>{revoked ? "Revoked" : expired ? "Expired" : "Active"}</Badge>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <div className="rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
        <span className="font-semibold text-navy">Demo note.</span> Sessions are stored in the database with hashed tokens;
        the cookie is httpOnly and SameSite=Lax. In production over HTTPS it is also marked Secure. The in-memory rate
        limiter is suitable for a single instance demonstration only.
      </div>
    </div>
  );
}
