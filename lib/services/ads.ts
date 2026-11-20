import { newId, one, query, tx } from "@/lib/db";
import { creditWallet } from "./wallet";
import { notify } from "@/lib/notifications";

export type MemberAd = {
  id: string;
  code: string;
  title: string;
  description: string;
  advertiser_name: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  reward_cents: number;
  required_watch_seconds: number;
  start_date: string;
  end_date: string;
  campaign_id: string;
  campaign_name: string;
  bundle_name: string | null;
};

const AD_SELECT = `
  SELECT a.id, a.code, a.title, a.description, a.advertiser_name, a.video_url, a.thumbnail_url,
         a.duration_seconds, a.reward_cents, a.required_watch_seconds,
         to_char(a.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(a.end_date, 'YYYY-MM-DD') AS end_date,
         c.id AS campaign_id, c.name AS campaign_name,
         (SELECT b.name FROM bundle_advertisements ba JOIN bundles b ON b.id = ba.bundle_id
           WHERE ba.advertisement_id = a.id AND b.status = 'ACTIVE'
           ORDER BY b.display_order LIMIT 1) AS bundle_name
    FROM advertisements a
    JOIN campaigns c ON c.id = a.campaign_id`;

const ELIGIBILITY = `
  a.status = 'ACTIVE' AND c.status = 'ACTIVE'
  AND CURRENT_DATE BETWEEN a.start_date AND a.end_date
  AND (
    NOT EXISTS (SELECT 1 FROM bundle_advertisements bx WHERE bx.advertisement_id = a.id)
    OR EXISTS (
      SELECT 1 FROM bundle_advertisements ba
      JOIN bundles b ON b.id = ba.bundle_id
      LEFT JOIN member_bundles mb ON mb.bundle_id = b.id AND mb.user_id = $1
      WHERE ba.advertisement_id = a.id AND b.status = 'ACTIVE'
        AND (b.eligibility = 'ALL_MEMBERS' OR mb.user_id IS NOT NULL)
    )
  )`;

export async function listAvailableAds(userId: string) {
  return query<MemberAd>(
    `${AD_SELECT}
      WHERE ${ELIGIBILITY}
        AND NOT EXISTS (
          SELECT 1 FROM ad_sessions s
           WHERE s.user_id = $1 AND s.advertisement_id = a.id AND s.status = 'COMPLETED')
      ORDER BY a.display_order ASC, a.created_at DESC`,
    [userId],
  );
}

export async function countAvailableAds(userId: string) {
  const row = await one<{ count: number }>(
    `SELECT count(*)::int AS count FROM advertisements a JOIN campaigns c ON c.id = a.campaign_id
      WHERE ${ELIGIBILITY}
        AND NOT EXISTS (SELECT 1 FROM ad_sessions s WHERE s.user_id = $1
              AND s.advertisement_id = a.id AND s.status = 'COMPLETED')`,
    [userId],
  );
  return Number(row?.count ?? 0);
}

export async function getAdForMember(userId: string, adId: string) {
  return one<MemberAd>(`${AD_SELECT} WHERE a.id = $2 AND ${ELIGIBILITY} LIMIT 1`, [userId, adId]);
}

async function assertEligibleMember(userId: string) {
  const row = await one<{ account_status: string; membership_status: string | null }>(
    `SELECT u.account_status, m.status AS membership_status
       FROM users u LEFT JOIN memberships m ON m.user_id = u.id WHERE u.id = $1`,
    [userId],
  );
  if (!row) throw new Error("Account not found.");
  if (row.account_status !== "ACTIVE") throw new Error("Your account is not active. Please contact support.");
  if (row.membership_status !== "ACTIVE") throw new Error("An active membership is required to watch advertisements.");
}

export type AdSessionView = {
  id: string;
  advertisement_id: string;
  status: string;
  started_at: string;
  expires_at: string;
  watched_seconds: number;
  required_seconds: number;
  reward_cents: number;
  completed_at: string | null;
};

