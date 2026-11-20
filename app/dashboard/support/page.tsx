import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LifeBuoy, MessageSquare, Plus, ShieldCheck } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { createTicketAction } from "@/lib/actions/member";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Select, Table, TableWrap, Td, Th, Tr, Textarea } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, relativeTime } from "@/lib/format";import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Support" };
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const user = await requireMember("/dashboard/support");
  const tickets = await query<{
    id: string;
    reference: string;
    category: string;
    subject: string;
    status: string;
    priority: string;
    updated_at: Date;
    created_at: Date;
    message_count: number;
    last_body: string | null;
  }>(
    `SELECT t.id, t.reference, t.category, t.subject, t.status, t.priority, t.updated_at, t.created_at,
            (SELECT count(*)::int FROM support_messages m WHERE m.ticket_id = t.id AND m.is_internal = FALSE) AS message_count,
            (SELECT m.body FROM support_messages m WHERE m.ticket_id = t.id AND m.is_internal = FALSE ORDER BY m.created_at DESC LIMIT 1) AS last_body
       FROM support_tickets t WHERE t.user_id = $1 ORDER BY t.updated_at DESC`,
    [user.id],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Support"
        description="Open a ticket for account, membership, wallet or advertising questions. Replies arrive in the same thread."
      />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Your tickets" description={`${tickets.length} ticket${tickets.length === 1 ? "" : "s"}`} actions={<LifeBuoy className="h-4 w-4 text-muted" />} />
          {tickets.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-5 w-5" />}
              title="No support tickets yet"
              description="Use the form to open your first ticket. Most questions are answered within one business day in this demo."
            />
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <tr>
                    <Th>Ticket</Th>
                    <Th>Status</Th>
                    <Th>Messages</Th>
                    <Th>Updated</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <Tr key={ticket.id}>
                      <Td>
                        <Link href={`/dashboard/support/${ticket.id}`} className="font-medium text-navy hover:text-brand">
                          {ticket.subject}
                        </Link>
                        <p className="font-mono text-[10.5px] text-muted">{ticket.reference} · {ticket.category}</p>
                        {ticket.last_body ? <p className="mt-0.5 line-clamp-1 max-w-xs text-[11px] text-muted">{ticket.last_body}</p> : null}
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONE[ticket.status] ?? "neutral"}>{statusLabel(ticket.status)}</Badge>
                      </Td>
                      <Td className="text-muted">{ticket.message_count}</Td>
                      <Td className="whitespace-nowrap text-muted">{relativeTime(ticket.updated_at)}</Td>
                      <Td>
                        <Link href={`/dashboard/support/${ticket.id}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:text-brand-dark">
                          Open <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Open a new ticket" description="Never include passwords or private financial details." />
          <CardBody>
            <form action={createTicketAction} className="space-y-4">
              <Field label="Category" htmlFor="category">
                <Select id="category" name="category" defaultValue="General">
                  {["General", "Membership", "Wallet", "Advertisements", "Referrals", "Account security", "Technical issue"].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Subject" htmlFor="subject">
                <Input id="subject" name="subject" placeholder="A short summary" maxLength={160} required minLength={4} />
              </Field>
              <Field label="Message" htmlFor="message">
                <Textarea id="message" name="message" placeholder="Describe what happened and what you need help with." minLength={10} maxLength={4000} required />
              </Field>
              <SubmitButton className="w-full" pendingLabel="Creating ticket…">
                <Plus className="h-4 w-4" /> Create ticket
              </SubmitButton>
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Support staff can see your account details and recent activity relevant to the ticket.
              </p>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card className="bg-[#fafcff]">
        <CardHeader title="Response expectations" description="This is a demonstration environment." />
        <CardBody className="grid gap-4 text-[12px] text-muted sm:grid-cols-3">
          <div>
            <p className="font-semibold text-navy">Support hours</p>
            <p className="mt-1 leading-relaxed">Monday–Friday, 09:00–18:00. Demo replies are manual.</p>
          </div>
          <div>
            <p className="font-semibold text-navy">Security issues</p>
            <p className="mt-1 leading-relaxed">Use the “Account security” category and never share your password.</p>
          </div>
          <div>
            <p className="font-semibold text-navy">Ticket status</p>
            <p className="mt-1 leading-relaxed">Open, in progress, waiting for you, resolved, or closed.</p>
          </div>
        </CardBody>
      </Card>

    </div>
  );
}
