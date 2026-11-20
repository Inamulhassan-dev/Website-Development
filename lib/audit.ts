import { newId, query } from "./db";
import type { SessionUser } from "./auth";

type AuditInput = {
  actor?: SessionUser | null;
  actorLabel?: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
};

/** Append-only audit trail. Never throws into the caller's workflow. */
export async function audit(input: AuditInput) {
  try {
    await query(
      `INSERT INTO audit_logs (id, actor_id, actor_label, action, target_type, target_id, reason, metadata, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`,
      [
        newId("aud"),
        input.actor?.id ?? null,
        input.actorLabel ?? input.actor?.email ?? "system",
        input.action,
        input.targetType,
        input.targetId ?? null,
        input.reason ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.ip ?? null,
      ],
    );
  } catch (err) {
    console.error("[audit] failed to record event", input.action, err);
  }
}
