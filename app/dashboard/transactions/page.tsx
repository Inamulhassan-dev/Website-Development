import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Filter, ReceiptText } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { getWallet } from "@/lib/services/wallet";
import { getSettings } from "@/lib/settings";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/primitives";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE, TXN_TYPE_LABELS, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

const TYPES = ["AD_REWARD", "REFERRAL_REWARD", "WITHDRAWAL_REQUEST", "WITHDRAWAL_REJECTION", "ADMIN_ADJUSTMENT"];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; direction?: string }>;
}) {
  const user = await requireMember("/dashboard/transactions");
  const params = await searchParams;
  const type = TYPES.includes(params.type ?? "") ? params.type! : null;
  const direction = ["CREDIT", "DEBIT"].includes(params.direction ?? "") ? params.direction! : null;

  const [wallet, settings, rows] = await Promise.all([
    getWallet(user.id),
    getSettings(),
    query<{ id: string; reference: string; type: string; direction: string; amount_cents: number; status: string; description: string; balance_after_cents: number; created_at: Date }>(
      `SELECT id, reference, type, direction, amount_cents, status, description, balance_after_cents, created_at
         FROM wallet_transactions
        WHERE user_id = $1
          AND ($2::text IS NULL OR type = $2)
          AND ($3::text IS NULL OR direction = $3)
        ORDER BY created_at DESC LIMIT 200`,
      [user.id, type, direction],
    ),
  ]);

  const credits = rows.filter((row) => row.direction === "CREDIT").reduce((sum, row) => sum + row.amount_cents, 0);
  const debits = rows.filter((row) => row.direction === "DEBIT").reduce((sum, row) => sum + row.amount_cents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet"
        title="Transactions"
        description="Your complete demo ledger. References are unique and can be quoted to support."
        actions={<Link href="/dashboard/wallet" className="text-[12.5px] font-semibold text-brand hover:text-brand-dark">Back to wallet</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Available balance" value={formatMoney(wallet.available_cents, settings.currency)} icon={<ReceiptText className="h-5 w-5" />} />
        <StatCard label="Credits in this view" value={formatMoney(credits, settings.currency)} icon={<ArrowDownLeft className="h-5 w-5" />} tone="success" />
        <StatCard label="Debits in this view" value={formatMoney(debits, settings.currency)} icon={<ArrowUpRight className="h-5 w-5" />} tone="warning" />
      </div>

      <Card>
        <CardHeader
          title="Ledger"
          description={`${rows.length} entr${rows.length === 1 ? "y" : "ies"} shown${type || direction ? " after filtering" : ""}.`}
          actions={
            <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
              <Filter className="h-3.5 w-3.5" /> Filters
            </div>
          }
        />
        <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3 sm:px-6">
          <Link
            href="/dashboard/transactions"
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition ${!type && !direction ? "bg-brand text-white" : "bg-surface text-muted hover:text-navy"}`}
          >
            All
          </Link>
          <Link
            href="/dashboard/transactions?direction=CREDIT"
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition ${direction === "CREDIT" ? "bg-brand text-white" : "bg-surface text-muted hover:text-navy"}`}
          >
            Credits
          </Link>
          <Link
            href="/dashboard/transactions?direction=DEBIT"
            className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition ${direction === "DEBIT" ? "bg-brand text-white" : "bg-surface text-muted hover:text-navy"}`}
          >
            Debits
          </Link>
          {["AD_REWARD", "REFERRAL_REWARD", "WITHDRAWAL_REQUEST", "ADMIN_ADJUSTMENT"].map((item) => (
            <Link
              key={item}
              href={`/dashboard/transactions?type=${item}`}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition ${type === item ? "bg-brand text-white" : "bg-surface text-muted hover:text-navy"}`}
            >
              {TXN_TYPE_LABELS[item]}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" />}
            title="No transactions match"
            description="Try clearing the filters, or complete an advertisement to create your first demo reward."
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Type</Th>
                  <Th>Description</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Balance after</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <span className="font-mono text-[11.5px]">{row.reference}</span>
                    </Td>
                    <Td>
                      <Badge tone={row.direction === "CREDIT" ? "success" : "neutral"}>
                        {row.direction === "CREDIT" ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {TXN_TYPE_LABELS[row.type] ?? row.type}
                      </Badge>
                    </Td>
                    <Td className="max-w-[280px]">
                      <span className="line-clamp-2 text-[12.5px] text-muted">{row.description}</span>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</Badge>
                    </Td>
                    <Td className={`text-right font-semibold ${row.direction === "CREDIT" ? "text-success" : "text-ink"}`}>
                      {row.direction === "CREDIT" ? "+" : "−"}
                      {formatMoney(row.amount_cents, settings.currency)}
                    </Td>
                    <Td className="text-right text-muted">{formatMoney(row.balance_after_cents, settings.currency)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(row.created_at, true)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11.5px] leading-relaxed text-muted">
        Pending entries represent demo withdrawal holds. A rejected or cancelled withdrawal releases the hold with a
        separate compensating credit, so the original request remains visible in the ledger.
      </p>
    </div>
  );
}
