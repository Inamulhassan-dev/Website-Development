import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Bell,
  CheckCircle2,
  Clapperboard,
  Megaphone,
  PlayCircle,
  Sparkles,
  Users2,
  Wallet,
} from "lucide-react";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { getWallet } from "@/lib/services/wallet";
import { getMembership, getPlan } from "@/lib/services/membership";
import { memberAdStats, listAvailableAds, countAvailableAds } from "@/lib/services/ads";
import { referralStats } from "@/lib/services/referrals";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, Progress, StatCard } from "@/components/ui/primitives";
import { AreaTrend } from "@/components/charts";
import { formatDate, formatMoney, relativeTime } from "@/lib/format";
import { statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Member overview" };
export const dynamic = "force-dynamic";

type TrendRow = { label: string; value: number };

export default async function DashboardPage() {
  const user = await requireMember();
  const [wallet, membership, plan, stats, available, availableCount, referrals, settings] = await Promise.all([
    getWallet(user.id),
    getMembership(user.id),
    getPlan(),
    memberAdStats(user.id),
    listAvailableAds(user.id),
    countAvailableAds(user.id),
    referralStats(user.id),
    getSettings(),
  ]);

  const [trend, recentTxns, notifications] = await Promise.all([
    query<TrendRow>(
      `SELECT to_char(d, 'Dy') AS label,
              COALESCE(sum(t.amount_cents) FILTER (WHERE t.direction = 'CREDIT' AND t.type IN ('AD_REWARD','REFERRAL_REWARD')), 0)::int AS value
         FROM generate_series(CURRENT_DATE - interval '6 days', CURRENT_DATE, interval '1 day') AS d
         LEFT JOIN wallet_transactions t
           ON t.user_id = $1 AND t.created_at::date = d::date
        GROUP BY d ORDER BY d`,
      [user.id],
    ),
    query<{ id: string; reference: string; type: string; direction: string; amount_cents: number; description: string; created_at: Date }>(
      `SELECT id, reference, type, direction, amount_cents, description, created_at
         FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [user.id],
    ),
    query<{ id: string; title: string; body: string; type: string; read_at: Date | null; created_at: Date; link: string | null }>(
      `SELECT id, title, body, type, read_at, created_at, link FROM notifications
        WHERE user_id = $1 ORDER BY created_at DESC LIMIT 4`,
      [user.id],
    ),
  ]);

  const isActive = membership?.status === "ACTIVE" && user.accountStatus === "ACTIVE";
  const trendData = trend.map((row) => ({ label: row.label.trim(), value: Number(row.value) }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Member overview"
        title={`Welcome back, ${user.fullName.split(" ")[0]}`}
        description="A clear view of your DEMO membership, verified advertising activity, wallet balance and referral progress."
        actions={
          isActive ? (
            <LinkButton href="/dashboard/ads" size="sm">
              <PlayCircle className="h-4 w-4" /> Watch advertisements
            </LinkButton>
          ) : (
            <LinkButton href="/dashboard/membership" size="sm">
              <BadgeCheck className="h-4 w-4" /> Activate membership
            </LinkButton>
          )
        }
      />

      {settings.announcement_banner ? (
        <div className="flex items-start gap-2.5 rounded-2xl border border-[#cfe2ff] bg-brandsoft px-4 py-3 text-[12.5px] text-brand">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="leading-relaxed">{settings.announcement_banner}</p>
        </div>
      ) : null}

      {!isActive ? (
        <Card className="overflow-hidden border-[#f4e2bd] bg-[#fffaf0]">
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-warning shadow-sm">
                <BadgeCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-navy">Membership activation required</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {membership?.status === "PENDING"
                    ? `Complete the one-time DEMO payment of ${formatMoney(plan.price_cents, plan.currency)} to unlock campaigns, advertisements and demo rewards.`
                    : "Your membership is not active. Contact support if you believe this is an error."}
                </p>
              </div>
            </div>
            <LinkButton href="/dashboard/membership" size="sm">
              Activate now <ArrowRight className="h-4 w-4" />
            </LinkButton>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available demo balance"
          value={formatMoney(wallet.available_cents, settings.currency)}
          hint={wallet.pending_cents > 0 ? `${formatMoney(wallet.pending_cents, settings.currency)} pending review` : "No pending balance"}
          icon={<Wallet className="h-5 w-5" />}
          href="/dashboard/wallet"
        />
        <StatCard
          label="Completed advertisements"
          value={stats.completed}
          hint={`${availableCount} available now`}
          icon={<Clapperboard className="h-5 w-5" />}
          tone="success"
          href="/dashboard/ad-history"
        />
        <StatCard
          label="Demo rewards earned"
          value={formatMoney(stats.earned, settings.currency)}
          hint={`${stats.started} total sessions`}
          icon={<Sparkles className="h-5 w-5" />}
          tone="brand"
          href="/dashboard/transactions"
        />
        <StatCard
          label="Referral rewards"
          value={formatMoney(referrals.earned, settings.currency)}
          hint={`${referrals.total} referral${referrals.total === 1 ? "" : "s"} · ${referrals.pending} pending`}
          icon={<Users2 className="h-5 w-5" />}
          tone="warning"
          href="/dashboard/referrals"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Demo earnings · last 7 days"
            description="Credits from completed advertisements and qualified referrals."
            actions={<Badge tone="brand">Simulated</Badge>}
          />
          <CardBody>
            {trendData.some((point) => point.value > 0) ? (
              <AreaTrend data={trendData} height={230} seriesLabels={["Demo credits", "Previous"]} />
            ) : (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="No demo credits yet"
                description="Complete an advertisement after activation and your verified demo reward will appear here."
                action={
                  isActive ? (
                    <LinkButton href="/dashboard/ads" size="sm" variant="secondary">
                      Browse advertisements
                    </LinkButton>
                  ) : null
                }
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Membership" description="Your current membership state." actions={<LinkButton href="/dashboard/membership" variant="ghost" size="sm">Manage</LinkButton>} />
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-navy">{membership?.plan_name ?? plan.name}</p>
                <p className="text-[11.5px] text-muted">
                  {membership?.activated_at ? `Activated ${formatDate(membership.activated_at)}` : "Not activated yet"}
                </p>
              </div>
              <Badge tone={membership?.status === "ACTIVE" ? "success" : "warning"}>{statusLabel(membership?.status ?? "PENDING")}</Badge>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[11.5px] text-muted">
                <span>Profile & account</span>
                <span>{user.accountStatus === "ACTIVE" ? "Active" : statusLabel(user.accountStatus)}</span>
              </div>
              <Progress value={user.accountStatus === "ACTIVE" ? 100 : 45} tone={user.accountStatus === "ACTIVE" ? "success" : "brand"} />
            </div>
            <dl className="divide-y divide-line/70 text-[12.5px]">
              <div className="flex justify-between py-2">
                <dt className="text-muted">Member ID</dt>
                <dd className="font-mono text-[11.5px] text-ink">{user.memberId}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Referral code</dt>
                <dd className="font-mono text-[11.5px] text-ink">{user.referralCode}</dd>
              </div>
              <div className="flex justify-between py-2">
                <dt className="text-muted">Member since</dt>
                <dd className="text-ink">{formatDate(user.createdAt)}</dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title="Available advertisements"
            description="Eligible for your membership and bundles."
            actions={<LinkButton href="/dashboard/ads" variant="ghost" size="sm">View all</LinkButton>}
          />
          {available.length === 0 ? (
            <EmptyState
              icon={<Megaphone className="h-5 w-5" />}
              title="No advertisements available"
              description={isActive ? "Everything available has been completed. New campaigns appear here automatically." : "Activate your membership to unlock the advertisement library."}
            />
          ) : (
            <div className="divide-y divide-line/70">
              {available.slice(0, 3).map((ad) => (
                <Link key={ad.id} href={`/dashboard/ads/${ad.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#fafcff] sm:px-6">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brandsoft text-brand">
                    <PlayCircle className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-navy">{ad.title}</p>
                    <p className="truncate text-[11.5px] text-muted">
                      {ad.campaign_name} · {ad.required_watch_seconds}s required
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[#e9f8f1] px-2.5 py-1 text-[11.5px] font-semibold text-success">
                    {formatMoney(ad.reward_cents, settings.currency)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent demo wallet activity"
            actions={<LinkButton href="/dashboard/transactions" variant="ghost" size="sm">Ledger</LinkButton>}
          />
          {recentTxns.length === 0 ? (
            <EmptyState icon={<Banknote className="h-5 w-5" />} title="No transactions yet" description="Your ledger will appear here after your first verified reward." />
          ) : (
            <div className="divide-y divide-line/70">
              {recentTxns.map((txn) => (
                <div key={txn.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${txn.direction === "CREDIT" ? "bg-[#e9f8f1] text-success" : "bg-surface text-muted"}`}>
                    {txn.direction === "CREDIT" ? <CheckCircle2 className="h-4 w-4" /> : <Banknote className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium text-ink">{txn.description}</p>
                    <p className="text-[11px] text-muted">{relativeTime(txn.created_at)}</p>
                  </div>
                  <span className={`shrink-0 text-[12.5px] font-semibold ${txn.direction === "CREDIT" ? "text-success" : "text-ink"}`}>
                    {txn.direction === "CREDIT" ? "+" : "−"}
                    {formatMoney(txn.amount_cents, settings.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Inbox"
          description="The latest updates from the platform."
          actions={<LinkButton href="/dashboard/notifications" variant="ghost" size="sm">All notifications</LinkButton>}
        />
        {notifications.length === 0 ? (
          <EmptyState icon={<Bell className="h-5 w-5" />} title="You are all caught up" />
        ) : (
          <div className="divide-y divide-line/70">
            {notifications.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3.5 sm:px-6">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${item.read_at ? "bg-line" : "bg-brand"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold text-navy">{item.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-muted">{item.body}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted">{relativeTime(item.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: "/dashboard/referrals", icon: Users2, title: "Invite with your code", body: "Share your referral link and track pending and qualified invites." },
          { href: "/dashboard/support", icon: Bell, title: "Need a hand?", body: "Open a support ticket and follow every reply in one thread." },
          { href: "/dashboard/security", icon: BadgeCheck, title: "Keep your account safe", body: "Change your password and review your active sessions." },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="group rounded-2xl border border-line bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-float">
              <Icon className="h-5 w-5 text-brand" />
              <p className="mt-2.5 text-[13px] font-semibold text-navy">{item.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-brand">
                Open <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
