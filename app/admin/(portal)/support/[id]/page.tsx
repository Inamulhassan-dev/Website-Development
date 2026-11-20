import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Clock3,
  LifeBuoy,
  Lock,
  MessageSquare,
  Send,
  ShieldCheck,
  UserCog,
  Wallet,
} from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { adminReplyTicketAction, assignTicketAction, assignTicketPriorityAction } from "@/lib/actions/admin";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  InfoRow,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney, relativeTime } from "@/lib/format";
import { ACCOUNT_STATUS_LABELS, STATUS_TONE, TXN_TYPE_LABELS, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Support ticket" };
export const dynamic = "force-dynamic";

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("support.view");
  const { id } = await params;

  const ticket = await one<{
    id: string;
    reference: string;
    category: string;
    subject: string;
    status: string;
    priority: string;
    created_at: Date;
    updated_at: Date;
    closed_at: Date | null;
    assigned_to: string | null;
    user_id: string;
    member_name: string;
    member_id: string;
    email: string;
    mobile: string;
    account_status: string;
    membership_status: string | null;
    available_cents: number | null;
    completed_sessions: number;
    referrals: number;
    assignee_name: string | null;
  }>(
    `SELECT t.id, t.reference, t.category, t.subject, t.status, t.priority, t.created_at, t.updated_at,
            t.closed_at, t.assigned_to, t.user_id,
            u.full_name AS member_name, u.member_id, u.email, u.mobile, u.account_status,
            m.status AS membership_status, COALESCE(w.available_cents,0)::int AS available_cents,
            (SELECT count(*)::int FROM ad_sessions s WHERE s.user_id = u.id AND s.status = 'COMPLETED') AS completed_sessions,
            (SELECT count(*)::int FROM referrals r WHERE r.referrer_id = u.id) AS referrals,
            staff.full_name AS assignee_name
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN memberships m ON m.user_id = u.id
       LEFT JOIN wallets w ON w.user_id = u.id
       LEFT JOIN users staff ON staff.id = t.assigned_to
      WHERE t.id = $1`,
    [id],
  );
  if (!ticket) notFound();

  const [messages, staff, recentSessions, recentTxns, settings] = await Promise.all([
    query<{ id: string; body: string; is_internal: boolean; created_at: Date; author_name: string; author_role: string; author_id: string }>(
      `SELECT m.id, m.body, m.is_internal, m.created_at, u.full_name AS author_name, u.role AS author_role, u.id AS author_id
         FROM support_messages m JOIN users u ON u.id = m.author_id
        WHERE m.ticket_id = $1 ORDER BY m.created_at ASC`,
      [ticket.id],
    ),
    query<{ id: string; full_name: string; role: string }>(
      `SELECT id, full_name, role FROM users WHERE role <> 'MEMBER' AND account_status = 'ACTIVE' ORDER BY full_name ASC`,
    ),
    query<{ id: string; status: string; watched_seconds: number; required_seconds: number; started_at: Date; ad_title: string }>(
      `SELECT s.id, s.status, s.watched_seconds, s.required_seconds, s.started_at, a.title AS ad_title
         FROM ad_sessions s JOIN advertisements a ON a.id = s.advertisement_id
        WHERE s.user_id = $1 ORDER BY s.started_at DESC LIMIT 5`,
      [ticket.user_id],
    ),
    query<{ id: string; reference: string; type: string; direction: string; amount_cents: number; status: string; created_at: Date }>(
      `SELECT id, reference, type, direction, amount_cents, status, created_at
         FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [ticket.user_id],
    ),
    getSettings(),
  ]);

  const closed = ticket.status === "CLOSED";

  return (
    <div className="space-y-6">
      <Link href="/admin/support" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-navy">
        <ArrowLeft className="h-3.5 w-3.5" /> All tickets
      </Link>

      <PageHeader
        eyebrow={`${ticket.reference} · ${ticket.category}`}
        title={ticket.subject}
        description={`Opened ${formatDate(ticket.created_at, true)} · last updated ${relativeTime(ticket.updated_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ticket.priority === "URGENT" ? "danger" : ticket.priority === "HIGH" ? "warning" : "neutral"}>
              Priority: {statusLabel(ticket.priority)}
            </Badge>
            <Badge tone={STATUS_TONE[ticket.status] ?? "neutral"}>{statusLabel(ticket.status)}</Badge>
          </div>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Conversation"
            description="Public replies are visible to the member. Internal notes stay inside the admin portal."
            actions={<MessageSquare className="h-4 w-4 text-muted" />}
          />
          <CardBody className="space-y-4">
            {messages.length === 0 ? (
              <p className="text-[12.5px] text-muted">No messages yet.</p>
            ) : (
              messages.map((message) => {
                const staffMember = message.author_role !== "MEMBER";
                return (
                  <div key={message.id} className={`flex gap-3 ${staffMember ? "flex-row-reverse" : ""}`}>
                    <Avatar name={message.author_name} size="sm" />
                    <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${message.is_internal ? "border border-[#f4e2bd] bg-[#fffaf0]" : staffMember ? "bg-brandsoft" : "bg-surface"}`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[12px] font-semibold text-navy">{message.author_name}</span>
                        {staffMember ? (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-brand">Staff</span>
                        ) : (
                          <span className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-muted">Member</span>
                        )}
                        {message.is_internal ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-[#a9741d]">
                            <Lock className="h-2.5 w-2.5" /> Internal
                          </span>
                        ) : null}
                        <span className="text-[10.5px] text-muted">{relativeTime(message.created_at)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-ink">{message.body}</p>
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Member" actions={<ArrowUpRight className="h-4 w-4 text-muted" />} />
            <CardBody className="py-1">
              <div className="flex items-center gap-3 pb-3">
                <Avatar name={ticket.member_name} />
                <div className="min-w-0">
                  <Link href={`/admin/users/${ticket.user_id}`} className="truncate text-[13px] font-semibold text-navy hover:text-brand">{ticket.member_name}</Link>
                  <p className="font-mono text-[10.5px] text-muted">{ticket.member_id}</p>
                </div>
              </div>
              <InfoRow label="Email">{ticket.email}</InfoRow>
              <InfoRow label="Mobile">{ticket.mobile}</InfoRow>
              <InfoRow label="Account">
                <Badge tone={STATUS_TONE[ticket.account_status] ?? "neutral"}>{ACCOUNT_STATUS_LABELS[ticket.account_status as keyof typeof ACCOUNT_STATUS_LABELS] ?? statusLabel(ticket.account_status)}</Badge>
              </InfoRow>
              <InfoRow label="Membership">
                <Badge tone={STATUS_TONE[ticket.membership_status ?? "PENDING"] ?? "neutral"}>{statusLabel(ticket.membership_status ?? "PENDING")}</Badge>
              </InfoRow>
              <InfoRow label="Demo wallet">{formatMoney(ticket.available_cents ?? 0, settings.currency)}</InfoRow>
              <InfoRow label="Completed ads">{ticket.completed_sessions}</InfoRow>
              <InfoRow label="Referrals">{ticket.referrals}</InfoRow>
              <div className="flex flex-wrap gap-2 py-3">
                <Link href={`/admin/users/${ticket.user_id}`} className="text-[11.5px] font-semibold text-brand hover:text-brand-dark">Open member record</Link>
                <span className="text-muted">·</span>
                <Link href={`/admin/wallet?q=${encodeURIComponent(ticket.member_id)}`} className="text-[11.5px] font-semibold text-brand hover:text-brand-dark">Wallet ledger</Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Assignment" description="Route the ticket to the right staff member." />
            <CardBody className="space-y-3">
              <form action={assignTicketAction} className="space-y-2">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <Field label="Assigned staff" htmlFor="assignedTo">
                  <Select id="assignedTo" name="assignedTo" defaultValue={ticket.assigned_to ?? ""}>
                    <option value="">Unassigned</option>
                    {staff.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} · {statusLabel(member.role)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <SubmitButton variant="secondary" className="w-full" size="sm" pendingLabel="Saving…">Update assignment</SubmitButton>
              </form>
              <form action={assignTicketPriorityAction} className="space-y-2 border-t border-line pt-3">
                <input type="hidden" name="ticketId" value={ticket.id} />
                <Field label="Priority" htmlFor="priority">
                  <Select id="priority" name="priority" defaultValue={ticket.priority}>
                    {["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => (
                      <option key={value} value={value}>{statusLabel(value)}</option>
                    ))}
                  </Select>
                </Field>
                <SubmitButton variant="secondary" className="w-full" size="sm" pendingLabel="Saving…">Update priority</SubmitButton>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent member activity" description="Last five ad sessions." />
            {recentSessions.length === 0 ? (
              <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No ad activity" />
            ) : (
              <div className="divide-y divide-line/70">
                {recentSessions.map((session) => (
                  <div key={session.id} className="px-5 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[11.5px] font-medium text-navy">{session.ad_title}</p>
                      <Badge tone={STATUS_TONE[session.status] ?? "neutral"}>{statusLabel(session.status)}</Badge>
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      {session.watched_seconds}s / {session.required_seconds}s · {relativeTime(session.started_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Reply" description={closed ? "This ticket is closed. Reopen it by replying and setting a new status." : "Send a public reply or save an internal note."} />
          <CardBody>
            <form action={adminReplyTicketAction} className="space-y-3">
              <input type="hidden" name="ticketId" value={ticket.id} />
              <Textarea name="body" required minLength={2} maxLength={4000} placeholder="Write your response…" className="min-h-[130px]" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Set status" htmlFor="status">
                  <Select id="status" name="status" defaultValue={ticket.status}>
                    {["OPEN", "IN_PROGRESS", "WAITING_FOR_MEMBER", "RESOLVED", "CLOSED"].map((value) => (
                      <option key={value} value={value}>{statusLabel(value)}</option>
                    ))}
                  </Select>
                </Field>
                <label className="flex items-end gap-2 pb-2.5 text-[12.5px] text-ink">
                  <input type="checkbox" name="internal" value="on" className="h-4 w-4 rounded border-line accent-[#1769e0]" />
                  Save as internal note (not visible to member)
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-[11px] text-muted">
                  <ShieldCheck className="h-3.5 w-3.5" /> Public replies notify the member.
                </p>
                <SubmitButton pendingLabel="Sending…"><Send className="h-4 w-4" /> Send</SubmitButton>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Recent wallet entries" description="Useful when the ticket is about rewards or withdrawals." />
          {recentTxns.length === 0 ? (
            <EmptyState icon={<Wallet className="h-5 w-5" />} title="No wallet activity" />
          ) : (
            <div className="divide-y divide-line/70">
              {recentTxns.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-medium text-ink">{TXN_TYPE_LABELS[txn.type] ?? txn.type}</p>
                    <p className="font-mono text-[10px] text-muted">{txn.reference}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[12px] font-semibold ${txn.direction === "CREDIT" ? "text-success" : "text-ink"}`}>
                      {txn.direction === "CREDIT" ? "+" : "−"}{formatMoney(txn.amount_cents, settings.currency)}
                    </p>
                    <p className="text-[10px] text-muted">{relativeTime(txn.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
        <span className="inline-flex items-center gap-1.5 font-semibold text-navy"><UserCog className="h-3.5 w-3.5" /> Audit trail.</span>{" "}
        Replies, internal notes, assignments and priority changes are all written to the audit log with your staff identity.
      </div>
    </div>
  );
}
