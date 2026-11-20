import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Download, Receipt, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  Badge,
  Card,
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
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE, TXN_TYPE_LABELS, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

export default async function AdminTransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; direction?: string; status?: string }>;
}) {
  await requireAdminPage("transactions.view");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const type = params.type && params.type !== "ALL" ? params.type : null;
  const direction = params.direction && params.direction !== "ALL" ? params.direction : null;
  const status = params.status && params.status !== "ALL" ? params.status : null;

  const [rows, metrics, settings] = await Promise.all([
    query<{
      id: string; reference: string; type: string; direction: string; amount_cents: number; status: string;
      description: string; balance_after_cents: number; created_at: Date; full_name: string; member_id: string;
      user_id: string; related_type: string | null; related_id: string | null; created_by: string | null;
    }>(
      `SELECT t.id, t.reference, t.type, t.direction, t.amount_cents, t.status, t.description,
              t.balance_after_cents, t.created_at, t.related_type, t.related_id, t.created_by,
              u.full_name, u.member_id, u.id AS user_id
         FROM wallet_transactions t JOIN users u ON u.id = t.user_id
        WHERE ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.member_id ILIKE '%' || $1 || '%' OR t.reference ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR t.type = $2)
          AND ($3::text IS NULL OR t.direction = $3)
          AND ($4::text IS NULL OR t.status = $4)
        ORDER BY t.created_at DESC LIMIT 200`,
      [q, type, direction, status],
    ),
    one<{ total: number; credits: number; debits: number; pending: number; reversed: number }>(
      `SELECT count(*)::int AS total,
              COALESCE(sum(amount_cents) FILTER (WHERE direction = 'CREDIT' AND status = 'COMPLETED'),0)::int AS credits,
              COALESCE(sum(amount_cents) FILTER (WHERE direction = 'DEBIT' AND status = 'COMPLETED'),0)::int AS debits,
              count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
              count(*) FILTER (WHERE status = 'REVERSED')::int AS reversed
         FROM wallet_transactions`,
    ),
    getSettings(),
  ]);

  const m = metrics ?? { total: 0, credits: 0, debits: 0, pending: 0, reversed: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Transactions"
        description="The complete wallet ledger across every member. Entries are append-only and reference the event that created them."
        actions={
          <LinkButton href="/api/admin/export?type=transactions" variant="secondary" size="sm">
            <Download className="h-4 w-4" /> Export CSV
          </LinkButton>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Ledger entries" value={m.total} icon={<Receipt className="h-5 w-5" />} />
        <StatCard label="Completed credits" value={formatMoney(m.credits, settings.currency)} icon={<ArrowDownLeft className="h-5 w-5" />} tone="success" />
        <StatCard label="Completed debits" value={formatMoney(m.debits, settings.currency)} icon={<ArrowUpRight className="h-5 w-5" />} />
        <StatCard label="Pending / reversed" value={`${m.pending} / ${m.reversed}`} hint="Holds and reversals" icon={<Receipt className="h-5 w-5" />} tone={m.reversed ? "warning" : "neutral"} />
      </div>

      <Card>
        <CardHeader title="Filter the ledger" description="Combine search, type, direction and status." />
        <div className="border-b border-line p-4 sm:p-5">
          <form className="grid gap-2.5 lg:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input name="q" defaultValue={q} placeholder="Member, Member ID or reference" className="pl-9" />
            </div>
            <Select name="type" defaultValue={type ?? "ALL"} aria-label="Type">
              <option value="ALL">All types</option>
              {Object.entries(TXN_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <Select name="direction" defaultValue={direction ?? "ALL"} aria-label="Direction">
              <option value="ALL">Both directions</option>
              <option value="CREDIT">Credit</option>
              <option value="DEBIT">Debit</option>
            </Select>
            <Select name="status" defaultValue={status ?? "ALL"} aria-label="Status">
              <option value="ALL">All statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REVERSED">Reversed</option>
            </Select>
            <SubmitButton variant="secondary">Apply</SubmitButton>
          </form>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-5 w-5" />}
            title="No transactions match"
            description="Adjust the filters or clear the search to see the full ledger."
          />
        ) : (
          <TableWrap>
            <Table className="min-w-[1080px]">
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Member</Th>
                  <Th>Type</Th>
                  <Th>Direction</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Balance after</Th>
                  <Th>Linked record</Th>
                  <Th>Created</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((txn) => (
                  <Tr key={txn.id}>
                    <Td className="font-mono text-[11px]">{txn.reference}</Td>
                    <Td>
                      <Link href={`/admin/users/${txn.user_id}`} className="font-medium text-navy hover:text-brand">{txn.full_name}</Link>
                      <p className="font-mono text-[10px] text-muted">{txn.member_id}</p>
                    </Td>
                    <Td>
                      <p className="text-[12.5px] text-ink">{TXN_TYPE_LABELS[txn.type] ?? txn.type}</p>
                      <p className="line-clamp-1 max-w-[240px] text-[10.5px] text-muted">{txn.description}</p>
                    </Td>
                    <Td>
                      <Badge tone={txn.direction === "CREDIT" ? "success" : "neutral"}>
                        {txn.direction === "CREDIT" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {statusLabel(txn.direction)}
                      </Badge>
                    </Td>
                    <Td className={`text-right font-semibold ${txn.direction === "CREDIT" ? "text-success" : "text-ink"}`}>
                      {txn.direction === "CREDIT" ? "+" : "−"}{formatMoney(txn.amount_cents, settings.currency)}
                    </Td>
                    <Td><Badge tone={STATUS_TONE[txn.status] ?? "neutral"}>{statusLabel(txn.status)}</Badge></Td>
                    <Td className="text-right text-muted">{formatMoney(txn.balance_after_cents, settings.currency)}</Td>
                    <Td className="font-mono text-[10px] text-muted">
                      {txn.related_type ? `${txn.related_type}${txn.related_id ? ` · ${txn.related_id.slice(0, 14)}…` : ""}` : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(txn.created_at, true)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11.5px] text-muted">
        Showing up to 200 most recent entries. Use the CSV export for the full ledger. Every transaction stores the resulting
        balance for reconciliation.
      </p>
    </div>
  );
}