export async function getSession(userId: string, sessionId: string) {
  return one<AdSessionView>(
    `SELECT id, advertisement_id, status,
            to_char(started_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS started_at,
            to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS expires_at,
            watched_seconds, required_seconds, reward_cents,
            to_char(completed_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS completed_at
       FROM ad_sessions WHERE id = $1 AND user_id = $2`,
    [sessionId, userId],
  );
}

/** Create (or resume) a server-side ad session. The browser cannot invent one. */
export async function startAdSession(userId: string, adId: string, meta: { ip: string; userAgent: string }) {
  await assertEligibleMember(userId);
  const ad = await getAdForMember(userId, adId);
  if (!ad) throw new Error("This advertisement is not available for your account.");

  const active = await one<AdSessionView>(
    `SELECT id, advertisement_id, status,
            to_char(started_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS started_at,
            to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS expires_at,
            watched_seconds, required_seconds, reward_cents, NULL AS completed_at
       FROM ad_sessions
      WHERE user_id = $1 AND advertisement_id = $2
        AND status IN ('STARTED','IN_PROGRESS','PAUSED') AND expires_at > now()
      ORDER BY started_at DESC LIMIT 1`,
    [userId, adId],
  );
  if (active) return { session: active, resumed: true, ad };

  await query(
    `UPDATE ad_sessions SET status = 'EXPIRED', invalid_reason = 'Session expired before completion'
      WHERE user_id = $1 AND advertisement_id = $2 AND status IN ('STARTED','IN_PROGRESS','PAUSED') AND expires_at <= now()`,
    [userId, adId],
  );

  return tx(async (client) => {
    const id = newId("ads");
    const required = Math.max(5, Math.min(ad.required_watch_seconds, ad.duration_seconds));
    const inserted = await client.query<AdSessionView>(
      `INSERT INTO ad_sessions
         (id, user_id, advertisement_id, campaign_id, status, watched_seconds, required_seconds,
          reward_cents, expires_at, ip, user_agent)
       VALUES ($1,$2,$3,$4,'STARTED',0,$5,$6, now() + interval '60 minutes', $7, $8)
       RETURNING id, advertisement_id, status,
         to_char(started_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS started_at,
         to_char(expires_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS expires_at,
         watched_seconds, required_seconds, reward_cents, NULL AS completed_at`,
      [id, userId, ad.id, ad.campaign_id, required, ad.reward_cents, meta.ip, meta.userAgent],
    );
    await client.query(
      `INSERT INTO ad_session_events (id, session_id, type, payload) VALUES ($1,$2,'STARTED',$3::jsonb)`,
      [newId("evt"), id, JSON.stringify({ adId: ad.id, requiredSeconds: required })],
    );
    return { session: inserted.rows[0], resumed: false, ad };
  });
}

