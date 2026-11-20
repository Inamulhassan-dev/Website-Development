import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, CheckCircle2, CreditCard, Receipt, ShieldCheck, Sparkles } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getMembership, getPlan, listPayments } from "@/lib/services/membership";
import { createPaymentAction, simulatePaymentAction } from "@/lib/actions/member";
import { getSettings } from "@/lib/settings";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  LinkButton,
  PageHeader,
  Progress,
  Select,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "My membership" };
export const dynamic = "force-dynamic";

export default async function MembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const user = await requireMember("/dashboard/membership");
  const params = await searchParams;
  const [plan, membership, payments, settings] = await Promise.all([
    getPlan(),
    getMembership(user.id),
    listPayments(user.id),
    getSettings(),
  ]);

  const active = membership?.status === "ACTIVE";
  const pendingPayment = payments.find((payment) => payment.id === params.payment && payment.status === "PENDING");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Membership"
        title="My membership"
        description="One membership unlocks campaigns, advertisement sessions, demo rewards and referral qualification."
        actions={
          active ? (
            <Badge tone="success">
              <CheckCircle2 className="h-3.5 w-3.5" /> Active
            </Badge>
          ) : (
            <Badge tone="warning">Activation required</Badge>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card className="overflow-hidden">
          <div className="relative bg-navy px-6 py-6 text-white">
            <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-brand/30 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">
                <BadgeCheck className="h-4 w-4 text-[#7fb3ff]" /> {statusLabel(membership?.status ?? "PENDING")}
              </div>
              <h2 className="mt-2 text-[24px] font-semibold tracking-tight">{plan.name}</h2>
              <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-white/65">{plan.description}</p>
              <div className="mt-4 flex flex-wrap items-end gap-2">
                <span className="text-[30px] font-semibold tracking-tight">{formatMoney(plan.price_cents, plan.currency)}</span>
                <span className="pb-1 text-[12px] text-white/55">one-time DEMO activation</span>
              </div>
            </div>
          </div>
          <CardBody className="space-y-4">
            <div>
              <div className="mb-1.5 flex justify-between text-[11.5px] text-muted">
                <span>Activation progress</span>
                <span>{active ? "Complete" : params.payment ? "Payment simulated — choose an outcome" : "Payment required"}</span>
              </div>
              <Progress value={active ? 100 : params.payment ? 70 : 25} tone={active ? "success" : "brand"} />
            </div>
            {plan.benefits.length ? (
              <ul className="grid gap-2 text-[12.5px] sm:grid-cols-2">
                {plan.benefits.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2 text-ink">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {benefit}
                  </li>
                ))}
              </ul>
            ) : null}
            {plan.activation_requirements ? (
              <p className="rounded-xl bg-surface px-3.5 py-3 text-[12px] leading-relaxed text-muted">{plan.activation_requirements}</p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={active ? "Membership active" : "Activate membership"} description="This DEMO does not charge a card or move real money." />
          <CardBody className="space-y-4">
            {active ? (
              <>
                <div className="flex items-start gap-3 rounded-xl bg-[#e9f8f1] px-3.5 py-3 text-[12.5px] text-success">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    Active since {formatDate(membership?.activated_at)}. Campaigns, ad sessions and demo withdrawals are
                    unlocked.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <LinkButton href="/dashboard/ads" size="sm">
                    Watch advertisements
                  </LinkButton>
                  <LinkButton href="/dashboard/wallet" size="sm" variant="secondary">
                    Open wallet
                  </LinkButton>
                </div>
              </>
            ) : pendingPayment ? (
              <>
                <div className="rounded-xl border border-[#cfe2ff] bg-brandsoft px-3.5 py-3 text-[12px] leading-relaxed text-brand">
                  DEMO payment <span className="font-mono font-semibold">{pendingPayment.reference}</span> for{" "}
                  {formatMoney(pendingPayment.amount_cents, pendingPayment.currency)} is ready. Choose a simulated outcome.
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <form action={simulatePaymentAction}>
                    <input type="hidden" name="paymentId" value={pendingPayment.id} />
                    <input type="hidden" name="outcome" value="SUCCESS" />
                    <SubmitButton className="w-full" variant="success" pendingLabel="Activating…">
                      Simulate success
                    </SubmitButton>
                  </form>
                  <form action={simulatePaymentAction}>
                    <input type="hidden" name="paymentId" value={pendingPayment.id} />
                    <input type="hidden" name="outcome" value="FAILED" />
                    <SubmitButton className="w-full" variant="secondary" pendingLabel="Declining…">
                      Simulate failure
                    </SubmitButton>
                  </form>
                </div>
                <p className="text-[11px] leading-relaxed text-muted">
                  The server verifies the payment record, amount and ownership before activating. A failure can be retried
                  with a new payment.
                </p>
              </>
            ) : (
              <form action={createPaymentAction} className="space-y-4">
                <Field label="DEMO payment method" htmlFor="method" hint="No card details are collected or stored.">
                  <Select id="method" name="method" defaultValue="DEMO_CARD">
                    <option value="DEMO_CARD">Demo card (simulated)</option>
                    <option value="DEMO_BANK">Demo bank transfer (simulated)</option>
                    <option value="DEMO_WALLET">Demo wallet (simulated)</option>
                  </Select>
                </Field>
                <div className="rounded-xl border border-line bg-surface px-3.5 py-3 text-[12px] text-muted">
                  <div className="flex justify-between">
                    <span>Amount due</span>
                    <span className="font-semibold text-ink">{formatMoney(plan.price_cents, plan.currency)}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span>Billing</span>
                    <span className="font-medium text-ink">One-time DEMO activation</span>
                  </div>
                </div>
                <SubmitButton className="w-full" pendingLabel="Creating DEMO payment…">
                  <CreditCard className="h-4 w-4" /> Create DEMO payment
                </SubmitButton>
                <p className="text-[11px] text-muted">
                  By continuing you acknowledge this is a simulation. No income is promised and no real funds are moved.
                </p>
              </form>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Payment history"
          description="Every DEMO payment attempt and outcome."
          actions={<Receipt className="h-4 w-4 text-muted" />}
        />
        {payments.length === 0 ? (
          <EmptyState icon={<CreditCard className="h-5 w-5" />} title="No payments yet" description="Create a DEMO payment above to activate your membership." />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Reference</Th>
                  <Th>Amount</Th>
                  <Th>Method</Th>
                  <Th>Status</Th>
                  <Th>Created</Th>
                  <Th>Paid</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <Tr key={payment.id}>
                    <Td>
                      <span className="font-mono text-[12px]">{payment.reference}</span>
                    </Td>
                    <Td className="font-medium">{formatMoney(payment.amount_cents, payment.currency)}</Td>
                    <Td>{payment.method.replaceAll("_", " ")}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[payment.status] ?? "neutral"}>{statusLabel(payment.status)}</Badge>
                      {payment.failure_reason ? <p className="mt-1 text-[11px] text-danger">{payment.failure_reason}</p> : null}
                    </Td>
                    <Td className="text-muted">{formatDate(payment.created_at, true)}</Td>
                    <Td className="text-muted">{formatDate(payment.paid_at, true)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, title: "Server-validated", body: "Amount and plan are read from the database, never from the browser." },
          { icon: Sparkles, title: "Clearly simulated", body: "The platform is a demonstration. No real card is charged at any point." },
          { icon: AlertTriangle, title: "No income claims", body: "Rewards are demo credits. Nothing here is a promise of earnings." },
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

      <p className="text-[11.5px] text-muted">
        Need help with activation?{" "}
        <Link href="/dashboard/support" className="font-semibold text-brand hover:text-brand-dark">
          Open a support ticket
        </Link>
        .
      </p>
    </div>
  );
}
