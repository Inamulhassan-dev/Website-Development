import type { Metadata } from "next";
import { BadgeCheck, CircleDollarSign, Clock3, Receipt, UserCheck } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { recordManualActivationAction, updateMembershipPlanAction } from "@/lib/actions/admin";
import {
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
import { SubmitButton, Toggle } from "@/components/ui/interactive";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Memberships" };
export const dynamic = "force-dynamic";

export default async function AdminMembershipsPage() {
  await requireAdminPage("memberships.view");
  const [plan, stats, pending, payments, settings] = await Promise.all([
    one<{ id: string; name: string; description: string; price_cents: number; currency: string; benefits: unknown; activation_requirements: string; is_active: boolean }>(
      `SELECT id, name, description, price_cents, currency, benefits, activation_requirements, is_active
         FROM membership_plans ORDER BY created_at ASC LIMIT 1`,
    ),
    one<{ active: number; pending: number; revenue: number; failed: number; total_payments: number }>(
      `SELECT
        (SELECT count(*)::int FROM memberships WHERE status = 'ACTIVE') AS active,
        (SELECT count(*)::int FROM memberships WHERE status = 'PENDING') AS pending,
        (SELECT COALESCE(sum(amount_cents),0)::int FROM membership_payments WHERE status = 'SUCCESS') AS revenue,
        (SELECT count(*)::int FROM membership_payments WHERE status = 'FAILED') AS failed,
        (SELECT count(*)::int FROM membership_payments) AS total_payments`,
    ),
    query<{ id: string; member_id: string; full_name: string; email: string; account_status: string; membership_status: string; created_at: Date }>(
      `SELECT u.id, u.member_id, u.full_name, u.email, u.account_status, m.status AS membership_status, u.created_at
         FROM users u JOIN memberships m ON m.user_id = u.id
        WHERE u.role = 'MEMBER' AND m.status = 'PENDING'
        ORDER BY u.created_at ASC LIMIT 100`,
    ),
    query<{ id: string; reference: string; amount_cents: number; currency: string; method: string; status: string; created_at: Date; paid_at: Date | null; full_name: string; member_id: string; failure_reason: string | null }>(
      `SELECT p.id, p.reference, p.amount_cents, p.currency, p.method, p.status, p.created_at, p.paid_at,
              u.full_name, u.member_id, p.failure_reason
         FROM membership_payments p JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC LIMIT 30`,
    ),
    getSettings(),
  ]);

  const benefits = Array.isArray(plan?.benefits) ? (plan.benefits as string[]) : [];
  const s = stats ?? { active: 0, pending: 0, revenue: 0, failed: 0, total_payments: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Members"
        title="Memberships"
        description="Manage the membership plan, review DEMO payment activity and record manual activations with an audit trail."
        actions={<Badge tone={plan?.is_active ? "success" : "neutral"}>{plan?.is_active ? "Plan active" : "Plan inactive"}</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active memberships" value={s.active} icon={<BadgeCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Pending activation" value={s.pending} icon={<Clock3 className="h-5 w-5" />} tone="warning" />
        <StatCard label="DEMO revenue recorded" value={formatMoney(s.revenue, settings.currency)} icon={<CircleDollarSign className="h-5 w-5" />} />
        <StatCard label="Payment attempts" value={s.total_payments} hint={`${s.failed} failed`} icon={<Receipt className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader title="Membership plan" description="Used for new registrations and the DEMO payment amount." />
          <CardBody>
            {plan ? (
              <form action={updateMembershipPlanAction} className="space-y-4">
                <input type="hidden" name="planId" value={plan.id} />
                <Field label="Plan name" htmlFor="name">
                  <Input id="name" name="name" defaultValue={plan.name} required minLength={3} maxLength={120} />
                </Field>
                <Field label="Description" htmlFor="description">
                  <Textarea id="description" name="description" defaultValue={plan.description} maxLength={1000} className="min-h-[80px]" />
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label={`Price (${plan.currency})`} htmlFor="price" hint="Stored as integer cents server-side.">
                    <Input id="price" name="price" type="number" min="0" step="0.01" defaultValue={(Number(plan.price_cents) / 100).toFixed(2)} required />
                  </Field>
                  <Field label="Activation status" htmlFor="isActive">
                    <div className="flex h-11 items-center">
                      <Toggle name="isActive" defaultChecked={plan.is_active} label="Accept new activations" />
                    </div>
                  </Field>
                </div>
                <Field label="Benefits" htmlFor="benefits" hint="One benefit per line, up to 12.">
                  <Textarea id="benefits" name="benefits" defaultValue={benefits.join("\n")} maxLength={2000} className="min-h-[120px]" />
                </Field>
                <Field label="Activation requirements" htmlFor="requirements">
                  <Textarea id="requirements" name="requirements" defaultValue={plan.activation_requirements} maxLength={1000} className="min-h-[70px]" />
                </Field>
                <div className="flex justify-end">
                  <SubmitButton pendingLabel="Saving…">Save plan settings</SubmitButton>
                </div>
              </form>
            ) : (
              <EmptyState title="No membership plan found" description="Run the database seed to create the founding membership plan." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Manual activation" description="For verified cases when a DEMO payment cannot be completed." actions={<UserCheck className="h-4 w-4 text-muted" />} />
          <CardBody>
            {pending.length === 0 ? (
              <EmptyState icon={<BadgeCheck className="h-5 w-5" />} title="No pending activations" description="Every membership is active or has been decided." />
            ) : (
              <form action={recordManualActivationAction} className="space-y-3">
                <Field label="Member" htmlFor="userId">
                  <Select id="userId" name="userId" required>
                    {pending.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.full_name} · {member.member_id}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Reason" htmlFor="reason" hint="At least 8 characters. This is stored in the audit log.">
                  <Textarea id="reason" name="reason" required minLength={8} maxLength={500} placeholder="Verified DEMO payment outside the platform…" className="min-h-[80px]" />
                </Field>
                <SubmitButton className="w-full" pendingLabel="Recording…" confirm="Activate this membership and record a simulated payment?">
                  Record manual activation
                </SubmitButton>
              </form>
            )}
            <div className="mt-4 space-y-2 border-t border-line pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-muted">Pending members</p>
              {pending.slice(0, 6).map((member) => (
                <div key={member.id} className="flex items-center justify-between gap-2 text-[11.5px]">
                  <span className="truncate text-ink">{member.full_name}</span>
                  <span className="font-mono text-[10.5px] text-muted">{member.member_id}</span>
                </div>
              ))}
              {pending.length > 6 ? <p className="text-[10.5px] text-muted">+{pending.length - 6} more</p> : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Membership payments" description="Most recent 30 DEMO payment records across all members." actions={<Receipt className="h-4 w-4 text-muted" />} />
        {payments.length === 0 ? (
          <EmptyState icon={<Receipt className="h-5 w-5" />} title="No payments yet" />
        ) : (
          <TableWrap>
            <Table className="min-w-[820px]">
              <thead>
                <tr><Th>Reference</Th><Th>Member</Th><Th>Amount</Th><Th>Method</Th><Th>Status</Th><Th>Created</Th><Th>Paid</Th></tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <Tr key={payment.id}>
                    <Td className="font-mono text-[11.5px]">{payment.reference}</Td>
                    <Td>
                      <p className="font-medium text-navy">{payment.full_name}</p>
                      <p className="font-mono text-[10.5px] text-muted">{payment.member_id}</p>
                    </Td>
                    <Td className="font-medium">{formatMoney(payment.amount_cents, payment.currency)}</Td>
                    <Td className="text-muted">{payment.method.replaceAll("_", " ")}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[payment.status] ?? "neutral"}>{statusLabel(payment.status)}</Badge>
                      {payment.failure_reason ? <p className="mt-0.5 text-[10px] text-danger">{payment.failure_reason}</p> : null}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(payment.created_at, true)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(payment.paid_at, true)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11.5px] leading-relaxed text-muted">
        Manual activations insert a simulated payment record with method <span className="font-mono">ADMIN_RECORDED</span>,
        activate the membership and qualify any pending referral. All actions require a reason and appear in the audit log.
      </p>
    </div>
  );
}
