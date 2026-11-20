import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, CheckCircle2, Clock3, Download, ShieldCheck, Wallet, XCircle } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { decideWithdrawalAction } from "@/lib/actions/admin";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  StatCard,
  Table,
  TableWrap,
  Td,
  Textarea,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney, relativeTime } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";
import { WITHDRAWAL_METHODS } from "@/lib/services/withdrawals";

export const metadata: Metadata = { title: "Withdrawals" };
export const dynamic = "force-dynamic";

export default async function AdminWithdrawalsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  await requireAdminPage("withdrawals.view");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const status = params.status && params.status !== "ALL" ? params.status : null;

  const [metrics, queue, rows, settings] = await Promise.all([
    one<{ pending: number; pending_cents: number; approved: number; approved_cents: number; rejected: number; completed: number }>(
      `SELECT count(*) FILTER (WHERE status IN ('PENDING','UNDER_REVIEW'))::int AS pending,
              COALESCE(sum(amount_cents) FILTER (WHERE status IN ('PENDING','UNDER_REVIEW')),0)::int AS pending_cents,
              count(*) FILTER (WHERE status = 'APPROVED')::int AS approved,
              COALESCE(sum(amount_cents) FILTER (WHERE status = 'APPROVED'),0)::int AS approved_cents,
              count(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
              count(*) FILTER (WHERE status = 'COMPLETED')::int AS completed
         FROM withdrawal_requests`,
    ),
    query<{
      id: string; reference: string; amount_cents: number; method: string; destination_masked: string;
      note: string | null; status: string; created_at: Date; full_name: string; member_id: string;
      email: string; user_id: string; available_cents: number; membership_status: string | null;
    }>(
      `SELECT w.id, w.reference, w.amount_cents, w.method, w.destination_masked, w.note, w.status, w.created_at,
              u.full_name, u.member_id, u.email, u.id AS user_id, COALESCE(wal.available_cents,0)::int AS available_cents,
              m.status AS membership_status
         FROM withdrawal_requests w
         JOIN users u ON u.id = w.user_id
         LEFT JOIN wallets wal ON wal.user_id = u.id
         LEFT JOIN memberships m ON m.user_id = u.id
        WHERE w.status IN ('PENDING','UNDER_REVIEW')
        ORDER BY w.created_at ASC
        LIMIT 100`,
    ),
    query<{
      id: string; reference: string; amount_cents: number; method: string; destination_masked: string;
      status: string; decision_reason: string | null; created_at: Date; decided_at: Date | null;
      full_name: string; member_id: string; user_id: string; decided_by_name: string | null;
    }>(
      `SELECT w.id, w.reference, w.amount_cents, w.method, w.destination_masked, w.status, w.decision_reason,
              w.created_at, w.decided_at, u.full_name, u.member_id, u.id AS user_id, staff.full_name AS decided_by_name
         FROM withdrawal_requests w
         JOIN users u ON u.id = w.user_id
         LEFT JOIN users staff ON staff.id = w.decided_by
        WHERE ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.member_id ILIKE '%' || $1 || '%' OR w.reference ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR w.status = $2)
        ORDER BY w.created_at DESC LIMIT 100`,
      [q, status],
    ),
    getSettings(),
  ]);

  const m = metrics ?? { pending: 0, pending_cents: 0, approved: 0, approved_cents: 0, rejected: 0, completed: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Withdrawals"
        description="Review simulated payout requests. Approving finalises the reserved demo balance; rejecting releases it back to the member."
        actions={<LinkButton href="/api/admin/export?type=withdrawals" variant="secondary" size="sm"><Download className="h-4 w-4" /> Export CSV</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting review" value={m.pending} hint={formatMoney(m.pending_cents, settings.currency)} icon={<Clock3 className="h-5 w-5" />} tone={m.pending ? "warning" : "neutral"} />
        <StatCard label="Approved (demo)" value={m.approved} hint={formatMoney(m.approved_cents, settings.currency)} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Rejected" value={m.rejected} hint="Reserved balance released" icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="Completed" value={m.completed} hint="No real transfer occurs" icon={<Banknote className="h-5 w-5" />} />
      </div>

      <div className="rounded-2xl border border-[#cfe2ff] bg-brandsoft px-4 py-3 text-[12px] leading-relaxed text-brand">
        <span className="font-semibold">Simulation only.</span> Approving a request marks it approved and moves the reserved
        amount out of the demo wallet. No bank, card or crypto transfer is ever made. Never request real banking credentials.
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader title={`Review queue · ${queue.length}`} description="Oldest requests first." actions={<ShieldCheck className="h-4 w-4 text-muted" />} />
          {queue.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-5 w-5" />} title="Queue is clear" description="No withdrawal requests are awaiting review." />
          ) : (
            <div className="divide-y divide-line/70">
              {queue.map((row) => (
                <div key={row.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link href={`/admin/users/${row.user_id}`} className="text-[13.5px] font-semibold text-navy hover:text-brand">{row.full_name}</Link>
                      <p className="font-mono text-[10.5px] text-muted">{row.reference} · {row.member_id}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        Requested {relativeTime(row.created_at)} · {statusLabel(row.membership_status ?? "PENDING")} membership
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[20px] font-semibold tracking-tight text-navy">{formatMoney(row.amount_cents, settings.currency)}</p>
                      <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</Badge>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 text-[11.5px] sm:grid-cols-3">
                    <div className="rounded-lg bg-surface px-2.5 py-2">
                      <p className="text-muted">Method</p>
                      <p className="mt-0.5 font-medium text-ink">{WITHDRAWAL_METHODS[row.method as keyof typeof WITHDRAWAL_METHODS] ?? row.method}</p>
                    </div>
                    <div className="rounded-lg bg-surface px-2.5 py-2">
                      <p className="text-muted">Destination</p>
                      <p className="mt-0.5 truncate font-medium text-ink">{row.destination_masked}</p>
                    </div>
                    <div className="rounded-lg bg-surface px-2.5 py-2">
                      <p className="text-muted">Wallet balance</p>
                      <p className="mt-0.5 font-medium text-ink">{formatMoney(row.available_cents, settings.currency)}</p>
                    </div>
                  </div>

                  {row.note ? <p className="mt-2 rounded-lg border border-line px-2.5 py-2 text-[11.5px] leading-relaxed text-muted">{row.note}</p> : null}

                  <form action={decideWithdrawalAction} className="mt-3 space-y-2 rounded-xl border border-line p-3">
                    <input type="hidden" name="withdrawalId" value={row.id} />
                    <Textarea
                      name="reason"
                      maxLength={500}
                      placeholder="Decision note — required when rejecting, optional when approving."
                      className="min-h-[56px] text-[12px]"
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      <SubmitButton size="sm" variant="secondary" name="decision" value="REJECT" pendingLabel="Saving…" confirm="Reject this request and release the reserved demo balance?">
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </SubmitButton>
                      <SubmitButton size="sm" name="decision" value="APPROVE" pendingLabel="Saving…" confirm="Approve this simulated withdrawal? No real funds will be sent.">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                      </SubmitButton>
                    </div>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="h-fit">
          <CardHeader title="Review checklist" description="Confirm before deciding." />
          <CardBody className="space-y-3 text-[12px] leading-relaxed text-muted">
            {[
              { title: "Wallet balance", body: "The amount is reserved at request time, so the available balance already excludes it." },
              { title: "One request at a time", body: "Members can only have one open withdrawal request, reducing duplicate exposure." },
              { title: "Masked destinations", body: "Only masked, fictional destination details are stored. Never request real account numbers." },
              { title: "Rejection releases funds", body: "Rejecting creates a ledger release entry and notifies the member automatically." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-line px-3 py-2.5">
                <p className="font-semibold text-navy">{item.title}</p>
                <p className="mt-0.5">{item.body}</p>
              </div>
            ))}
            <div className="flex items-start gap-2 rounded-xl bg-surface px-3 py-2.5">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <p>Finance Admin and Super Admin roles can review requests. Every decision is recorded in the audit log.</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Request history"
          description="All withdrawal requests with their decision trail."
          actions={
            <form className="flex flex-wrap items-center gap-2">
              <Input name="q" defaultValue={q} placeholder="Search member or reference" className="h-9 w-56 text-[12px]" />
              <select name="status" defaultValue={status ?? "ALL"} className="h-9 rounded-xl border border-line bg-white px-2.5 text-[12px] text-ink">
                <option value="ALL">All statuses</option>
                {["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"].map((value) => (
                  <option key={value} value={value}>{statusLabel(value)}</option>
                ))}
              </select>
              <SubmitButton size="sm" variant="secondary">Apply</SubmitButton>
            </form>
          }
        />
        {rows.length === 0 ? (
          <EmptyState icon={<Banknote className="h-5 w-5" />} title="No withdrawal records" />
        ) : (
          <TableWrap>
            <Table className="min-w-[1000px]">
              <thead>
                <tr><Th>Reference</Th><Th>Member</Th><Th className="text-right">Amount</Th><Th>Method</Th><Th>Destination</Th><Th>Status</Th><Th>Requested</Th><Th>Decided</Th><Th>Decided by</Th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td className="font-mono text-[11px]">{row.reference}</Td>
                    <Td>
                      <Link href={`/admin/users/${row.user_id}`} className="font-medium text-navy hover:text-brand">{row.full_name}</Link>
                      <p className="font-mono text-[10px] text-muted">{row.member_id}</p>
                    </Td>
                    <Td className="text-right font-semibold">{formatMoney(row.amount_cents, settings.currency)}</Td>
                    <Td className="text-muted">{WITHDRAWAL_METHODS[row.method as keyof typeof WITHDRAWAL_METHODS] ?? row.method}</Td>
                    <Td className="max-w-[170px] truncate text-muted">{row.destination_masked}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</Badge>
                      {row.decision_reason ? <p className="mt-0.5 line-clamp-1 max-w-[180px] text-[10px] text-muted">{row.decision_reason}</p> : null}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(row.created_at, true)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(row.decided_at, true)}</Td>
                    <Td className="text-muted">{row.decided_by_name ?? "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
