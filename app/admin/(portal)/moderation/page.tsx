import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Eye, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { resolveFlaggedSessionAction } from "@/lib/actions/admin";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatDuration, formatMoney, relativeTime } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Moderation" };
export const dynamic = "force-dynamic";

export default async function AdminModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminPage("moderation.manage");
  const params = await searchParams;
  const status = ["FLAGGED", "INVALIDATED", "EXPIRED"].includes(params.status ?? "") ? params.status! : "FLAGGED";

  const [sessions, stats, recentActions] = await Promise.all([
    query<{
      id: string;
      status: string;
      watched_seconds: number;
      required_seconds: number;
      reward_cents: number;
      risk_score: number;
      flag_reason: string | null;
      invalid_reason: string | null;
      started_at: Date;
      completed_at: Date | null;
      ad_title: string;
      ad_code: string;
      campaign_name: string;
      member_name: string;
      member_id: string;
      member_status: string;
      ip: string | null;
      user_agent: string | null;
    }>(
      `SELECT s.id, s.status, s.watched_seconds, s.required_seconds, s.reward_cents, s.risk_score,
              s.flag_reason, s.invalid_reason, s.started_at, s.completed_at, s.ip, s.user_agent,
              a.title AS ad_title, a.code AS ad_code, c.name AS campaign_name,
              u.full_name AS member_name, u.member_id, u.account_status AS member_status
         FROM ad_sessions s
         JOIN advertisements a ON a.id = s.advertisement_id
         JOIN campaigns c ON c.id = a.campaign_id
         JOIN users u ON u.id = s.user_id
        WHERE s.status = $1
        ORDER BY s.started_at DESC LIMIT 100`,
      [status],
    ),
    one<{ flagged: number; invalidated: number; expired: number; completed: number; avg_risk: number }>(
      `SELECT count(*) FILTER (WHERE status = 'FLAGGED')::int AS flagged,
              count(*) FILTER (WHERE status = 'INVALIDATED')::int AS invalidated,
              count(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
              count(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
              COALESCE(avg(risk_score) FILTER (WHERE status = 'FLAGGED'), 0)::int AS avg_risk
         FROM ad_sessions`,
    ),
    query<{ id: string; actor_label: string; action: string; target_id: string | null; reason: string | null; created_at: Date }>(
      `SELECT id, actor_label, action, target_id, reason, created_at
         FROM audit_logs WHERE action LIKE 'moderation.%'
        ORDER BY created_at DESC LIMIT 10`,
    ),
  ]);

  const s = stats ?? { flagged: 0, invalidated: 0, expired: 0, completed: 0, avg_risk: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advertising"
        title="Moderation queue"
        description="Review server-flagged viewing sessions. Confirming a flag invalidates the session; dismissing it closes the session without a reward."
        actions={<Badge tone={s.flagged ? "danger" : "success"}>{s.flagged} awaiting review</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Flagged sessions" value={s.flagged} icon={<ShieldAlert className="h-5 w-5" />} tone="danger" href="/admin/moderation?status=FLAGGED" />
        <StatCard label="Invalidated" value={s.invalidated} icon={<XCircle className="h-5 w-5" />} tone="neutral" href="/admin/moderation?status=INVALIDATED" />
        <StatCard label="Expired" value={s.expired} icon={<Clock3 className="h-5 w-5" />} tone="warning" href="/admin/moderation?status=EXPIRED" />
        <StatCard label="Average flagged risk" value={s.avg_risk} hint="0–100 risk score" icon={<Eye className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title={`${statusLabel(status)} sessions`}
            description="Newest first. Every decision requires a moderation note and is audited."
            actions={
              <form className="flex items-center gap-2">
                <Select name="status" defaultValue={status} className="h-9 w-auto text-[12px]" aria-label="Session status">
                  {["FLAGGED", "INVALIDATED", "EXPIRED"].map((value) => (
                    <option key={value} value={value}>{statusLabel(value)}</option>
                  ))}
                </Select>
                <SubmitButton size="sm" variant="secondary">Apply</SubmitButton>
              </form>
            }
          />
          {sessions.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-5 w-5" />}
              title={`No ${statusLabel(status).toLowerCase()} sessions`}
              description="Nothing needs moderation in this category right now."
            />
          ) : (
            <div className="divide-y divide-line/70">
              {sessions.map((session) => {
                const canResolve = session.status === "FLAGGED";
                return (
                  <div key={session.id} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-semibold text-navy">{session.ad_title}</p>
                          <Badge tone={STATUS_TONE[session.status] ?? "neutral"}>{statusLabel(session.status)}</Badge>
                          <Badge tone={session.risk_score >= 70 ? "danger" : session.risk_score >= 40 ? "warning" : "neutral"}>
                            Risk {session.risk_score}
                          </Badge>
                        </div>
                        <p className="mt-0.5 font-mono text-[10.5px] text-muted">
                          {session.ad_code} · {session.campaign_name} · session {session.id}
                        </p>
                        <p className="mt-1 text-[12px] text-ink">
                          {session.member_name} <span className="font-mono text-[10.5px] text-muted">({session.member_id})</span>
                          <span className="text-muted"> · account {statusLabel(session.member_status).toLowerCase()}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right text-[11.5px] text-muted">
                        <p>{formatDate(session.started_at, true)}</p>
                        <p>{relativeTime(session.started_at)}</p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2 text-[11.5px] sm:grid-cols-4">
                      <div className="rounded-lg bg-surface px-2.5 py-2">
                        <p className="text-muted">Watch time</p>
                        <p className="mt-0.5 font-semibold text-navy">{formatDuration(session.watched_seconds)} / {formatDuration(session.required_seconds)}</p>
                      </div>
                      <div className="rounded-lg bg-surface px-2.5 py-2">
                        <p className="text-muted">Demo reward</p>
                        <p className="mt-0.5 font-semibold text-navy">{formatMoney(session.reward_cents)}</p>
                      </div>
                      <div className="rounded-lg bg-surface px-2.5 py-2">
                        <p className="text-muted">IP address</p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-navy">{session.ip ?? "not captured"}</p>
                      </div>
                      <div className="rounded-lg bg-surface px-2.5 py-2">
                        <p className="text-muted">Completed</p>
                        <p className="mt-0.5 font-semibold text-navy">{session.completed_at ? formatDate(session.completed_at, true) : "—"}</p>
                      </div>
                    </div>

                    {session.flag_reason ? (
                      <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-[#f6d0d0] bg-[#fdecec] px-2.5 py-2 text-[11.5px] leading-relaxed text-danger">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {session.flag_reason}
                      </p>
                    ) : null}

                    {canResolve ? (
                      <form action={resolveFlaggedSessionAction} className="mt-3 space-y-2 rounded-xl border border-line p-3">
                        <input type="hidden" name="sessionId" value={session.id} />
                        <Textarea
                          name="note"
                          required
                          minLength={4}
                          maxLength={500}
                          placeholder="Moderation note — what did you verify?"
                          className="min-h-[64px] text-[12px]"
                        />
                        <div className="flex flex-wrap justify-end gap-2">
                          <SubmitButton
                            size="sm"
                            variant="secondary"
                            name="resolution"
                            value="DISMISS"
                            pendingLabel="Saving…"
                            confirm="Dismiss this flag? The session closes without a reward."
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Dismiss flag
                          </SubmitButton>
                          <SubmitButton
                            size="sm"
                            variant="danger"
                            name="resolution"
                            value="CONFIRM"
                            pendingLabel="Saving…"
                            confirm="Confirm this session as invalid? The member will not be rewarded for it."
                          >
                            <XCircle className="h-3.5 w-3.5" /> Confirm invalid
                          </SubmitButton>
                        </div>
                      </form>
                    ) : session.flag_reason ? (
                      <p className="mt-2 rounded-lg bg-surface px-3 py-2 font-mono text-[10.5px] leading-relaxed text-muted">{session.flag_reason}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="How risk scoring works" description="Automated signals, human decision." />
            <CardBody className="space-y-3 text-[12px] leading-relaxed text-muted">
              {[
                { title: "Watch-time integrity", body: "Progress is reported incrementally. A completion far ahead of elapsed time raises risk." },
                { title: "Visibility & focus", body: "Paused playback and hidden tabs stop accumulating verified time." },
                { title: "Session reuse", body: "Only one completed session per member per advertisement is ever rewarded." },
                { title: "Human review", body: "Flagged sessions never credit a reward until a moderator confirms or dismisses the flag." },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-line px-3 py-2.5">
                  <p className="text-[12px] font-semibold text-navy">{item.title}</p>
                  <p className="mt-0.5">{item.body}</p>
                </div>
              ))}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent moderation actions" description="Latest decisions from the audit trail." />
            {recentActions.length === 0 ? (
              <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No moderation decisions yet" />
            ) : (
              <div className="divide-y divide-line/70">
                {recentActions.map((action) => (
                  <div key={action.id} className="px-5 py-3">
                    <p className="text-[12px] text-ink">
                      <span className="font-semibold text-navy">{action.actor_label}</span>{" "}
                      {action.action.replace("moderation.", "")}d a session
                    </p>
                    {action.reason ? <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">{action.reason}</p> : null}
                    <p className="mt-0.5 text-[10.5px] text-muted">{relativeTime(action.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
            <span className="font-semibold text-navy">Reward safety.</span> Confirming a flag marks the session invalidated and
            excludes it from all reward totals. No ledger entry is created for flagged sessions.{" "}
            <Link href="/admin/ad-analytics" className="font-semibold text-brand hover:text-brand-dark">View ad analytics</Link>.
          </div>
        </div>
      </div>
    </div>
  );
}
