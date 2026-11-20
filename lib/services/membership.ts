import { newId, one, query, tx } from "@/lib/db";
import { reference } from "./wallet";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { qualifyReferral } from "./referrals";

export type Plan = {
  id: string;
  name: string;
  description: string;
  price_cents: number;
  currency: string;
  benefits: string[];
  activation_requirements: string;
  is_active: boolean;
};

export type MembershipRecord = {
  id: string;
  user_id: string;
  plan_id: string;
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";
  activated_at: Date | null;
  created_at: Date;
  plan_name: string;
  price_cents: number;
  currency: string;
};

export async function getPlan(): Promise<Plan> {
  const row = await one<Plan & { benefits: unknown }>(
    `SELECT id, name, description, price_cents, currency, benefits, activation_requirements, is_active
       FROM membership_plans WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1`,
  );
  if (!row) {
    return {
      id: "plan_default",
      name: "Founding Membership",
      description: "One-time membership activation for the demonstration platform.",
      price_cents: 4900,
      currency: "USD",
      benefits: [],
      activation_requirements: "Complete the one-time DEMO payment to activate.",
      is_active: true,
    };
  }
  return {
    ...row,
    price_cents: Number(row.price_cents),
    benefits: Array.isArray(row.benefits) ? (row.benefits as string[]) : [],
  };
}

export async function getMembership(userId: string) {
  return one<MembershipRecord>(
    `SELECT m.id, m.user_id, m.plan_id, m.status, m.activated_at, m.created_at,
            p.name AS plan_name, p.price_cents, p.currency
       FROM memberships m JOIN membership_plans p ON p.id = m.plan_id
      WHERE m.user_id = $1`,
    [userId],
  );
}

export async function listPayments(userId: string) {
  return query<{
    id: string;
    reference: string;
    amount_cents: number;
    currency: string;
    method: string;
    status: string;
    failure_reason: string | null;
    paid_at: Date | null;
    created_at: Date;
  }>(
    `SELECT id, reference, amount_cents, currency, method, status, failure_reason, paid_at, created_at
       FROM membership_payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25`,
    [userId],
  );
}

export async function startMembershipPayment(userId: string, method: string) {
  const plan = await getPlan();
  const existing = await getMembership(userId);
  if (existing?.status === "ACTIVE") throw new Error("Your membership is already active.");
  const pending = await one<{ id: string; reference: string }>(
    `SELECT id, reference FROM membership_payments
      WHERE user_id = $1 AND status = 'PENDING' ORDER BY created_at DESC LIMIT 1`,
    [userId],
  );
  if (pending) return pending;
  const id = newId("pay");
  const ref = await reference("PAY");
  await query(
    `INSERT INTO membership_payments (id, reference, user_id, plan_id, amount_cents, currency, method)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [id, ref, userId, plan.id, plan.price_cents, plan.currency, method],
  );
  return { id, reference: ref };
}

/**
 * Demo payment simulation. The amount always comes from the plan on the
 * server; a client cannot choose how much it pays or whether it is valid.
 */
export async function simulateMembershipPayment(input: {
  paymentId: string;
  userId: string;
  outcome: "SUCCESS" | "FAILED";
  actorLabel?: string;
}) {
  const plan = await getPlan();
  const outcome = await tx(async (client) => {
    const rows = await client.query<{
      id: string;
      reference: string;
      user_id: string;
      amount_cents: number;
      status: string;
      plan_id: string;
    }>(`SELECT id, reference, user_id, amount_cents, status, plan_id FROM membership_payments WHERE id = $1 FOR UPDATE`, [
      input.paymentId,
    ]);
    const payment = rows.rows[0];
    if (!payment || payment.user_id !== input.userId) throw new Error("Payment record not found.");
    if (payment.status === "SUCCESS") throw new Error("This payment has already been completed.");
    if (payment.status !== "PENDING") throw new Error("This payment can no longer be processed.");

    if (input.outcome === "FAILED") {
      await client.query(
        `UPDATE membership_payments SET status = 'FAILED', failure_reason = $2 WHERE id = $1`,
        [payment.id, "Simulated card decline (demo)"],
      );
      return { success: false, reference: payment.reference };
    }

    // Server-side amount integrity check.
    if (payment.amount_cents !== plan.price_cents) {
      throw new Error("Payment amount no longer matches the current membership price. Please start again.");
    }

    await client.query(`UPDATE membership_payments SET status = 'SUCCESS', paid_at = now() WHERE id = $1`, [payment.id]);
    await client.query(
      `INSERT INTO memberships (id, user_id, plan_id, status, activated_at)
       VALUES ($1,$2,$3,'ACTIVE', now())
       ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', plan_id = EXCLUDED.plan_id,
         activated_at = now(), updated_at = now()`,
      [newId("mem"), payment.user_id, payment.plan_id],
    );
    await client.query(
      `UPDATE users SET account_status = 'ACTIVE', activated_at = COALESCE(activated_at, now()),
              status_reason = NULL, updated_at = now()
        WHERE id = $1 AND account_status = 'PENDING_ACTIVATION'`,
      [payment.user_id],
    );
    await notify(
      {
        userId: payment.user_id,
        type: "MEMBERSHIP",
        title: "Membership activated",
        body: "Your DEMO membership payment was simulated successfully. Your member features are now unlocked.",
        link: "/dashboard/membership",
      },
      client,
    );
    return { success: true, reference: payment.reference };
  });

  if (outcome.success) {
    await qualifyReferral(input.userId).catch((err) => console.error("[referral] qualification failed", err));
    await audit({
      actorLabel: input.actorLabel ?? "system:demo-payment",
      action: "membership.activated",
      targetType: "user",
      targetId: input.userId,
      metadata: { paymentReference: outcome.reference, simulated: true },
    });
  }
  return outcome;
}

export async function membershipHistory(userId: string) {
  return query<{ id: string; action: string; created_at: Date; metadata: Record<string, unknown> }>(
    `SELECT id, action, created_at, metadata FROM audit_logs
      WHERE target_id = $1 AND action LIKE 'membership.%' ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );
}
