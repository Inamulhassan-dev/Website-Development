import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Banknote, Clock3, Sparkles, Wallet } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { getWallet } from "@/lib/services/wallet";
import { getSettings } from "@/lib/settings";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, StatCard } from "@/components/ui/primitives";
import { DonutChart } from "@/components/charts";
import { formatDate, formatMoney, relativeTime } from "@/lib/format";
import { STATUS_TONE, TXN_TYPE_LABELS, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "My wallet" };
export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const user = await requireMember("/dashboard/wallet");
  const [wallet, settings, txns, byType] = await Promise.all([
    getWallet(user.id),
    getSettings(),
    query<{ id: string; reference: string; type: string; direction: string; amount_cents: number; status: string; description: string; created_at: Date }>(
      `SELECT id, reference, type, direction, amount_cents, status, description, created_at
         FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [user.id],
    ),
    query<{ type: string; total: number }>(
      `SELECT type, sum(amount_cents)::int AS total FROM wallet_transactions
        WHERE user_id = $1 AND direction = 'CREDIT' AND type IN ('AD_REWARD','REFERRAL_REWARD','ADMIN_ADJUSTMENT')
        GROUP BY type ORDER BY total DESC`,
      [user.id],
    ),
  ]);

  const palette: Record<string, string> = {
    AD_REWARD: "#1769E0",
    REFERRAL_REWARD: "#16A36A",
    ADMIN_ADJUSTMENT: "#E6A23C",
  };
  const slices = byType.map((row) => ({ name: TXN_TYPE_LABELS[row.type] ?? row.type, value: Number(row.total), color: palette[row.type] ?? "#9CC3F8" }));
  const credited = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet"
        title="My demo wallet"
        description="A ledger-based demo balance. Every credit and debit is recorded, traceable and simulated."
        actions={<LinkButton href="/dashboard/withdrawals" size="sm" variant="secondary"><Banknote className="h-4 w-4" /> Withdrawals</LinkButton>}
      />

      <div className="overflow-hidden rounded-2xl bg-navy p-6 text-white shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/50">Available demo balance</p>
            <p className="mt-1.5 text-[34px] font-semibold tracking-tight">{formatMoney(wallet.available_cents, settings.currency)}</p>
            <p className="mt-1 text-[11.5px] text-white/55">No real funds are held. Withdrawals are simulated end to end.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-[12px]">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
              <p className="text-white/50">Pending review</p>
              <p className="mt-0.5 text-[15px] font-semibold">{formatMoney(wallet.pending_cents, settings.currency)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
              <p className="text-white/50">Lifetime credits</p>
              <p className="mt-0.5 text-[15px] font-semibold">{formatMoney(wallet.lifetime_credit_cents, settings.currency)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
              <p className="text-white/50">Lifetime debits</p>
              <p className="mt-0.5 text-[15px] font-semibold">{formatMoney(wallet.lifetime_debit_cents, settings.currency)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5">
              <p className="text-white/50">Updated</p>
              <p className="mt-0.5 text-[13px] font-medium">{relativeTime(wallet.updated_at)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Withdrawable now"
          value={formatMoney(Math.min(wallet.available_cents, settings.max_withdrawal_cents), settings.currency)}
          hint={`Minimum ${formatMoney(settings.min_withdrawal_cents, settings.currency)}`}
          icon={<ArrowUpRight className="h-5 w-5" />}
        />
        <StatCard
          label="Demo credits (all time)"
          value={formatMoney(credited, settings.currency)}
          hint="Rewards and adjustments"
          icon={<Sparkles className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Current status"
          value={wallet.pending_cents > 0 ? "Withdrawal pending" : "No holds"}
          hint={
            wallet.pending_cents > 0
              ? `${formatMoney(wallet.pending_cents, settings.currency)} reserved`
              : "Your full demo balance is available"
          }
          icon={<Clock3 className="h-5 w-5" />}
          tone={wallet.pending_cents > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader title="Credit composition" description="Where your demo balance came from." />
          <CardBody>
            {slices.length ? (
              <DonutChart
                data={slices}
                centerValue={formatMoney(credited, settings.currency)}
                centerLabel="Total credits"
                height={250}
              />
            ) : (
              <EmptyState icon={<Wallet className="h-5 w-5" />} title="No credits yet" description="Complete an advertisement or qualify a referral to receive a demo credit." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Recent ledger entries"
            description="Append-only, with references you can quote to support."
            actions={<LinkButton href="/dashboard/transactions" variant="ghost" size="sm">Full ledger</LinkButton>}
          />
          {txns.length === 0 ? (
            <EmptyState icon={<Wallet className="h-5 w-5" />} title="Your ledger is empty" />
          ) : (
            <div className="divide-y divide-line/70">
              {txns.map((txn) => (
                <div key={txn.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${txn.direction === "CREDIT" ? "bg-[#e9f8f1] text-success" : "bg-surface text-muted"}`}>
                    {txn.direction === "CREDIT" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">{TXN_TYPE_LABELS[txn.type] ?? txn.type}</p>
                    <p className="truncate text-[11px] text-muted">{txn.description}</p>
                    <p className="font-mono text-[10.5px] text-muted">{txn.reference}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-[12.5px] font-semibold ${txn.direction === "CREDIT" ? "text-success" : "text-ink"}`}>
                      {txn.direction === "CREDIT" ? "+" : "−"}
                      {formatMoney(txn.amount_cents, settings.currency)}
                    </p>
                    <Badge tone={STATUS_TONE[txn.status] ?? "neutral"} className="mt-0.5">
                      {statusLabel(txn.status)}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "Ledger integrity", body: "Balances are derived from an append-only ledger. Admin adjustments create explicit entries." },
          { title: "Simulated payouts", body: "Approved withdrawals are marked approved in the demo — no bank or crypto transfer occurs." },
          { title: "Need a correction?", body: "Quote the transaction reference in a support ticket and the team will review it." },
        ].map((item) => (
          <Card key={item.title} className="p-4">
            <p className="text-[13px] font-semibold text-navy">{item.title}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
          </Card>
        ))}
      </div>

      <p className="text-[11.5px] text-muted">
        Withdrawal limits: minimum {formatMoney(settings.min_withdrawal_cents, settings.currency)} and maximum{" "}
        {formatMoney(settings.max_withdrawal_cents, settings.currency)}.{" "}
        <Link href="/dashboard/withdrawals" className="font-semibold text-brand hover:text-brand-dark">
          Request a demo withdrawal
        </Link>
        .
      </p>
    </div>
  );
}
