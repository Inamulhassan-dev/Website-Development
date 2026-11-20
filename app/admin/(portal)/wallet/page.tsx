import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, Search, SlidersHorizontal, Wallet } from "lucide-react";
import { can, requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { adjustWalletAction } from "@/lib/actions/admin";
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
  Textarea,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { DonutChart } from "@/components/charts";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE, TXN_TYPE_LABELS, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Wallet ledger" };
export const dynamic = "force-dynamic";

export default async function AdminWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  const admin = await requireAdminPage("wallet.view");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const type = params.type && params.type !== "ALL" ? params.type : null;

  const [metrics, byType, topWallets, txns, members, settings] = await Promise.all([
    one<{ wallets: number; available: number; pending: number; credits: number; debits: number; txns: number }>(
      `SELECT (SELECT count(*)::int FROM wallets) AS wallets,
              (SELECT COALESCE(sum(available_cents),0)::int FROM wallets) AS available,
              (SELECT COALESCE(sum(pending_cents),0)::int FROM wallets) AS pending,
              (SELECT COALESCE(sum(amount_cents),0)::int FROM wallet_transactions WHERE direction = 'CREDIT' AND status = 'COMPLETED') AS credits,
              (SELECT COALESCE(sum(amount_cents),0)::int FROM wallet_transactions WHERE direction = 'DEBIT' AND status = 'COMPLETED') AS debits,
              (SELECT count(*)::int FROM wallet_transactions) AS txns`,
    ),
    query<{ type: string; direction: string; total: number }>(
      `SELECT type, direction, sum(amount_cents)::int AS total
         FROM wallet_transactions WHERE status = 'COMPLETED'
        GROUP BY type, direction ORDER BY total DESC`,
    ),
    query<{ user_id: string; full_name: string; member_id: string; email: string; available_cents: number; pending_cents: number; lifetime_credit_cents: number; membership_status: string | null }>(
      `SELECT w.user_id, u.full_name, u.member_id, u.email, w.available_cents, w.pending_cents, w.lifetime_credit_cents,
              m.status AS membership_status
         FROM wallets w JOIN users u ON u.id = w.user_id
         LEFT JOIN memberships m ON m.user_id = u.id
        ORDER BY w.available_cents DESC LIMIT 10`,
    ),
    query<{
      id: string; reference: string; type: string; direction: string; amount_cents: number; status: string;
      description: string; balance_after_cents: number; created_at: Date; full_name: string; member_id: string; user_id: string;
    }>(
      `SELECT t.id, t.reference, t.type, t.direction, t.amount_cents, t.status, t.description,
              t.balance_after_cents, t.created_at, u.full_name, u.member_id, u.id AS user_id
         FROM wallet_transactions t JOIN users u ON u.id = t.user_id
        WHERE ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.member_id ILIKE '%' || $1 || '%' OR t.reference ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR t.type = $2)
        ORDER BY t.created_at DESC LIMIT 60`,
      [q, type],
    ),
    query<{ id: string; full_name: string; member_id: string; available_cents: number }>(
      `SELECT u.id, u.full_name, u.member_id, COALESCE(w.available_cents,0)::int AS available_cents
         FROM users u LEFT JOIN wallets w ON w.user_id = u.id
        WHERE u.role = 'MEMBER' AND u.account_status = 'ACTIVE'
        ORDER BY u.full_name ASC LIMIT 300`,
    ),
    getSettings(),
  ]);

  const m = metrics ?? { wallets: 0, available: 0, pending: 0, credits: 0, debits: 0, txns: 0 };
  const palette: Record<string, string> = {
    AD_REWARD: "#1769E0",
    REFERRAL_REWARD: "#16A36A",
    ADMIN_ADJUSTMENT: "#E6A23C",
    WITHDRAWAL_REQUEST: "#8A99AF",
    WITHDRAWAL_REJECTION: "#9CC3F8",
    MEMBERSHIP_PAYMENT: "#10233F",
    REVERSAL: "#D64C4C",
  };
  const slices = byType.map((row) => ({
    name: `${TXN_TYPE_LABELS[row.type] ?? row.type}${row.direction === "DEBIT" ? " (debit)" : ""}`,
    value: Number(row.total),
    color: palette[row.type] ?? "#9CC3F8",
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Wallet ledger"
        description="Every demo balance is derived from an append-only transaction ledger. Review balances, trace entries and record controlled adjustments."
        actions={<Badge tone="brand">Simulated funds only</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available demo liability" value={formatMoney(m.available, settings.currency)} hint={`${m.wallets} member wallets`} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Reserved in withdrawals" value={formatMoney(m.pending, settings.currency)} hint="Pending finance review" icon={<ArrowUpRight className="h-5 w-5" />} tone="warning" />
        <StatCard label="Lifetime credits" value={formatMoney(m.credits, settings.currency)} hint="Rewards and adjustments" icon={<ArrowDownLeft className="h-5 w-5" />} tone="success" />
        <StatCard label="Ledger entries" value={m.txns} hint={`${formatMoney(m.debits, settings.currency)} lifetime debits`} icon={<CircleDollarSign className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.5fr]">
        <Card>
          <CardHeader title="Ledger composition" description="Completed entries by type and direction." />
          <CardBody>
            {slices.length ? (
              <DonutChart data={slices} height={265} centerValue={formatMoney(m.credits, settings.currency)} centerLabel="Lifetime credits" />
            ) : (
              <EmptyState icon={<Wallet className="h-5 w-5" />} title="No ledger entries yet" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Highest demo balances" description="Members ranked by available demo balance." />
          <TableWrap>
            <Table className="min-w-[620px]">
              <thead>
                <tr><Th>Member</Th><Th>Membership</Th><Th className="text-right">Available</Th><Th className="text-right">Reserved</Th><Th className="text-right">Lifetime</Th><Th /></tr>
              </thead>
              <tbody>
                {topWallets.map((row) => (
                  <Tr key={row.user_id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={row.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy">{row.full_name}</p>
                          <p className="font-mono text-[10px] text-muted">{row.member_id}</p>
                        </div>
                      </div>
                    </Td>
                    <Td><Badge tone={STATUS_TONE[row.membership_status ?? "PENDING"] ?? "neutral"}>{statusLabel(row.membership_status ?? "PENDING")}</Badge></Td>
                    <Td className="text-right font-semibold text-navy">{formatMoney(row.available_cents, settings.currency)}</Td>
                    <Td className="text-right text-muted">{formatMoney(row.pending_cents, settings.currency)}</Td>
                    <Td className="text-right text-muted">{formatMoney(row.lifetime_credit_cents, settings.currency)}</Td>
                    <Td><Link href={`/admin/users/${row.user_id}`} className="text-[12px] font-semibold text-brand hover:text-brand-dark">Open</Link></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      </div>

      {can(admin, "wallet.adjust") ? (
        <Card>
          <CardHeader
            title="Record a ledger adjustment"
            description="Use for corrections only. A reason is mandatory and every adjustment is audited."
            actions={<SlidersHorizontal className="h-4 w-4 text-muted" />}
          />
          <CardBody>
            <form action={adjustWalletAction} className="grid gap-3 lg:grid-cols-[1.4fr_0.7fr_0.7fr_1.6fr_auto] lg:items-end">
              <Field label="Member" htmlFor="userId">
                <Select id="userId" name="userId" required>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.full_name} · {member.member_id} · {formatMoney(member.available_cents, settings.currency)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Direction" htmlFor="direction">
                <Select id="direction" name="direction" defaultValue="CREDIT">
                  <option value="CREDIT">Credit</option>
                  <option value="DEBIT">Debit</option>
                </Select>
              </Field>
              <Field label="Amount (USD)" htmlFor="amount">
                <Input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
              </Field>
              <Field label="Reason" htmlFor="reason" hint="At least 5 characters; shown in the member notification.">
                <Textarea id="reason" name="reason" required minLength={5} maxLength={300} className="min-h-[44px] py-2 text-[13px]" placeholder="Explain the correction…" />
              </Field>
              <SubmitButton pendingLabel="Recording…" confirm="Record this ledger adjustment? It immediately changes the member's demo balance.">
                Record
              </SubmitButton>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Ledger entries"
          description="Search by member, Member ID or transaction reference."
          actions={<Link href="/api/admin/export?type=transactions" className="text-[12px] font-semibold text-brand hover:text-brand-dark">Export CSV</Link>}
        />
        <div className="border-b border-line p-4 sm:p-5">
          <form className="grid gap-2.5 sm:grid-cols-[1.6fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input name="q" defaultValue={q} placeholder="Search member or reference" className="pl-9" />
            </div>
            <Select name="type" defaultValue={type ?? "ALL"} aria-label="Transaction type">
              <option value="ALL">All transaction types</option>
              {Object.entries(TXN_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
            <SubmitButton variant="secondary">Apply</SubmitButton>
          </form>
        </div>
        {txns.length === 0 ? (
          <EmptyState icon={<Wallet className="h-5 w-5" />} title="No ledger entries match" description="Try a different search or clear the type filter." />
        ) : (
          <TableWrap>
            <Table className="min-w-[980px]">
              <thead>
                <tr><Th>Reference</Th><Th>Member</Th><Th>Type</Th><Th>Direction</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th className="text-right">Balance after</Th><Th>Created</Th></tr>
              </thead>
              <tbody>
                {txns.map((txn) => (
                  <Tr key={txn.id}>
                    <Td className="font-mono text-[11px]">{txn.reference}</Td>
                    <Td>
                      <Link href={`/admin/users/${txn.user_id}`} className="font-medium text-navy hover:text-brand">{txn.full_name}</Link>
                      <p className="font-mono text-[10px] text-muted">{txn.member_id}</p>
                    </Td>
                    <Td>
                      <p className="text-muted">{TXN_TYPE_LABELS[txn.type] ?? txn.type}</p>
                      <p className="line-clamp-1 max-w-[220px] text-[10.5px] text-muted">{txn.description}</p>
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
                    <Td className="whitespace-nowrap text-muted">{formatDate(txn.created_at, true)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11.5px] leading-relaxed text-muted">
        Balances are never edited directly. Credits, reservations, releases and adjustments all create immutable ledger entries
        with idempotency keys. This demonstration holds no real funds.
      </p>
    </div>
  );
}
