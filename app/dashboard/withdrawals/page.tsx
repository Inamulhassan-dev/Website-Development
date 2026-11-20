import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Banknote, Clock3, Info, ShieldCheck, Wallet } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getWallet } from "@/lib/services/wallet";
import { listWithdrawals, WITHDRAWAL_METHODS } from "@/lib/services/withdrawals";
import { requestWithdrawalAction, cancelWithdrawalAction } from "@/lib/actions/member";
import { getSettings } from "@/lib/settings";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, PageHeader, Select, StatCard, Textarea } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Withdrawals" };
export const dynamic = "force-dynamic";

export default async function WithdrawalsPage() {
  const user = await requireMember("/dashboard/withdrawals");
  const [wallet, settings, rows] = await Promise.all([getWallet(user.id), getSettings(), listWithdrawals(user.id)]);
  const open = rows.find((row) => ["PENDING", "UNDER_REVIEW"].includes(row.status));
  const maxDollars = (wallet.available_cents / 100).toFixed(2);
  const minDollars = (settings.min_withdrawal_cents / 100).toFixed(2);
  const approvedTotal = rows.filter((row) => row.status === "APPROVED").reduce((sum, row) => sum + row.amount_cents, 0);
  const pendingTotal = rows.filter((row) => ["PENDING", "UNDER_REVIEW"].includes(row.status)).reduce((sum, row) => sum + row.amount_cents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet"
        title="Withdrawals"
        description="Request a simulated payout from your demo balance. Finance reviews each request; no real money is sent."
        actions={<Link href="/dashboard/wallet" className="text-[12.5px] font-semibold text-brand hover:text-brand-dark">Back to wallet</Link>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Available balance" value={formatMoney(wallet.available_cents, settings.currency)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Reserved for review" value={formatMoney(pendingTotal, settings.currency)} icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard label="Approved (demo)" value={formatMoney(approvedTotal, settings.currency)} icon={<Banknote className="h-5 w-5" />} tone="success" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1.35fr]">
        <Card className="h-fit">
          <CardHeader title="Request a demo withdrawal" description="One open request at a time." />
          <CardBody>
            {open ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-xl border border-[#f4e2bd] bg-[#fffaf0] px-3.5 py-3 text-[12px] text-[#8a6114]">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Request <span className="font-mono font-semibold">{open.reference}</span> for{" "}
                    {formatMoney(open.amount_cents, settings.currency)} is awaiting review. You can cancel it below.
                  </p>
                </div>
                <form action={cancelWithdrawalAction}>
                  <input type="hidden" name="withdrawalId" value={open.id} />
                  <SubmitButton
                    variant="secondary"
                    className="w-full"
                    pendingLabel="Cancelling…"
                    confirm="Cancel this demo withdrawal and release the reserved balance back to your wallet?"
                  >
                    Cancel request
                  </SubmitButton>
                </form>
              </div>
            ) : (
              <form action={requestWithdrawalAction} className="space-y-4">
                <Field label="Amount (USD)" htmlFor="amount" hint={`Available ${formatMoney(wallet.available_cents, settings.currency)} · minimum ${minDollars}`}>
                  <Input
                    id="amount"
                    name="amount"
                    type="number"
                    min={minDollars}
                    max={maxDollars}
                    step="0.01"
                    placeholder="0.00"
                    defaultValue={wallet.available_cents >= settings.min_withdrawal_cents ? maxDollars : ""}
                    required
                  />
                </Field>
                <Field label="Method" htmlFor="method">
                  <Select id="method" name="method" defaultValue="BANK_TRANSFER">
                    {Object.entries(WITHDRAWAL_METHODS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Fictional destination details"
                  htmlFor="destination"
                  hint="Example: demo account ending 4242. Never enter real banking credentials, private keys or seed phrases."
                >
                  <Input id="destination" name="destination" placeholder="Demo account •••• 4242" maxLength={80} />
                </Field>
                <Field label="Note (optional)" htmlFor="note">
                  <Textarea id="note" name="note" placeholder="Anything finance should know about this demo request." maxLength={500} className="min-h-[80px]" />
                </Field>
                <SubmitButton className="w-full" pendingLabel="Submitting request…">
                  Submit demo request
                </SubmitButton>
                {wallet.available_cents < settings.min_withdrawal_cents ? (
                  <p className="flex items-start gap-1.5 text-[11.5px] text-warning">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Your available demo balance is below the minimum withdrawal amount.
                  </p>
                ) : null}
              </form>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Request history" description="Decisions are recorded with reasons where applicable." />
          <CardBody className="space-y-3">
            {rows.length === 0 ? (
              <EmptyState icon={<Banknote className="h-5 w-5" />} title="No withdrawal requests" description="When you request a demo payout, it will appear here with its review status." />
            ) : (
              rows.map((row) => (
                <div key={row.id} className="rounded-xl border border-line p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11.5px] text-muted">{row.reference}</p>
                      <p className="mt-0.5 text-[16px] font-semibold text-navy">{formatMoney(row.amount_cents, settings.currency)}</p>
                    </div>
                    <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</Badge>
                  </div>
                  <div className="mt-2 grid gap-1 text-[11.5px] text-muted sm:grid-cols-2">
                    <p>Method: <span className="text-ink">{WITHDRAWAL_METHODS[row.method as keyof typeof WITHDRAWAL_METHODS] ?? row.method}</span></p>
                    <p>Destination: <span className="text-ink">{row.destination_masked}</span></p>
                    <p>Requested: <span className="text-ink">{formatDate(row.created_at, true)}</span></p>
                    <p>Decided: <span className="text-ink">{formatDate(row.decided_at, true)}</span></p>
                  </div>
                  {row.decision_reason ? (
                    <p className="mt-2 rounded-lg bg-surface px-2.5 py-1.5 text-[11.5px] leading-relaxed text-muted">{row.decision_reason}</p>
                  ) : null}
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "No real payouts", body: "Approval marks the request as approved in the demo. No bank, card or crypto transfer is made." },
          { icon: Info, title: "Masked destinations", body: "Only the last four characters of fictional details are stored and displayed." },
          { icon: AlertTriangle, title: "Never share secrets", body: "The platform rejects private keys and seed phrases. Never enter real financial credentials." },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="p-4">
              <Icon className="h-5 w-5 text-brand" />
              <p className="mt-2 text-[13px] font-semibold text-navy">{item.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