/** Server-validated playback heartbeat. Progress can never run ahead of real elapsed time. */
export async function reportProgress(input: {
  userId: string;
  sessionId: string;
  deltaSeconds: number;
  hidden: boolean;
}) {
  return tx(async (client) => {
    const rows = await client.query<{
      id: string;
      user_id: string;
      status: string;
      watched_seconds: number;
      required_seconds: number;
      reward_cents: number;
      elapsed: number;
      expired: boolean;
      risk_score: number;
    }>(
      `SELECT id, user_id, status, watched_seconds, required_seconds, reward_cents, risk_score,
              EXTRACT(EPOCH FROM (now() - started_at))::float AS elapsed,
              (expires_at <= now()) AS expired
         FROM ad_sessions WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [input.sessionId, input.userId],
    );
    const session = rows.rows[0];
    if (!session) return { ok: false as const, code: "NOT_FOUND" as const };

    if (session.status === "COMPLETED") {
      return {
        ok: true as const,
        status: "COMPLETED",
        watchedSeconds: session.watched_seconds,
        requiredSeconds: session.required_seconds,
        riskScore: session.risk_score,
      };
    }
    if (["EXPIRED", "INVALIDATED", "FLAGGED"].includes(session.status)) {
      return { ok: false as const, code: session.status };
    }
    if (session.expired) {
      await client.query(
        `UPDATE ad_sessions SET status = 'EXPIRED', invalid_reason = 'Playback session expired' WHERE id = $1`,
        [session.id],
      );
      await client.query(`INSERT INTO ad_session_events (id, session_id, type) VALUES ($1,$2,'EXPIRED')`, [
        newId("evt"),
        session.id,
      ]);
      return { ok: false as const, code: "EXPIRED" as const };
    }

    let risk = session.risk_score;
    let accepted = 0;
    let status = session.status === "PAUSED" ? "IN_PROGRESS" : "IN_PROGRESS";

    if (input.hidden) {
      risk += 4;
      status = "PAUSED";
      await client.query(
        `INSERT INTO ad_session_events (id, session_id, type) VALUES ($1,$2,'VISIBILITY_HIDDEN')`,
        [newId("evt"), session.id],
      );
    } else {
      const rawDelta = Math.floor(Number(input.deltaSeconds) || 0);
      const delta = Math.max(0, Math.min(rawDelta, 10));
      if (rawDelta > Math.floor(session.elapsed) + 6) {
        risk += 12;
      }
      accepted = Math.min(delta, Math.max(0, Math.ceil(session.elapsed) + 2 - session.watched_seconds));
    }

    const watched = Math.min(session.required_seconds, session.watched_seconds + accepted);
    const flagged = risk >= 40;
    if (flagged) status = "FLAGGED";

    await client.query(
      `UPDATE ad_sessions SET watched_seconds = $2, status = $3, risk_score = $4,
              last_activity_at = now(), flag_reason = CASE WHEN $5 THEN COALESCE(flag_reason, 'Automated risk threshold reached') ELSE flag_reason END
        WHERE id = $1`,
      [session.id, watched, status, risk, flagged],
    );
    if (accepted > 0) {
      await client.query(
        `INSERT INTO ad_session_events (id, session_id, type, payload) VALUES ($1,$2,'PROGRESS',$3::jsonb)`,
        [newId("evt"), session.id, JSON.stringify({ accepted, watched, hidden: input.hidden })],
      );
    }
    return {
      ok: !flagged,
      status,
      watchedSeconds: watched,
      requiredSeconds: session.required_seconds,
      riskScore: risk,
      code: flagged ? ("FLAGGED" as const) : undefined,
    };
  });
}

/** Completion is decided using database timestamps and stored watch progress only. */
export async function completeAdSession(userId: string, sessionId: string) {
  const outcome = await tx(async (client) => {
    const rows = await client.query<{
      id: string;
      status: string;
      advertisement_id: string;
      watched_seconds: number;
      required_seconds: number;
      reward_cents: number;
      elapsed: number;
      expired: boolean;
      title: string;
      campaign_id: string;
    }>(
      `SELECT s.id, s.status, s.advertisement_id, s.watched_seconds, s.required_seconds, s.reward_cents,
              EXTRACT(EPOCH FROM (now() - s.started_at))::float AS elapsed, (s.expires_at <= now()) AS expired,
              a.title, s.campaign_id
         FROM ad_sessions s JOIN advertisements a ON a.id = s.advertisement_id
        WHERE s.id = $1 AND s.user_id = $2 FOR UPDATE OF s`,
      [sessionId, userId],
    );
    const session = rows.rows[0];
    if (!session) return { ok: false as const, message: "Session not found." };

    if (session.status === "COMPLETED") {
      return { ok: true as const, duplicate: true, rewardCents: 0, message: "This advertisement is already completed." };
    }
    if (session.expired) {
      await client.query(`UPDATE ad_sessions SET status = 'EXPIRED', invalid_reason = 'Expired before completion' WHERE id = $1`, [
        session.id,
      ]);
      return { ok: false as const, message: "This viewing session has expired. Please start again." };
    }

    const enoughTime = session.elapsed + 1 >= session.required_seconds;
    const enoughWatch = session.watched_seconds + 1 >= session.required_seconds;
    if (!enoughTime || !enoughWatch) {
      await client.query(
        `UPDATE ad_sessions SET status = 'FLAGGED',
                flag_reason = $2 WHERE id = $1`,
        [
          session.id,
          `Completion attempted before requirements were met (watched ${Math.floor(session.watched_seconds)}s / ${session.required_seconds}s, elapsed ${Math.floor(session.elapsed)}s)`,
        ],
      );
      await client.query(`INSERT INTO ad_session_events (id, session_id, type, payload) VALUES ($1,$2,'FLAGGED',$3::jsonb)`, [
        newId("evt"),
        session.id,
        JSON.stringify({ watched: session.watched_seconds, elapsed: Math.floor(session.elapsed) }),
      ]);
      return {
        ok: false as const,
        flagged: true,
        message: "The completion requirements were not met on the server. This session was flagged for review.",
      };
    }

    await client.query(`UPDATE ad_sessions SET status = 'COMPLETED', completed_at = now(), watched_seconds = required_seconds WHERE id = $1`, [
      session.id,
    ]);
    const credit = await creditWallet(client, {
      userId,
      amountCents: session.reward_cents,
      type: "AD_REWARD",
      description: `Demo reward — ${session.title}`,
      idempotencyKey: `ad-session:${session.id}`,
      relatedType: "ad_session",
      relatedId: session.id,
    });
    await notify(
      {
        userId,
        type: "REWARD",
        title: "Demo reward credited",
        body: `You completed "${session.title}". A demo reward was added to your wallet.`,
        link: "/dashboard/wallet",
      },
      client,
    );
    await client.query(
      `INSERT INTO ad_session_events (id, session_id, type, payload) VALUES ($1,$2,'COMPLETED',$3::jsonb)`,
      [newId("evt"), session.id, JSON.stringify({ rewardCents: session.reward_cents, duplicate: credit.duplicate })],
    );
    return {
      ok: true as const,
      duplicate: credit.duplicate,
      rewardCents: credit.duplicate ? 0 : session.reward_cents,
      message: "Advertisement completed. Demo reward credited.",
    };
  });
  return outcome;
}

export async function memberAdStats(userId: string) {
  const row = await one<{
    completed: number;
    started: number;
    flagged: number;
    invalid: number;
    earned: number;
  }>(
    `SELECT count(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
            count(*)::int AS started,
            count(*) FILTER (WHERE status = 'FLAGGED')::int AS flagged,
            count(*) FILTER (WHERE status IN ('INVALIDATED','EXPIRED'))::int AS invalid,
            COALESCE(sum(reward_cents) FILTER (WHERE status = 'COMPLETED'), 0)::int AS earned
       FROM ad_sessions WHERE user_id = $1`,
    [userId],
  );
  return row ?? { completed: 0, started: 0, flagged: 0, invalid: 0, earned: 0 };
}

export async function adHistory(userId: string) {
  return query<{
    id: string;
    title: string;
    campaign_name: string;
    status: string;
    reward_cents: number;
    watched_seconds: number;
    required_seconds: number;
    started_at: Date;
    completed_at: Date | null;
    flag_reason: string | null;
  }>(
    `SELECT s.id, a.title, c.name AS campaign_name, s.status, s.reward_cents,
            s.watched_seconds, s.required_seconds, s.started_at, s.completed_at, s.flag_reason
       FROM ad_sessions s
       JOIN advertisements a ON a.id = s.advertisement_id
       JOIN campaigns c ON c.id = s.campaign_id
      WHERE s.user_id = $1 ORDER BY s.started_at DESC LIMIT 100`,
    [userId],
  );
}

export async function expireStaleSessions(userId: string) {
  await query(
    `UPDATE ad_sessions SET status = 'EXPIRED', invalid_reason = 'Session expired'
      WHERE user_id = $1 AND status IN ('STARTED','IN_PROGRESS','PAUSED') AND expires_at <= now()`,
    [userId],
  );
}
