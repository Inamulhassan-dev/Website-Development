import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, LifeBuoy, MessageSquare, Search, Timer } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  StatCard,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, relativeTime } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Support tickets" };
export const dynamic = "force-dynamic";

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; priority?: string }>;
}) {
  await requireAdminPage("support.view");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const status = params.status && params.status !== "ALL" ? params.status : null;
  const priority = params.priority && params.priority !== "ALL" ? params.priority : null;

  const [tickets, metrics, categories] = await Promise.all([
    query<{
      id: string; reference: string; category: string; subject: string; status: string; priority: string;
      created_at: Date; updated_at: Date; message_count: number; internal_count: number; last_body: string | null;
      member_name: string; member_id: string; member_status: string; user_id: string; assignee_name: string | null;
    }>(
      `SELECT t.id, t.reference, t.category, t.subject, t.status, t.priority, t.created_at, t.updated_at,
              (SELECT count(*)::int FROM support_messages m WHERE m.ticket_id = t.id AND m.is_internal = FALSE) AS message_count,
              (SELECT count(*)::int FROM support_messages m WHERE m.ticket_id = t.id AND m.is_internal = TRUE) AS internal_count,
              (SELECT m.body FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_body,
              u.full_name AS member_name, u.member_id, u.account_status AS member_status, u.id AS user_id,
              staff.full_name AS assignee_name
         FROM support_tickets t
         JOIN users u ON u.id = t.user_id
         LEFT JOIN users staff ON staff.id = t.assigned_to
        WHERE ($1 = '' OR t.subject ILIKE '%' || $1 || '%' OR t.reference ILIKE '%' || $1 || '%' OR u.full_name ILIKE '%' || $1 || '%' OR u.member_id ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR t.status = $2)
          AND ($3::text IS NULL OR t.priority = $3)
        ORDER BY
          CASE t.priority WHEN 'URGENT' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END,
          t.updated_at DESC
        LIMIT 200`,
      [q, status, priority],
    ),
    one<{ total: number; open: number; in_progress: number; waiting: number; resolved: number; urgent: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'OPEN')::int AS open,
              count(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress,
              count(*) FILTER (WHERE status = 'WAITING_FOR_MEMBER')::int AS waiting,
              count(*) FILTER (WHERE status IN ('RESOLVED','CLOSED'))::int AS resolved,
              count(*) FILTER (WHERE priority IN ('HIGH','URGENT') AND status NOT IN ('RESOLVED','CLOSED'))::int AS urgent
         FROM support_tickets`,
    ),
    query<{ category: string; count: number }>(
      `SELECT category, count(*)::int AS count FROM support_tickets GROUP BY category ORDER BY count DESC LIMIT 8`,
    ),
  ]);

  const m = metrics ?? { total: 0, open: 0, in_progress: 0, waiting: 0, resolved: 0, urgent: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Support tickets"
        description="Respond to member questions across membership, wallet, advertising and account security."
        actions={<LinkButton href="/api/admin/export?type=support" variant="secondary" size="sm"><Download className="h-4 w-4" /> Export CSV</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open tickets" value={m.open} hint={`${m.in_progress} in progress`} icon={<LifeBuoy className="h-5 w-5" />} tone={m.open ? "brand" : "neutral"} />
        <StatCard label="Waiting for member" value={m.waiting} icon={<Timer className="h-5 w-5" />} tone="warning" />
        <StatCard label="High / urgent" value={m.urgent} hint="Unresolved" icon={<MessageSquare className="h-5 w-5" />} tone={m.urgent ? "danger" : "neutral"} />
        <StatCard label="Resolved / closed" value={m.resolved} hint={`${m.total} tickets all time`} icon={<LifeBuoy className="h-5 w-5" />} tone="success" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Inbox" description="High and urgent tickets are listed first." />
          <div className="border-b border-line p-4 sm:p-5">
            <form className="grid gap-2.5 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input name="q" defaultValue={q} placeholder="Subject, reference, member" className="pl-9" />
              </div>
              <Select name="status" defaultValue={status ?? "ALL"} aria-label="Status">
                <option value="ALL">All statuses</option>
                {["OPEN", "IN_PROGRESS", "WAITING_FOR_MEMBER", "RESOLVED", "CLOSED"].map((value) => (
                  <option key={value} value={value}>{statusLabel(value)}</option>
                ))}
              </Select>
              <Select name="priority" defaultValue={priority ?? "ALL"} aria-label="Priority">
                <option value="ALL">All priorities</option>
                {["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => (
                  <option key={value} value={value}>{statusLabel(value)}</option>
                ))}
              </Select>
              <SubmitButton variant="secondary">Apply</SubmitButton>
            </form>
          </div>

          {tickets.length === 0 ? (
            <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No tickets match" description="Try clearing the filters or search for a different member." />
          ) : (
            <div className="divide-y divide-line/70">
              {tickets.map((ticket) => (
                <Link key={ticket.id} href={`/admin/support/${ticket.id}`} className="block px-5 py-4 transition hover:bg-[#fafcff] sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-navy">{ticket.subject}</p>
                        <Badge tone={STATUS_TONE[ticket.status] ?? "neutral"}>{statusLabel(ticket.status)}</Badge>
                        <Badge tone={ticket.priority === "URGENT" ? "danger" : ticket.priority === "HIGH" ? "warning" : "neutral"}>
                          {statusLabel(ticket.priority)}
                        </Badge>
                      </div>
                      <p className="mt-0.5 font-mono text-[10.5px] text-muted">
                        {ticket.reference} · {ticket.category} · {ticket.member_name} ({ticket.member_id})
                      </p>
                      {ticket.last_body ? <p className="mt-1 line-clamp-1 max-w-2xl text-[11.5px] text-muted">{ticket.last_body}</p> : null}
                    </div>
                    <div className="shrink-0 text-right text-[10.5px] text-muted">
                      <p>{relativeTime(ticket.updated_at)}</p>
                      <p>{ticket.message_count} public · {ticket.internal_count} internal</p>
                      <p>{ticket.assignee_name ? `Assigned: ${ticket.assignee_name}` : "Unassigned"}</p>
                    </div>
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand">
                    Open conversation <ArrowRight className="h-3 w-3" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Tickets by category" description="Where members need help most." />
            <CardBody className="space-y-2.5">
              {categories.length === 0 ? (
                <p className="text-[12px] text-muted">No tickets recorded yet.</p>
              ) : (
                categories.map((category) => {
                  const max = Math.max(...categories.map((row) => row.count), 1);
                  return (
                    <div key={category.category}>
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="text-ink">{category.category}</span>
                        <span className="text-muted">{category.count}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#eef2f7]">
                        <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((category.count / max) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Support standards" description="Expected handling in this demonstration." />
            <CardBody className="space-y-2.5 text-[11.5px] leading-relaxed text-muted">
              <p><span className="font-semibold text-navy">First response:</span> within one business day for normal priority.</p>
              <p><span className="font-semibold text-navy">Urgent issues:</span> account security and suspected fraud first.</p>
              <p><span className="font-semibold text-navy">Internal notes:</span> visible only to staff; never sent to the member.</p>
              <p><span className="font-semibold text-navy">Close the loop:</span> reply, then set the status to resolved or waiting.</p>
              <p className="rounded-lg bg-surface px-2.5 py-2">Never ask for passwords, private keys, seed phrases or real banking details.</p>
            </CardBody>
          </Card>

          <Card className="bg-[#fafcff]">
            <CardHeader title="SLA snapshot" />
            <CardBody className="text-[11.5px] leading-relaxed text-muted">
              Last refreshed {formatDate(new Date(), true)}. All conversations and notifications in this demo are simulated.
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
