import type { PoolClient } from "pg";
import { newId, query, scalar, tx } from "@/lib/db";

export type WalletTxnType =
  | "AD_REWARD"
  | "REFERRAL_REWARD"
  | "MEMBERSHIP_PAYMENT"
  | "WITHDRAWAL_REQUEST"
  | "WITHDRAWAL_REJECTION"
  | "ADMIN_ADJUSTMENT"
  | "REVERSAL";

export async function reference(prefix: "PAY" | "TXN" | "WD" | "SUP" | "ADJ") {
  const n = Number(await scalar<string>("SELECT nextval('invoice_seq')::int AS value"));
  return `${prefix}-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`;
}

export async function ensureWallet(client: PoolClient, userId: string) {
  await client.query(
    `INSERT INTO wallets (id, user_id) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING`,
    [newId("wal"), userId],
  );
}

type CreditInput = {
  userId: string;
  amountCents: number;
  type: WalletTxnType;
  description: string;
  idempotencyKey?: string;
  relatedType?: string;
  relatedId?: string;
  createdBy?: string;
  status?: "PENDING" | "COMPLETED";
};

export type LedgerResult = {
  duplicate: boolean;
  transactionId: string;
  reference: string;
  balanceAfter: number;
};

/**
 * Credit a wallet inside an existing database transaction.
 * Idempotency is enforced by a unique key on wallet_transactions.
 */
export async function creditWallet(client: PoolClient, input: CreditInput): Promise<LedgerResult> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Credit amount must be a positive integer number of cents.");
  }
  if (input.idempotencyKey) {
    const existing = await client.query<{ id: string; reference: string; balance_after_cents: number }>(
      `SELECT id, reference, balance_after_cents FROM wallet_transactions WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    );
    if (existing.rows[0]) {
      return {
        duplicate: true,
        transactionId: existing.rows[0].id,
        reference: existing.rows[0].reference,
        balanceAfter: existing.rows[0].balance_after_cents,
      };
    }
  }
  await ensureWallet(client, input.userId);
  const wallet = await client.query<{ available_cents: number }>(
    `UPDATE wallets
        SET available_cents = available_cents + $2,
            lifetime_credit_cents = lifetime_credit_cents + $2,
            updated_at = now()
      WHERE user_id = $1
      RETURNING available_cents`,
    [input.userId, input.amountCents],
  );
  const balanceAfter = wallet.rows[0]?.available_cents ?? 0;
  const ref = await reference("TXN");
  const id = newId("txn");
  await client.query(
    `INSERT INTO wallet_transactions
       (id, reference, user_id, type, direction, amount_cents, status, description,
        balance_after_cents, related_type, related_id, idempotency_key, created_by)
     VALUES ($1,$2,$3,$4,'CREDIT',$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      id,
      ref,
      input.userId,
      input.type,
      input.amountCents,
      input.status ?? "COMPLETED",
      input.description,
      balanceAfter,
      input.relatedType ?? null,
      input.relatedId ?? null,
      input.idempotencyKey ?? null,
      input.createdBy ?? null,
    ],
  );
  return { duplicate: false, transactionId: id, reference: ref, balanceAfter };
}

/** Move available demo balance into pending, backing a withdrawal request. */
export async function reserveWithdrawal(
  client: PoolClient,
  input: { userId: string; amountCents: number; withdrawalId: string; note?: string },
) {
  await ensureWallet(client, input.userId);
  const wallet = await client.query<{ available_cents: number }>(
    `SELECT available_cents FROM wallets WHERE user_id = $1 FOR UPDATE`,
    [input.userId],
  );
  const available = wallet.rows[0]?.available_cents ?? 0;
  if (available < input.amountCents) {
    throw new Error("Requested amount exceeds the available demo balance.");
  }
  const updated = await client.query<{ available_cents: number }>(
    `UPDATE wallets
        SET available_cents = available_cents - $2,
            pending_cents = pending_cents + $2,
            lifetime_debit_cents = lifetime_debit_cents + $2,
            updated_at = now()
      WHERE user_id = $1
      RETURNING available_cents`,
    [input.userId, input.amountCents],
  );
  const ref = await reference("TXN");
  const txnId = newId("txn");
  await client.query(
    `INSERT INTO wallet_transactions
       (id, reference, user_id, type, direction, amount_cents, status, description,
        balance_after_cents, related_type, related_id, idempotency_key)
     VALUES ($1,$2,$3,'WITHDRAWAL_REQUEST','DEBIT',$4,'PENDING',$5,$6,'withdrawal',$7,$8)`,
    [
      txnId,
      ref,
      input.userId,
      input.amountCents,
      input.note?.trim() || "Withdrawal request (demo) — amount reserved",
      updated.rows[0]?.available_cents ?? 0,
      input.withdrawalId,
      `withdrawal:${input.withdrawalId}`,
    ],
  );
  return { transactionId: txnId, reference: ref, balanceAfter: updated.rows[0]?.available_cents ?? 0 };
}

