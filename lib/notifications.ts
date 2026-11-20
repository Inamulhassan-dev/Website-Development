import type { PoolClient } from "pg";
import { newId, query, tx } from "./db";

type NotifyInput = {
  userId: string;
  type?: string;
  title: string;
  body?: string;
  link?: string;
};

type Executor = Pick<PoolClient, "query"> | null;

export async function notify(input: NotifyInput, client: Executor = null) {
  const sql = `INSERT INTO notifications (id, user_id, type, title, body, link)
               VALUES ($1,$2,$3,$4,$5,$6)`;
  const params = [newId("ntf"), input.userId, input.type ?? "SYSTEM", input.title, input.body ?? "", input.link ?? null];
  if (client) await client.query(sql, params);
  else await query(sql, params);
}

export async function notifyMany(userIds: string[], input: Omit<NotifyInput, "userId">) {
  if (!userIds.length) return;
  await tx(async (client) => {
    for (const userId of userIds) {
      await notify({ ...input, userId }, client);
    }
  });
}

export async function unreadNotificationCount(userId: string) {
  const rows = await query<{ count: string }>(
    "SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [userId],
  );
  return Number(rows[0]?.count ?? 0);
}
