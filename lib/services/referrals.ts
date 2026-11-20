import type { PoolClient } from "pg";
import { newId, one, query, tx } from "@/lib/db";
import { creditWallet } from "./wallet";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notifications";

export type ReferralRow = {
  id: string;
  referrer_id: string;
  referred_id: string;
  code: string;
  status: string;
  reward_cents: number;
  created_at: Date;
  qualified_at: Date | null;
  referred_name?: string;
  referred_member_id?: string;
};

/**
 * Attach a referral at registration time. Rejects self-referral (same email or
 * mobile) and duplicate attribution (unique index on referred_id).
 */
export async function attributeReferral(
  client: PoolClient,
  input: { newUserId: string; code: string; email: string; mobile: string },
) {
  const code = input.code.trim().toUpperCase();
  if (!code) return null;
  const referrer = await client.query<{ id: string; email: string; mobile: string; account_status: string }>(
    `SELECT id, email, mobile, account_status FROM users WHERE upper(referral_code) = $1 LIMIT 1`,
    [code],
  );
  const row = referrer.rows[0];
  if (!row) throw new Error("The referral code you entered is not valid.");
  if (row.id === input.newUserId || row.email.toLowerCase() === input.email.toLowerCase() || row.mobile === input.mobile) {
    throw new Error("You cannot use your own referral code.");
  }
  const id = newId("ref");
  await client.query(
    `INSERT INTO referrals (id, referrer_id, referred_id, code, status)
     VALUES ($1,$2,$3,$4,'PENDING') ON CONFLICT (referred_id) DO NOTHING`,
    [id, row.id, input.newUserId, code],
  );
  await client.query(`UPDATE users SET referred_by_id = $1 WHERE id = $2`, [row.id, input.newUserId]);
  return id;
}

/**
 * Called when a referred member activates their membership. Credits the
 * referrer exactly once (idempotent ledger key) when the programme is enabled.
 */
export async function qualifyReferral(referredUserId: string): Promise<{ rewarded: boolean; amountCents: number }> {
  const settings = await getSettings();
  const result = await tx(async (client) => {
    const res = await client.query<{
      id: string;
      referrer_id: string;
      status: string;
      referrer_name: string;
      referrer_status: string;
      referred_name: string;
    }>(
      `SELECT r.id, r.referrer_id, r.status, ref.full_name AS referrer_name,
              ref.account_status AS referrer_status, mem.full_name AS referred_name
         FROM referrals r
         JOIN users ref ON ref.id = r.referrer_id
         JOIN users mem ON mem.id = r.referred_id
        WHERE r.referred_id = $1
        FOR UPDATE`,
      [referredUserId],
    );
    const referral = res.rows[0];
    if (!referral || referral.status !== "PENDING") return { rewarded: false, amountCents: 0 };

    await client.query(
      `UPDATE referrals SET status = 'QUALIFIED', qualified_at = now() WHERE id = $1`,
      [referral.id],
    );

    if (!settings.referral_enabled || referral.referrer_status !== "ACTIVE" || settings.referral_reward_cents <= 0) {
      return { rewarded: false, amountCents: 0 };
    }

    const credit = await creditWallet(client, {
      userId: referral.referrer_id,
      amountCents: settings.referral_reward_cents,
      type: "REFERRAL_REWARD",
      description: `Demo referral reward — ${referral.referred_name} activated membership`,
      idempotencyKey: `referral:${referral.id}`,
      relatedType: "referral",
      relatedId: referral.id,
    });
    if (credit.duplicate) return { rewarded: false, amountCents: 0 };

    await client.query(
      `INSERT INTO referral_rewards (id, referral_id, user_id, amount_cents, transaction_id)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (referral_id) DO NOTHING`,
      [newId("rrw"), referral.id, referral.referrer_id, settings.referral_reward_cents, credit.transactionId],
    );
    await client.query(`UPDATE referrals SET status = 'REWARDED', reward_cents = $2 WHERE id = $1`, [
      referral.id,
      settings.referral_reward_cents,
    ]);
    await notify(
      {
        userId: referral.referrer_id,
        type: "REFERRAL",
        title: "Referral reward credited",
        body: `${referral.referred_name} activated their membership. A demo referral reward has been added to your wallet.`,
        link: "/dashboard/referrals",
      },
      client,
    );
    return { rewarded: true, amountCents: settings.referral_reward_cents };
  });
  return result;
}

export async function listReferrals(userId: string) {
  return query<ReferralRow & { referred_name: string; referred_member_id: string; referred_status: string; referred_activated_at: Date | null }>(
    `SELECT r.*, u.full_name AS referred_name, u.member_id AS referred_member_id,
            u.account_status AS referred_status, m.activated_at AS referred_activated_at
       FROM referrals r
       JOIN users u ON u.id = r.referred_id
       LEFT JOIN memberships m ON m.user_id = u.id
      WHERE r.referrer_id = $1
      ORDER BY r.created_at DESC`,
    [userId],
  );
}

export async function referralStats(userId: string) {
  const stats = await one<{ total: number; pending: number; qualified: number; rewarded: number; earned: number }>(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
            count(*) FILTER (WHERE status IN ('QUALIFIED','REWARDED'))::int AS qualified,
            count(*) FILTER (WHERE status = 'REWARDED')::int AS rewarded,
            COALESCE(sum(reward_cents) FILTER (WHERE status = 'REWARDED'), 0)::int AS earned
       FROM referrals WHERE referrer_id = $1`,
    [userId],
  );
  return stats ?? { total: 0, pending: 0, qualified: 0, rewarded: 0, earned: 0 };
}

export async function getReferrer(userId: string) {
  return one<{ full_name: string; member_id: string; email: string }>(
    `SELECT u.full_name, u.member_id, u.email
       FROM users u JOIN referrals r ON r.referrer_id = u.id
      WHERE r.referred_id = $1`,
    [userId],
  );
}
