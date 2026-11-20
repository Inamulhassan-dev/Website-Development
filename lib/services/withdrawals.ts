import { newId, one, query, tx } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { reference, reserveWithdrawal, releaseWithdrawalHold, finalizeWithdrawal } from "./wallet";

export const WITHDRAWAL_METHODS = {
  BANK_TRANSFER: "Bank transfer (simulated)",
  OTHER: "Other approved method (simulated)",
  CRYPTO: "Crypto (display-only demo)",
} as const;

export type WithdrawalMethod = keyof typeof WITHDRAWAL_METHODS;

/** Never stores full account numbers. */
export function maskDestination(method: WithdrawalMethod, raw: string) {
  if (method === "CRYPTO") return "Crypto — display only, no wallet connected";
  const cleaned = raw.replace(/[^\w\s\-.]/g, "").trim().slice(0, 60);
  if (!cleaned) return "";
  const compact = cleaned.replace(/\s+/g, " ");
  const digits = compact.replace(/\D/g, "");
  if (digits.length >= 4) return `Demo account •••• ${digits.slice(-4)}`;
  return `Demo account •••• ${compact.slice(-4)}`;
}

export function looksSensitive(raw: string) {
  const value = raw.trim();
  if (/^(0x)?[a-fA-F0-9]{64}$/.test(value)) return true; // private key shape
  const words = value.split(/\s+/).filter(Boolean);
  return words.length >= 12 && words.every((w) => /^[a-z]+$/i.test(w)); // seed phrase shape
}

export async function requestWithdrawal(input: {
  userId: string;
  amountCents: number;
  method: WithdrawalMethod;
  destination: string;
  note?: string;
}) {
  const settings = await getSettings();
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Enter a valid amount.");
  if (input.amountCents < settings.min_withdrawal_cents) {
    throw new Error(`The minimum demo withdrawal is ${(settings.min_withdrawal_cents / 100).toFixed(2)}.`);
  }
  if (input.amountCents > settings.max_withdrawal_cents) {
    throw new Error(`The maximum demo withdrawal is ${(settings.max_withdrawal_cents / 100).toFixed(2)}.`);
  }
  if (looksSensitive(input.destination)) {
    throw new Error("Never enter private keys, seed phrases or real banking credentials. Use fictional, masked details.");
  }
  if (input.method !== "CRYPTO" && input.destination.trim().length < 4) {
    throw new Error("Add fictional destination details (for example, the last 4 digits of a demo account).");
  }
  const account = await one<{ account_status: string; membership_status: string | null }>(
    `SELECT u.account_status, m.status AS membership_status
       FROM users u LEFT JOIN memberships m ON m.user_id = u.id WHERE u.id = $1`,
    [input.userId],
  );
  if (!account) throw new Error("Account not found.");
  if (account.account_status !== "ACTIVE") throw new Error("Your account must be active to request a withdrawal.");
  if (account.membership_status !== "ACTIVE") throw new Error("An active membership is required to request a withdrawal.");

  const existing = await one<{ count: number }>(
    `SELECT count(*)::int AS count FROM withdrawal_requests
      WHERE user_id = $1 AND status IN ('PENDING','UNDER_REVIEW')`,
    [input.userId],
  );
  if (Number(existing?.count ?? 0) > 0) {
    throw new Error("You already have a withdrawal request awaiting review.");
  }

  return tx(async (client) => {
    const id = newId("wdr");
    const ref = await reference("WD");
    const masked = maskDestination(input.method, input.destination);
    await client.query(
      `INSERT INTO withdrawal_requests
         (id, reference, user_id, amount_cents, method, destination_masked, note, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PENDING')`,
      [id, ref, input.userId, input.amountCents, input.method, masked, input.note?.slice(0, 500) ?? null],
    );
    await reserveWithdrawal(client, {
      userId: input.userId,
      amountCents: input.amountCents,
      withdrawalId: id,
      note: `Withdrawal request ${ref} (demo)`,
    });
    await notify(
      {
        userId: input.userId,
        type: "WITHDRAWAL",
        title: "Withdrawal request submitted",
        body: `Your DEMO withdrawal request ${ref} is pending finance review. No real payout will be made.`,
        link: "/dashboard/withdrawals",
      },
      client,
    );
    return { id, reference: ref };
  });
}

export async function decideWithdrawal(input: {
  withdrawalId: string;
  adminId: string;
  adminLabel: string;
  decision: "APPROVE" | "REJECT";
  reason: string;
}) {
  const result = await tx(async (client) => {
    const rows = await client.query<{
      id: string;
      reference: string;
      user_id: string;
      amount_cents: number;
      status: string;
    }>(`SELECT id, reference, user_id, amount_cents, status FROM withdrawal_requests WHERE id = $1 FOR UPDATE`, [
      input.withdrawalId,
    ]);
    const request = rows.rows[0];
    if (!request) throw new Error("Withdrawal request not found.");
    if (!["PENDING", "UNDER_REVIEW"].includes(request.status)) {
      throw new Error("This request has already been decided.");
    }
    if (input.decision === "REJECT" && !input.reason.trim()) {
      throw new Error("A reason is required when rejecting a request.");
    }

    if (input.decision === "APPROVE") {
      await finalizeWithdrawal(client, {
        userId: request.user_id,
        amountCents: request.amount_cents,
        withdrawalId: request.id,
        adminId: input.adminId,
      });
      await client.query(
        `UPDATE withdrawal_requests SET status = 'APPROVED', decided_by = $2, decision_reason = $3,
                decided_at = now(), completed_at = now() WHERE id = $1`,
        [request.id, input.adminId, input.reason || "Approved (simulated payout)"],
      );
      await notify(
        {
          userId: request.user_id,
          type: "WITHDRAWAL",
          title: "Withdrawal approved (demo)",
          body: `Your demo withdrawal ${request.reference} was approved. This is a simulation — no real funds were sent.`,
          link: "/dashboard/withdrawals",
        },
        client,
      );
      return { status: "APPROVED", reference: request.reference };
    }

    await releaseWithdrawalHold(client, {
      userId: request.user_id,
      amountCents: request.amount_cents,
      withdrawalId: request.id,
      adminId: input.adminId,
      reason: input.reason,
    });
    await client.query(
      `UPDATE withdrawal_requests SET status = 'REJECTED', decided_by = $2, decision_reason = $3,
              decided_at = now() WHERE id = $1`,
      [request.id, input.adminId, input.reason],
    );
    await notify(
      {
        userId: request.user_id,
        type: "WITHDRAWAL",
        title: "Withdrawal request rejected",
        body: `Your demo withdrawal ${request.reference} was rejected. ${input.reason} The reserved demo balance has been released.`,
        link: "/dashboard/withdrawals",
      },
      client,
    );
    return { status: "REJECTED", reference: request.reference };
  });

  await audit({
    actorLabel: input.adminLabel,
    action: `withdrawal.${result.status.toLowerCase()}`,
    targetType: "withdrawal",
    targetId: input.withdrawalId,
    reason: input.reason,
    metadata: { reference: result.reference, simulated: true },
  });
  return result;
}

export async function listWithdrawals(userId: string) {
  return query<{
    id: string;
    reference: string;
    amount_cents: number;
    method: string;
    destination_masked: string;
    note: string | null;
    status: string;
    decision_reason: string | null;
    created_at: Date;
    decided_at: Date | null;
  }>(
    `SELECT id, reference, amount_cents, method, destination_masked, note, status, decision_reason,
            created_at, decided_at
       FROM withdrawal_requests WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
}
