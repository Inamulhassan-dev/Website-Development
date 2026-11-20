import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, MessageSquare, Send, ShieldCheck } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { replyTicketAction } from "@/lib/actions/member";
import { Avatar, Badge, Card, CardBody, CardHeader, PageHeader, Textarea } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, relativeTime } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Support ticket" };
export const dynamic = "force-dynamic";

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireMember("/dashboard/support");
  const { id } = await params;
  const ticket = await one<{
    id: string;
    reference: string;
    subject: string;
    category: string;
    status: string;
    priority: string;
    created_at: Date;
    updated_at: Date;
    closed_at: Date | null;
  }>(
    `SELECT id, reference, subject, category, status, priority, created_at, updated_at, closed_at
       FROM support_tickets WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!ticket) notFound();

  const messages = await query<{ id: string; body: string; is_internal: boolean; created_at: Date; author_name: string; author_role: string }>(
    `SELECT m.id, m.body, m.is_internal, m.created_at, u.full_name AS author_name, u.role AS author_role
       FROM support_messages m JOIN users u ON u.id = m.author_id
      WHERE m.ticket_id = $1 AND m.is_internal = FALSE
      ORDER BY m.created_at ASC`,
    [ticket.id],
  );

  const closed = ticket.status === "CLOSED" || ticket.status === "RESOLVED";

  return (
    <div className="space-y-6">
      <Link href="/dashboard/support" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-navy">
        <ArrowLeft className="h-3.5 w-3.5" /> All tickets
      </Link>

      <PageHeader
        eyebrow={ticket.reference}
        title={ticket.subject}
        description={`${ticket.category} · opened ${formatDate(ticket.created_at, true)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[ticket.priority] ?? "neutral"}>Priority: {statusLabel(ticket.priority)}</Badge>
            <Badge tone={STATUS_TONE[ticket.status] ?? "neutral"}>{statusLabel(ticket.status)}</Badge>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Conversation" description="Visible messages between you and support." actions={<MessageSquare className="h-4 w-4 text-muted" />} />
          <CardBody className="space-y-4">
            {messages.map((message) => {
              const staff = message.author_role !== "MEMBER";
              return (
                <div key={message.id} className={`flex gap-3 ${staff ? "" : "flex-row-reverse"}`}>
                  <Avatar name={message.author_name} size="sm" />
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${staff ? "bg-surface" : "bg-brandsoft"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-semibold text-navy">{message.author_name}</span>
                      {staff ? (
                        <span className="rounded-full bg-white px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.06em] text-brand">
                          Support
                        </span>
                      ) : null}
                      <span className="text-[10.5px] text-muted">{relativeTime(message.created_at)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-[12.5px] leading-relaxed text-ink">{message.body}</p>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 ? <p className="text-[12.5px] text-muted">No messages yet.</p> : null}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Ticket details" />
            <CardBody className="divide-y divide-line/70 py-1 text-[12.5px]">
              {[
                ["Reference", ticket.reference],
                ["Category", ticket.category],
                ["Status", statusLabel(ticket.status)],
                ["Priority", statusLabel(ticket.priority)],
                ["Opened", formatDate(ticket.created_at, true)],
                ["Last update", formatDate(ticket.updated_at, true)],
                ["Closed", ticket.closed_at ? formatDate(ticket.closed_at, true) : "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 py-2">
                  <span className="text-muted">{label}</span>
                  <span className="text-right font-medium text-ink">{value}</span>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Reply" description={closed ? "This ticket is closed." : "Add a follow-up message."} />
            <CardBody>
              {closed ? (
                <div className="space-y-3">
                  <p className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5 text-[12px] leading-relaxed text-muted">
                    <Lock className="mt-0.5 h-4 w-4 shrink-0" /> You cannot reply to a resolved or closed ticket.
                  </p>
                  <Link href="/dashboard/support" className="text-[12px] font-semibold text-brand hover:text-brand-dark">
                    Open a new ticket
                  </Link>
                </div>
              ) : (
                <form action={replyTicketAction} className="space-y-3">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <Textarea name="body" minLength={2} maxLength={4000} required placeholder="Write your reply…" className="min-h-[110px]" />
                  <SubmitButton className="w-full" pendingLabel="Sending…">
                    <Send className="h-4 w-4" /> Send reply
                  </SubmitButton>
                </form>
              )}
            </CardBody>
          </Card>

          <div className="rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
            <div className="flex items-center gap-2 font-semibold text-navy">
              <ShieldCheck className="h-4 w-4 text-brand" /> Safety reminder
            </div>
            <p className="mt-1.5">Support will never ask for your password. Never share private keys, seed phrases or real banking credentials.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
