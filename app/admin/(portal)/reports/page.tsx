import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  Banknote,
  Clapperboard,
  Download,
  FileBarChart,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { can, requireAdminPage } from "@/lib/auth";
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
import { AreaTrend, BarsChart } from "@/components/charts";
import { formatMoney, pct } from "@/lib/format";
import { TXN_TYPE_LABELS } from "@/lib/constants";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const REPORTS = [
  { type: "users", title: "Members", description: "Every member, account status, membership state and last login." },
  { type: "memberships", title: "Membership payments", description: "Demo membership payments with method, amount and status." },
  { type: "campaigns", title: "Campaigns", description: "Campaign schedule, allocation, advertiser and ad count." },
  { type: "advertisements", title: "Advertisements", description: "Creative catalogue, watch requirements, rewards and completions." },
  { type: "sessions", title: "Ad sessions", description: "Server-validated sessions, watch time, status and risk score." },
  { type: "transactions", title: "Wallet transactions", description: "Complete ledger with direction, balance and description." },
  { type: "withdrawals", title: "Withdrawals", description: "Requests, masked destinations and decision trail." },
  { type: "referrals", title: "Referrals", description: "Referrer, referred member, status and reward." },
  { type: "support", title: "Support tickets", description: "Tickets, category, priority and status." },
  { type: "audit", title: "Audit log", description: "Latest 5,000 sensitive actions with actor and target." },
];

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const admin = await requireAdminPage("reports.view");
  const params = await searchParams;
  const days = ["7", "30", "90"].includes(params.period ?? "") ? Number(params.period) : 30;

  const [metrics, daily, creditsByType, topCampaigns, topMembers, settings] = await Promise.all([
    one<{
      new_members: number;
      active_members: number;
      active_memberships: number;
      completed_sessions: number;
      flagged_sessions: number;
      membership_revenue: number;
      ad_rewards: number;
      referral_rewards: number;
      withdrawals_approved: number;
      withdrawals_requested: number;
    }>(
      `SELECT
        (SELECT count(*)::int FROM users WHERE role = 'MEMBER' AND created_at >= now() - make_interval(days => $1)) AS new_members,
        (SELECT count(*)::int FROM users WHERE role = 'MEMBER' AND account_status = 'ACTIVE') AS active_members,
        (SELECT count(*)::int FROM memberships WHERE status = 'ACTIVE') AS active_memberships,
        (SELECT count(*)::int FROM ad_sessions WHERE status = 'COMPLETED' AND completed_at >= now() - make_interval(days => $1)) AS completed_sessions,
        (SELECT count(*)::int FROM ad_sessions WHERE status = 'FLAGGED') AS flagged_sessions,
        (SELECT COALESCE(sum(amount_cents),0)::int FROM membership_payments WHERE status = 'SUCCESS' AND created_at >= now() - make_interval(days => $1)) AS membership_revenue,
        (SELECT COALESCE(sum(amount_cents),0)::int FROM wallet_transactions WHERE type = 'AD_REWARD' AND direction = 'CREDIT' AND status = 'COMPLETED' AND created_at >= now() - make_interval(days => $1)) AS ad_rewards,
        (SELECT COALESCE(sum(amount_cents),0)::int FROM wallet_transactions WHERE type = 'REFERRAL_REWARD' AND direction = 'CREDIT' AND status = 'COMPLETED' AND created_at >= now() - make_interval(days => $1)) AS referral_rewards,
        (SELECT COALESCE(sum(amount_cents),0)::int FROM withdrawal_requests WHERE status IN ('APPROVED','COMPLETED') AND created_at >= now() - make_interval(days => $1)) AS withdrawals_approved,
        (SELECT COALESCE(sum(amount_cents),0)::int FROM withdrawal_requests WHERE created_at >= now() - make_interval(days => $1)) AS withdrawals_requested`,
      [days],
    ),
    query<{ label: string; sessions: number; rewards: number; members: number }>(
      `SELECT to_char(d, 'Mon DD') AS label,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.status = 'COMPLETED' AND s.completed_at::date = d::date) AS sessions,
              (SELECT COALESCE(sum(t.amount_cents),0)::int FROM wallet_transactions t
                WHERE t.direction = 'CREDIT' AND t.status = 'COMPLETED'
                  AND t.type IN ('AD_REWARD','REFERRAL_REWARD') AND t.created_at::date = d::date) AS rewards,
              (SELECT count(*)::int FROM users u WHERE u.role = 'MEMBER' AND u.created_at::date = d::date) AS members
         FROM generate_series(CURRENT_DATE - make_interval(days => ($1::int - 1)), CURRENT_DATE, interval '1 day') AS d
        ORDER BY d`,
      [days],
    ),
    query<{ type: string; direction: string; total: number; count: number }>(
      `SELECT type, direction, COALESCE(sum(amount_cents),0)::int AS total, count(*)::int AS count
         FROM wallet_transactions
        WHERE status = 'COMPLETED' AND created_at >= now() - make_interval(days => $1)
        GROUP BY type, direction ORDER BY total DESC`,
      [days],
    ),
    query<{ id: string; name: string; status: string; completions: number; rewards: number; completion_rate: number }>(
      `SELECT c.id, c.name, c.status,
              count(s.id) FILTER (WHERE s.status = 'COMPLETED')::int AS completions,
              COALESCE(sum(s.reward_cents) FILTER (WHERE s.status = 'COMPLETED'),0)::int AS rewards,
              CASE WHEN count(s.id) = 0 THEN 0
                   ELSE round(100.0 * count(s.id) FILTER (WHERE s.status = 'COMPLETED') / count(s.id))::int END AS completion_rate
         FROM campaigns c LEFT JOIN ad_sessions s ON s.campaign_id = c.id AND s.started_at >= now() - make_interval(days => $1)
        GROUP BY c.id, c.name, c.status
        ORDER BY completions DESC, rewards DESC LIMIT 8`,
      [days],
    ),
    query<{ user_id: string; full_name: string; member_id: string; rewards: number; sessions: number }>(
      `SELECT u.id AS user_id, u.full_name, u.member_id,
              COALESCE(sum(t.amount_cents) FILTER (WHERE t.type IN ('AD_REWARD','REFERRAL_REWARD') AND t.direction = 'CREDIT'),0)::int AS rewards,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.user_id = u.id AND s.status = 'COMPLETED' AND s.completed_at >= now() - make_interval(days => $1)) AS sessions
         FROM users u
         LEFT JOIN wallet_transactions t ON t.user_id = u.id AND t.status = 'COMPLETED' AND t.created_at >= now() - make_interval(days => $1)
        WHERE u.role = 'MEMBER'
        GROUP BY u.id, u.full_name, u.member_id
        ORDER BY rewards DESC, sessions DESC LIMIT 10`,
      [days],
    ),
    getSettings(),
  ]);

  const m = metrics ?? {
    new_members: 0, active_members: 0, active_memberships: 0, completed_sessions: 0, flagged_sessions: 0,
    membership_revenue: 0, ad_rewards: 0, referral_rewards: 0, withdrawals_approved: 0, withdrawals_requested: 0,
  };
  const trend = daily.map((row) => ({ label: row.label.trim(), value: Number(row.rewards), value2: Number(row.sessions) }));
  const memberTrend = daily.map((row) => ({ label: row.label.trim(), value: Number(row.members) }));
  const totalCredits = creditsByType.filter((row) => row.direction === "CREDIT").reduce((sum, row) => sum + Number(row.total), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Reports"
        description={`Operational and financial summary for the last ${days} days. All figures are simulated.`}
        actions={
          <div className="flex items-center gap-1 rounded-full border border-line bg-white p-1">
            {[7, 30, 90].map((value) => (
              <Link
                key={value}
                href={`/admin/reports?period=${value}`}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${value === days ? "bg-brand text-white" : "text-muted hover:text-navy"}`}
              >
                {value}d
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="New members" value={m.new_members} hint={`${m.active_members} active members`} icon={<UserPlus className="h-5 w-5" />} />
        <StatCard label="Completed sessions" value={m.completed_sessions} hint={`${m.flagged_sessions} flagged open`} icon={<Clapperboard className="h-5 w-5" />} tone="brand" />
        <StatCard label="Membership revenue (demo)" value={formatMoney(m.membership_revenue, settings.currency)} hint={`${m.active_memberships} active memberships`} icon={<BadgeCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Rewards credited (demo)" value={formatMoney(m.ad_rewards + m.referral_rewards, settings.currency)} hint={`${formatMoney(m.ad_rewards, settings.currency)} ads · ${formatMoney(m.referral_rewards, settings.currency)} referrals`} icon={<Sparkles className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Withdrawals requested" value={formatMoney(m.withdrawals_requested, settings.currency)} hint="Demo requests in period" icon={<Banknote className="h-5 w-5" />} />
        <StatCard label="Withdrawals approved" value={formatMoney(m.withdrawals_approved, settings.currency)} hint="Simulated payouts" icon={<Wallet className="h-5 w-5" />} tone="warning" />
        <StatCard label="Ledger credits" value={formatMoney(totalCredits, settings.currency)} hint="Completed entries in period" icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard
          label="Membership conversion"
          value={`${pct(m.active_memberships, m.active_members || 1)}%`}
          hint="Active memberships vs active members"
          icon={<Users className="h-5 w-5" />}
          tone="success"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Rewards & verified completions" description={`Daily demo rewards credited over the last ${days} days.`} actions={<Badge tone="brand">Simulated</Badge>} />
          <CardBody>
            <AreaTrend data={trend} height={260} seriesLabels={["Demo rewards", "Completed sessions"]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="New members" description="Registrations per day." />
          <CardBody>
            <BarsChart data={memberTrend} height={260} color="#16A36A" />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader title="Wallet activity by type" description={`Completed ledger entries in the last ${days} days.`} />
          {creditsByType.length === 0 ? (
            <EmptyState icon={<Wallet className="h-5 w-5" />} title="No ledger activity in this period" />
          ) : (
            <TableWrap>
              <Table className="min-w-[520px]">
                <thead>
                  <tr><Th>Type</Th><Th>Direction</Th><Th className="text-right">Entries</Th><Th className="text-right">Total</Th></tr>
                </thead>
                <tbody>
                  {creditsByType.map((row) => (
                    <Tr key={`${row.type}-${row.direction}`}>
                      <Td className="text-ink">{TXN_TYPE_LABELS[row.type] ?? row.type}</Td>
                      <Td>
                        <Badge tone={row.direction === "CREDIT" ? "success" : "neutral"}>{row.direction === "CREDIT" ? "Credit" : "Debit"}</Badge>
                      </Td>
                      <Td className="text-right text-muted">{row.count}</Td>
                      <Td className={`text-right font-medium ${row.direction === "CREDIT" ? "text-success" : "text-ink"}`}>
                        {formatMoney(Number(row.total), settings.currency)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>

        <Card>
          <CardHeader title="Campaign delivery" description="Sessions started in the selected period." />
          {topCampaigns.length === 0 ? (
            <EmptyState title="No campaign activity" />
          ) : (
            <div className="divide-y divide-line/70">
              {topCampaigns.map((campaign) => (
                <div key={campaign.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <Link href={`/admin/campaigns/${campaign.id}`} className="truncate text-[12.5px] font-medium text-navy hover:text-brand">{campaign.name}</Link>
                    <span className="shrink-0 text-[11.5px] font-semibold text-ink">{formatMoney(campaign.rewards, settings.currency)}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress value={campaign.completion_rate} className="flex-1" tone="success" />
                    <span className="text-[10.5px] text-muted">{campaign.completions} completions · {campaign.completion_rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Top earning members" description={`Demo rewards credited in the last ${days} days.`} />
        {topMembers.length === 0 ? (
          <EmptyState title="No member activity" />
        ) : (
          <TableWrap>
            <Table className="min-w-[720px]">
              <thead>
                <tr><Th>Member</Th><Th>Member ID</Th><Th className="text-right">Completed ads</Th><Th className="text-right">Demo rewards</Th><Th /></tr>
              </thead>
              <tbody>
                {topMembers.map((member) => (
                  <Tr key={member.user_id}>
                    <Td className="font-medium text-navy">{member.full_name}</Td>
                    <Td className="font-mono text-[11px] text-muted">{member.member_id}</Td>
                    <Td className="text-right text-muted">{member.sessions}</Td>
                    <Td className="text-right font-semibold text-success">{formatMoney(member.rewards, settings.currency)}</Td>
                    <Td><Link href={`/admin/users/${member.user_id}`} className="text-[12px] font-semibold text-brand hover:text-brand-dark">Open</Link></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Download reports"
          description="CSV exports include the full dataset for each report."
          actions={<FileBarChart className="h-4 w-4 text-muted" />}
        />
        <CardBody className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {REPORTS.map((report) => (
            <div key={report.type} className="flex flex-col rounded-xl border border-line p-3.5">
              <p className="text-[12.5px] font-semibold text-navy">{report.title}</p>
              <p className="mt-0.5 flex-1 text-[11px] leading-relaxed text-muted">{report.description}</p>
              {can(admin, "reports.export") ? (
                <Link href={`/api/admin/export?type=${report.type}`} className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand hover:text-brand-dark">
                  <Download className="h-3.5 w-3.5" /> Download CSV
                </Link>
              ) : (
                <span className="mt-2 text-[11px] text-muted">Export permission not granted</span>
              )}
            </div>
          ))}
        </CardBody>
      </Card>

      <p className="text-[11.5px] leading-relaxed text-muted">
        Financial figures reflect simulated membership payments, demo rewards and demo withdrawal requests. They do not represent
        revenue, income or liabilities in any real currency. Period totals use event creation timestamps.
      </p>
    </div>
  );
}