export async function releaseWithdrawalHold(
  client: PoolClient,
  input: { userId: string; amountCents: number; withdrawalId: string; adminId: string; reason: string },
) {
  const original = await client.query<{ id: string }>(
    `SELECT id FROM wallet_transactions WHERE idempotency_key = $1`,
    [`withdrawal:${input.withdrawalId}`],
  );
  await client.query(
    `UPDATE wallets
        SET pending_cents = GREATEST(pending_cents - $2, 0),
            available_cents = available_cents + $2,
            updated_at = now()
      WHERE user_id = $1`,
    [input.userId, input.amountCents],
  );
  if (original.rows[0]) {
    // The hold stays in the ledger as a completed debit; the release is a
    // separate compensating credit so the audit trail is fully traceable.
    await client.query(`UPDATE wallet_transactions SET status = 'COMPLETED' WHERE id = $1`, [original.rows[0].id]);
  }
  const balanceAfter = Number(
    await scalar<string>(`SELECT available_cents AS v FROM wallets WHERE user_id = $1`, [input.userId]),
  );
  const ref = await reference("TXN");
  await client.query(
    `INSERT INTO wallet_transactions
       (id, reference, user_id, type, direction, amount_cents, status, description,
        balance_after_cents, related_type, related_id, idempotency_key, created_by)
     VALUES ($1,$2,$3,'WITHDRAWAL_REJECTION','CREDIT',$4,'COMPLETED',$5,$6,'withdrawal',$7,$8,$9)`,
    [
      newId("txn"),
      ref,
      input.userId,
      input.amountCents,
      `Withdrawal rejected — reserved demo balance released: ${input.reason}`,
      balanceAfter,
      input.withdrawalId,
      `withdrawal-release:${input.withdrawalId}`,
      input.adminId,
    ],
  );
  return { reference: ref, balanceAfter };
}

export async function finalizeWithdrawal(
  client: PoolClient,
  input: { userId: string; amountCents: number; withdrawalId: string; adminId: string },
) {
  await client.query(
    `UPDATE wallets
        SET pending_cents = GREATEST(pending_cents - $2, 0),
            updated_at = now()
      WHERE user_id = $1`,
    [input.userId, input.amountCents],
  );
  await client.query(
    `UPDATE wallet_transactions
        SET status = 'COMPLETED', created_by = COALESCE(created_by, $2)
      WHERE idempotency_key = $1`,
    [`withdrawal:${input.withdrawalId}`, input.adminId],
  );
}

export async function adminAdjustment(input: {
  userId: string;
  amountCents: number;
  direction: "CREDIT" | "DEBIT";
  reason: string;
  adminId: string;
}) {
  return tx(async (client) => {
    const ref = await reference("ADJ");
    if (input.direction === "CREDIT") {
      const result = await creditWallet(client, {
        userId: input.userId,
        amountCents: input.amountCents,
        type: "ADMIN_ADJUSTMENT",
        description: `Administrative adjustment — ${input.reason}`,
        createdBy: input.adminId,
        relatedType: "admin_adjustment",
        relatedId: ref,
      });
      return { ...result, reference: ref };
    }
    await ensureWallet(client, input.userId);
    const wallet = await client.query<{ available_cents: number }>(
      `SELECT available_cents FROM wallets WHERE user_id = $1 FOR UPDATE`,
      [input.userId],
    );
    const available = wallet.rows[0]?.available_cents ?? 0;
    if (available < input.amountCents) throw new Error("Adjustment exceeds the member's available balance.");
    const updated = await client.query<{ available_cents: number }>(
      `UPDATE wallets SET available_cents = available_cents - $2,
              lifetime_debit_cents = lifetime_debit_cents + $2, updated_at = now()
        WHERE user_id = $1 RETURNING available_cents`,
      [input.userId, input.amountCents],
    );
    const id = newId("txn");
    await client.query(
      `INSERT INTO wallet_transactions
         (id, reference, user_id, type, direction, amount_cents, status, description,
          balance_after_cents, related_type, related_id, created_by, idempotency_key)
       VALUES ($1,$2,$3,'ADMIN_ADJUSTMENT','DEBIT',$4,'COMPLETED',$5,$6,'admin_adjustment',$7,$8,$9)`,
      [
        id,
        ref,
        input.userId,
        input.amountCents,
        `Administrative adjustment — ${input.reason}`,
        updated.rows[0]?.available_cents ?? 0,
        ref,
        input.adminId,
        `adjustment:${ref}`,
      ],
    );
    return { duplicate: false, transactionId: id, reference: ref, balanceAfter: updated.rows[0]?.available_cents ?? 0 };
  });
}

export async function getWallet(userId: string) {
  const rows = await query<{
    available_cents: number;
    pending_cents: number;
    lifetime_credit_cents: number;
    lifetime_debit_cents: number;
    updated_at: Date;
  }>(`SELECT available_cents, pending_cents, lifetime_credit_cents, lifetime_debit_cents, updated_at
        FROM wallets WHERE user_id = $1`, [userId]);
  return (
    rows[0] ?? {
      available_cents: 0,
      pending_cents: 0,
      lifetime_credit_cents: 0,
      lifetime_debit_cents: 0,
      updated_at: new Date(),
    }
  );
}
