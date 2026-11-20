import type { Metadata } from "next";
import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Eye, PlayCircle, Sparkles, Users } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PageHeader,
  Progress,
  StatCard,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { AreaTrend, BarsChart, DonutChart } from "@/components/charts";
import { formatDate, formatDuration, formatMoney, pct } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Ad analytics" };
export const dynamic = "force-dynamic";

export default async function AdminAdAnalyticsPage() {
  await requireAdminPage("sessions.view");
  const [metrics, daily, byStatus, topAds, campaigns, recent, settings] = await Promise.all([
    one<{
      sessions: number;
      completed: number;
      in_progress: number;
      flagged: number;
      expired: number;
      invalidated: number;
      viewers: number;
      rewards: number;
      avg_watched: number;
      avg_required: number;
    }>(
      `SELECT count(*)::int AS sessions,
              count(*) FILTER (WHERE status = 'COMPLETED')::int AS completed,
              count(*) FILTER (WHERE status IN ('STARTED','IN_PROGRESS','PAUSED'))::int AS in_progress,
              count(*) FILTER (WHERE status = 'FLAGGED')::int AS flagged,
              count(*) FILTER (WHERE status = 'EXPIRED')::int AS expired,
              count(*) FILTER (WHERE status = 'INVALIDATED')::int AS invalidated,
              count(DISTINCT user_id)::int AS viewers,
              COALESCE(sum(reward_cents) FILTER (WHERE status = 'COMPLETED'), 0)::int AS rewards,
              COALESCE(avg(watched_seconds) FILTER (WHERE status = 'COMPLETED'), 0)::int AS avg_watched,
              COALESCE(avg(required_seconds) FILTER (WHERE status = 'COMPLETED'), 0)::int AS avg_required
         FROM ad_sessions`,
    ),
    query<{ label: string; started: number; completed: number; rewards: number }>(
      `SELECT to_char(d, 'Mon DD') AS label,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.started_at::date = d::date) AS started,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.status = 'COMPLETED' AND s.completed_at::date = d::date) AS completed,
              (SELECT COALESCE(sum(s.reward_cents),0)::int FROM ad_sessions s WHERE s.status = 'COMPLETED' AND s.completed_at::date = d::date) AS rewards
         FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') AS d
        ORDER BY d`,
    ),
    query<{ status: string; count: number }>(
      `SELECT status, count(*)::int AS count FROM ad_sessions GROUP BY status ORDER BY count DESC`,
    ),
    query<{ id: string; title: string; code: string; campaign_name: string; completions: number; flagged: number; rewards: number; avg_watch: number }>(
      `SELECT a.id, a.title, a.code, c.name AS campaign_name,
              count(s.id) FILTER (WHERE s.status = 'COMPLETED')::int AS completions,
              count(s.id) FILTER (WHERE s.status = 'FLAGGED')::int AS flagged,
              COALESCE(sum(s.reward_cents) FILTER (WHERE s.status = 'COMPLETED'),0)::int AS rewards,
              COALESCE(avg(s.watched_seconds) FILTER (WHERE s.status = 'COMPLETED'),0)::int AS avg_watch
         FROM advertisements a
         JOIN campaigns c ON c.id = a.campaign_id
         LEFT JOIN ad_sessions s ON s.advertisement_id = a.id
        GROUP BY a.id, a.title, a.code, c.name
        ORDER BY completions DESC, a.created_at DESC LIMIT 10`,
    ),
    query<{ id: string; name: string; status: string; ads: number; sessions: number; completions: number; rewards: number }>(
      `SELECT c.id, c.name, c.status,
              (SELECT count(*)::int FROM advertisements a WHERE a.campaign_id = c.id) AS ads,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.campaign_id = c.id) AS sessions,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.campaign_id = c.id AND s.status = 'COMPLETED') AS completions,
              (SELECT COALESCE(sum(s.reward_cents),0)::int FROM ad_sessions s WHERE s.campaign_id = c.id AND s.status = 'COMPLETED') AS rewards
         FROM campaigns c ORDER BY completions DESC, c.created_at DESC`,
    ),
    query<{
      id: string;
      status: string;
      watched_seconds: number;
      required_seconds: number;
      reward_cents: number;
      risk_score: number;
      started_at: Date;
      completed_at: Date | null;
      ad_title: string;
      member_name: string;
      member_id: string;
    }>(
      `SELECT s.id, s.status, s.watched_seconds, s.required_seconds, s.reward_cents, s.risk_score,
              s.started_at, s.completed_at, a.title AS ad_title, u.full_name AS member_name, u.member_id
         FROM ad_sessions s
         JOIN advertisements a ON a.id = s.advertisement_id
         JOIN users u ON u.id = s.user_id
        ORDER BY s.started_at DESC LIMIT 15`,
    ),
    getSettings(),
  ]);

  const m = metrics ?? {
    sessions: 0, completed: 0, in_progress: 0, flagged: 0, expired: 0, invalidated: 0,
    viewers: 0, rewards: 0, avg_watched: 0, avg_required: 0,
  };
  const completionRate = pct(m.completed, m.sessions);
  const attention = m.flagged + m.invalidated;

  const statusColors: Record<string, string> = {
    COMPLETED: "#16A36A",
    IN_PROGRESS: "#1769E0",
    STARTED: "#6AA6F0",
    PAUSED: "#E6A23C",
    FLAGGED: "#D64C4C",
    INVALIDATED: "#A33B3B",
    EXPIRED: "#9AA8BD",
  };
  const statusSlices = byStatus.map((row) => ({
    name: statusLabel(row.status),
    value: row.count,
    color: statusColors[row.status] ?? "#9CC3F8",
  }));

  const startedSeries = daily.map((row) => ({ label: row.label.trim(), value: row.started }));
  const rewardSeries = daily.map((row) => ({ label: row.label.trim(), value: row.rewards, value2: row.completed }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advertising"
        title="Ad analytics"
        description="Server-validated viewing sessions, completion quality and demo reward spend across every campaign."
        actions={<Badge tone="brand">Sessions verified server-side</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total sessions" value={m.sessions} hint={`${m.viewers} unique members`} icon={<PlayCircle className="h-5 w-5" />} />
        <StatCard
          label="Completion rate"
          value={`${completionRate}%`}
          hint={`${m.completed} completed · ${m.in_progress} active`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
        />
        <StatCard
          label="Needs attention"
          value={attention}
          hint={`${m.flagged} flagged · ${m.invalidated} invalidated`}
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={attention ? "danger" : "neutral"}
        />
        <StatCard
          label="Demo rewards credited"
          value={formatMoney(m.rewards, settings.currency)}
          hint="Completed sessions only"
          icon={<Sparkles className="h-5 w-5" />}
          tone="brand"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Session volume · last 14 days"
            description="Every bar is a server-issued ad session."
            actions={<Badge tone="neutral">Demo data</Badge>}
          />
          <CardBody>
            <BarsChart data={startedSeries} height={255} color="#1769E0" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Session outcomes" description="Distribution across every recorded session." />
          <CardBody>
            {statusSlices.length ? (
              <DonutChart data={statusSlices} height={255} centerValue={String(m.sessions)} centerLabel="Sessions" />
            ) : (
              <EmptyState icon={<Activity className="h-5 w-5" />} title="No session data" description="Start an advertisement from a member account to populate analytics." />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Rewards & completions · last 14 days"
          description="Demo reward cents credited against verified completions."
          actions={<Badge tone="success">Simulated</Badge>}
        />
        <CardBody>
          <AreaTrend
            data={rewardSeries}
            currency
            height={240}
            seriesLabels={["Demo rewards", "Completions"]}
          />
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader title="Top advertisements" description="Ranked by verified completions." />
          {topAds.length === 0 ? (
            <EmptyState title="No advertisements yet" />
          ) : (
            <TableWrap>
              <Table className="min-w-[720px]">
                <thead>
                  <tr><Th>Advertisement</Th><Th>Campaign</Th><Th className="text-right">Completions</Th><Th className="text-right">Flags</Th><Th className="text-right">Avg watch</Th><Th className="text-right">Rewards</Th></tr>
                </thead>
                <tbody>
                  {topAds.map((ad) => (
                    <Tr key={ad.id}>
                      <Td>
                        <p className="font-medium text-navy">{ad.title}</p>
                        <p className="font-mono text-[10px] text-muted">{ad.code}</p>
                      </Td>
                      <Td className="text-muted">{ad.campaign_name}</Td>
                      <Td className="text-right font-medium">{ad.completions}</Td>
                      <Td className={`text-right ${ad.flagged ? "font-medium text-danger" : "text-muted"}`}>{ad.flagged}</Td>
                      <Td className="text-right text-muted">{formatDuration(ad.avg_watch)}</Td>
                      <Td className="text-right text-muted">{formatMoney(ad.rewards, settings.currency)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card>
          <CardHeader title="Viewing quality" description="Completed sessions against required watch time." />
          <CardBody className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted">Average verified watch time</span>
                <span className="font-semibold text-navy">{formatDuration(m.avg_watched)}</span>
              </div>
              <Progress className="mt-1.5" value={pct(m.avg_watched, m.avg_required || 1)} tone="success" />
              <p className="mt-1 text-[11px] text-muted">Average requirement: {formatDuration(m.avg_required)}</p>
            </div>
            <div>
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-muted">Sessions needing moderation</span>
                <span className="font-semibold text-navy">{attention}</span>
              </div>
              <Progress className="mt-1.5" value={pct(attention, m.sessions || 1)} tone="warning" />
              <p className="mt-1 text-[11px] text-muted">Flagged or invalidated sessions are excluded from rewards.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-line pt-3">
              {[
                { label: "Expired", value: m.expired, icon: Clock3 },
                { label: "Invalidated", value: m.invalidated, icon: AlertTriangle },
                { label: "Unique viewers", value: m.viewers, icon: Users },
                { label: "Active now", value: m.in_progress, icon: Eye },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl border border-line px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.06em] text-muted">
                      <Icon className="h-3.5 w-3.5" /> {item.label}
                    </div>
                    <p className="mt-1 text-[16px] font-semibold text-navy">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Campaign performance" description="Delivery and demo reward spend per campaign." />
        {campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" />
        ) : (
          <TableWrap>
            <Table className="min-w-[820px]">
              <thead>
                <tr><Th>Campaign</Th><Th>Status</Th><Th className="text-right">Ads</Th><Th className="text-right">Sessions</Th><Th className="text-right">Completions</Th><Th>Completion</Th><Th className="text-right">Rewards</Th></tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <Tr key={campaign.id}>
                    <Td>
                      <Link href={`/admin/campaigns/${campaign.id}`} className="font-medium text-navy hover:text-brand">{campaign.name}</Link>
                    </Td>
                    <Td><Badge tone={STATUS_TONE[campaign.status] ?? "neutral"}>{statusLabel(campaign.status)}</Badge></Td>
                    <Td className="text-right text-muted">{campaign.ads}</Td>
                    <Td className="text-right text-muted">{campaign.sessions}</Td>
                    <Td className="text-right font-medium">{campaign.completions}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Progress value={pct(campaign.completions, campaign.sessions || 1)} className="w-24" tone="success" />
                        <span className="text-[11px] text-muted">{pct(campaign.completions, campaign.sessions || 1)}%</span>
                      </div>
                    </Td>
                    <Td className="text-right text-muted">{formatMoney(campaign.rewards, settings.currency)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader title="Recent sessions" description="Newest 15 server-issued viewing sessions." actions={<Link href="/admin/moderation" className="text-[12px] font-semibold text-brand">Moderation queue</Link>} />
        {recent.length === 0 ? (
          <EmptyState icon={<PlayCircle className="h-5 w-5" />} title="No sessions recorded" />
        ) : (
          <TableWrap>
            <Table className="min-w-[900px]">
              <thead>
                <tr><Th>Member</Th><Th>Advertisement</Th><Th>Status</Th><Th>Watched</Th><Th className="text-right">Reward</Th><Th className="text-right">Risk</Th><Th>Started</Th><Th>Completed</Th></tr>
              </thead>
              <tbody>
                {recent.map((session) => (
                  <Tr key={session.id}>
                    <Td>
                      <p className="font-medium text-navy">{session.member_name}</p>
                      <p className="font-mono text-[10px] text-muted">{session.member_id}</p>
                    </Td>
                    <Td className="max-w-[220px] truncate text-muted">{session.ad_title}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[session.status] ?? "neutral"}>{statusLabel(session.status)}</Badge>
                    </Td>
                    <Td className="text-muted">{session.watched_seconds}s / {session.required_seconds}s</Td>
                    <Td className="text-right text-muted">{formatMoney(session.reward_cents, settings.currency)}</Td>
                    <Td className={`text-right ${session.risk_score >= 60 ? "font-semibold text-danger" : "text-muted"}`}>{session.risk_score}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(session.started_at, true)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(session.completed_at, true)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11.5px] leading-relaxed text-muted">
        Sessions are started, progressed and completed through authenticated API routes. The server enforces watch duration,
        one completion per member per advertisement, and anti-fraud risk scoring. All rewards shown are simulated.
      </p>
    </div>
  );
}
