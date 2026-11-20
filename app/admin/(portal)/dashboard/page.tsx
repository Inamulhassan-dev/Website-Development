import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Banknote,
  BellRing,
  Clapperboard,
  LifeBuoy,
  Megaphone,
  ScrollText,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { can, requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { sendAnnouncementAction } from "@/lib/actions/admin";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Select,
  StatCard,
  Textarea,
} from "@/components/ui/primitives";
import { AreaTrend, BarsChart } from "@/components/charts";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney, relativeTime } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const admin = await requireAdminPage("dashboard.view");
  const [metrics, trend, recentAudit, pendingWithdrawals, flagged, openTickets, settings] = await Promise.all([
    one<{
      members: number;
      active_members: number;
      active_memberships: number;
      new_members: number;
      completed_sessions: number;
      rewards_paid: number;
      pending_withdrawal_count: number;
      pending_withdrawal_cents: number;
      flagged_sessions: number;
      open_tickets: number;
      available_liability: number;
    }>(
      `SELECT
        (SELECT count(*)::int FROM users WHERE role = 'MEMBER') AS members,
        (SELECT count(*)::int FROM users WHERE role = 'MEMBER' AND account_status = 'ACTIVE') AS active_members,
        (SELECT count(*)::int FROM memberships WHERE status = 'ACTIVE') AS active_memberships,
        (SELECT count(*)::int FROM users WHERE role = 'MEMBER' AND created_at > now() - interval '7 days') AS new_members,
        (SELECT count(*)::int FROM ad_sessions WHERE status = 'COMPLETED') AS completed_sessions,
        (SELECT COALESCE(sum(amount_cents),0)::int FROM wallet_transactions
          WHERE direction = 'CREDIT' AND status = 'COMPLETED' AND type IN ('AD_REWARD','REFERRAL_REWARD')) AS rewards_paid,
        (SELECT count(*)::int FROM withdrawal_requests WHERE status IN ('PENDING','UNDER_REVIEW')) AS pending_withdrawal_count,
        (SELECT COALESCE(sum(amount_cents),0)::int FROM withdrawal_requests WHERE status IN ('PENDING','UNDER_REVIEW')) AS pending_withdrawal_cents,
        (SELECT count(*)::int FROM ad_sessions WHERE status = 'FLAGGED') AS flagged_sessions,
        (SELECT count(*)::int FROM support_tickets WHERE status IN ('OPEN','IN_PROGRESS','WAITING_FOR_MEMBER')) AS open_tickets,
        (SELECT COALESCE(sum(available_cents),0)::int FROM wallets) AS available_liability`,
    ),
    query<{ label: string; value: number; value2: number }>(
      `SELECT to_char(d, 'Mon DD') AS label,
              (SELECT COALESCE(sum(w.amount_cents),0)::int FROM wallet_transactions w
                WHERE w.direction = 'CREDIT' AND w.type IN ('AD_REWARD','REFERRAL_REWARD')
                  AND w.created_at::date = d::date) AS value,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.status = 'COMPLETED' AND s.completed_at::date = d::date) AS value2
         FROM generate_series(CURRENT_DATE - interval '13 days', CURRENT_DATE, interval '1 day') AS d
        ORDER BY d`,
    ),
    query<{ id: string; actor_label: string; action: string; target_type: string; target_id: string | null; reason: string | null; created_at: Date }>(
      `SELECT id, actor_label, action, target_type, target_id, reason, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 8`,
    ),
    query<{ id: string; reference: string; amount_cents: number; method: string; status: string; created_at: Date; full_name: string; member_id: string }>(
      `SELECT w.id, w.reference, w.amount_cents, w.method, w.status, w.created_at, u.full_name, u.member_id
         FROM withdrawal_requests w JOIN users u ON u.id = w.user_id
        WHERE w.status IN ('PENDING','UNDER_REVIEW') ORDER BY w.created_at ASC LIMIT 4`,
    ),
    query<{ id: string; title: string; flag_reason: string | null; started_at: Date; full_name: string; member_id: string }>(
      `SELECT s.id, a.title, s.flag_reason, s.started_at, u.full_name, u.member_id
         FROM ad_sessions s JOIN advertisements a ON a.id = s.advertisement_id JOIN users u ON u.id = s.user_id
        WHERE s.status = 'FLAGGED' ORDER BY s.started_at DESC LIMIT 4`,
    ),
    query<{ id: string; reference: string; subject: string; status: string; priority: string; updated_at: Date }>(
      `SELECT id, reference, subject, status, priority, updated_at FROM support_tickets
        WHERE status IN ('OPEN','IN_PROGRESS','WAITING_FOR_MEMBER') ORDER BY updated_at ASC LIMIT 4`,
    ),
    getSettings(),
  ]);

  const m = metrics ?? {
    members: 0, active_members: 0, active_memberships: 0, new_members: 0, completed_sessions: 0,
    rewards_paid: 0, pending_withdrawal_count: 0, pending_withdrawal_cents: 0, flagged_sessions: 0,
    open_tickets: 0, available_liability: 0,
  };

  const trendData = trend.map((row) => ({ label: row.label.trim(), value: Number(row.value), value2: Number(row.value2) }));
  const sessionsData = trend.map((row) => ({ label: row.label.trim(), value: Number(row.value2) }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Operations dashboard"
        description="Live demonstration metrics across membership, advertising, finance and support."
        actions={
          <>
            <LinkButton href="/admin/reports" variant="secondary" size="sm">
              <TrendingUp className="h-4 w-4" /> Reports
            </LinkButton>
            <LinkButton href="/admin/users" size="sm">
              <Users className="h-4 w-4" /> Members
            </LinkButton>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Members"
          value={m.members}
          hint={`${m.active_members} active · ${m.new_members} new this week`}
          icon={<Users className="h-5 w-5" />}
          href="/admin/users"
        />
        <StatCard
          label="Active memberships"
          value={m.active_memberships}
          hint={`${m.members > 0 ? Math.round((m.active_memberships / m.members) * 100) : 0}% of members`}
          icon={<BadgeCheck className="h-5 w-5" />}
          tone="success"
          href="/admin/memberships"
        />
        <StatCard
          label="Completed ad sessions"
          value={m.completed_sessions}
          hint={`${formatMoney(m.rewards_paid, settings.currency)} demo rewards paid`}
          icon={<Clapperboard className="h-5 w-5" />}
          tone="brand"
          href="/admin/ad-analytics"
        />
        <StatCard
          label="Demo wallet liability"
          value={formatMoney(m.available_liability, settings.currency)}
          hint={`${formatMoney(m.pending_withdrawal_cents, settings.currency)} pending withdrawals`}
          icon={<Wallet className="h-5 w-5" />}
          tone="warning"
          href="/admin/wallet"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Card>
          <CardHeader
            title="Demo rewards · last 14 days"
            description="Credited ad and referral rewards, with daily completed sessions."
            actions={<Badge tone="brand">Simulated</Badge>}
          />
          <CardBody>
            <AreaTrend data={trendData} height={235} seriesLabels={["Rewards credited", "Completed sessions"]} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Daily completed sessions" description="Verified advertisement completions." />
          <CardBody>
            <BarsChart data={sessionsData} height={235} color="#1769E0" />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader
            title="Withdrawal queue"
            description="Finance review required."
            actions={
              <div className="flex items-center gap-1.5">
                <Badge tone={m.pending_withdrawal_count ? "warning" : "neutral"}>{m.pending_withdrawal_count}</Badge>
                <Link href="/admin/withdrawals" className="text-[11.5px] font-semibold text-brand">Open</Link>
              </div>
            }
          />
          {pendingWithdrawals.length === 0 ? (
            <EmptyState icon={<Banknote className="h-5 w-5" />} title="No pending withdrawals" description="The finance queue is clear." />
          ) : (
            <div className="divide-y divide-line/70">
              {pendingWithdrawals.map((row) => (
                <Link key={row.id} href="/admin/withdrawals" className="flex items-center gap-3 px-5 py-3 transition hover:bg-[#fafcff]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-navy">{row.full_name}</p>
                    <p className="font-mono text-[10.5px] text-muted">{row.reference} · {row.member_id}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[12.5px] font-semibold text-ink">{formatMoney(row.amount_cents, settings.currency)}</p>
                    <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Moderation queue"
            description="Flagged ad sessions."
            actions={
              <div className="flex items-center gap-1.5">
                <Badge tone={m.flagged_sessions ? "danger" : "neutral"}>{m.flagged_sessions}</Badge>
                <Link href="/admin/moderation" className="text-[11.5px] font-semibold text-brand">Open</Link>
              </div>
            }
          />
          {flagged.length === 0 ? (
            <EmptyState icon={<AlertTriangle className="h-5 w-5" />} title="No flagged sessions" description="No integrity issues need review." />
          ) : (
            <div className="divide-y divide-line/70">
              {flagged.map((row) => (
                <Link key={row.id} href="/admin/moderation" className="block px-5 py-3 transition hover:bg-[#fafcff]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12.5px] font-medium text-navy">{row.title}</p>
                    <span className="shrink-0 text-[10.5px] text-muted">{relativeTime(row.started_at)}</span>
                  </div>
                  <p className="truncate text-[11px] text-muted">{row.full_name} · {row.member_id}</p>
                  {row.flag_reason ? <p className="mt-0.5 line-clamp-1 text-[10.5px] text-danger">{row.flag_reason}</p> : null}
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Support inbox"
            description="Open conversations."
            actions={
              <div className="flex items-center gap-1.5">
                <Badge tone={m.open_tickets ? "brand" : "neutral"}>{m.open_tickets}</Badge>
                <Link href="/admin/support" className="text-[11.5px] font-semibold text-brand">Open</Link>
              </div>
            }
          />
          {openTickets.length === 0 ? (
            <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No open tickets" description="Support is fully caught up." />
          ) : (
            <div className="divide-y divide-line/70">
              {openTickets.map((row) => (
                <Link key={row.id} href={`/admin/support/${row.id}`} className="block px-5 py-3 transition hover:bg-[#fafcff]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[12.5px] font-medium text-navy">{row.subject}</p>
                    <Badge tone={STATUS_TONE[row.priority] ?? "neutral"}>{statusLabel(row.priority)}</Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-[10.5px] text-muted">{row.reference} · updated {relativeTime(row.updated_at)}</p>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader
            title="Recent audit activity"
            description="Append-only trail of sensitive actions."
            actions={<LinkButton href="/admin/audit-logs" variant="ghost" size="sm"><ScrollText className="h-3.5 w-3.5" /> Audit log</LinkButton>}
          />
          {recentAudit.length === 0 ? (
            <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No audit events yet" />
          ) : (
            <div className="divide-y divide-line/70">
              {recentAudit.map((row) => (
                <div key={row.id} className="flex items-start gap-3 px-5 py-3 sm:px-6">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-ink">
                      <span className="font-semibold text-navy">{row.actor_label}</span>{" "}
                      <span className="text-muted">performed</span> {row.action}
                    </p>
                    <p className="text-[10.5px] text-muted">
                      {row.target_type}
                      {row.target_id ? ` · ${row.target_id}` : ""} · {relativeTime(row.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {can(admin, "users.notify") ? (
          <Card>
            <CardHeader title="Send an announcement" description="Delivered to member notifications." actions={<BellRing className="h-4 w-4 text-muted" />} />
            <CardBody>
              <form action={sendAnnouncementAction} className="space-y-3">
                <Field label="Audience" htmlFor="audience">
                  <Select id="audience" name="audience" defaultValue="ACTIVE_MEMBERS">
                    <option value="ACTIVE_MEMBERS">Active members</option>
                    <option value="ALL_MEMBERS">All members</option>
                    <option value="STAFF">Staff accounts</option>
                  </Select>
                </Field>
                <Field label="Title" htmlFor="title">
                  <Input id="title" name="title" placeholder="Short announcement title" maxLength={120} required minLength={3} />
                </Field>
                <Field label="Message" htmlFor="body">
                  <Textarea id="body" name="body" placeholder="What should members know?" maxLength={1500} required minLength={5} className="min-h-[90px]" />
                </Field>
                <SubmitButton className="w-full" pendingLabel="Sending…">
                  <Megaphone className="h-4 w-4" /> Send announcement
                </SubmitButton>
              </form>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Role scope" description="Your access is limited by role." />
            <CardBody className="space-y-3 text-[12px] leading-relaxed text-muted">
              <p>Your current role does not include member notification permissions.</p>
              <p>Use the navigation to access the modules available to you. Every action you take is written to the audit log.</p>
              <LinkButton href="/admin/roles" size="sm" variant="secondary">
                View permission matrix <ArrowRight className="h-3.5 w-3.5" />
              </LinkButton>
            </CardBody>
          </Card>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
        <span className="font-semibold text-navy">Demonstration notice.</span> All figures on this dashboard are simulated.
        No real payments, rewards or payouts occur. Data shown is seeded for the purposes of evaluating the platform.
        Last refreshed {formatDate(new Date(), true)}.
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { href: "/admin/campaigns", icon: Megaphone, label: "Campaigns" },
          { href: "/admin/advertisements", icon: Clapperboard, label: "Advertisements" },
          { href: "/admin/reports", icon: TrendingUp, label: "Reports & CSV" },
          { href: "/admin/settings", icon: UserPlus, label: "Platform settings" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 text-[12.5px] font-medium text-ink shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
              <Icon className="h-4 w-4 text-brand" /> {item.label}
              <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
