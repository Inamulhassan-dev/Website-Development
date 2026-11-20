import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Download, Gift, Link2, RefreshCw, TrendingUp, Users2 } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { rewardQualifiedReferralAction } from "@/lib/actions/admin";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  Progress,
  StatCard,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { BarsChart } from "@/components/charts";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney, pct } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Referrals" };
export const dynamic = "force-dynamic";

export default async function AdminReferralsPage() {
  await requireAdminPage("referrals.view");
  const [metrics, topReferrers, rows, trend, settings] = await Promise.all([
    one<{ total: number; pending: number; qualified: number; rewarded: number; rejected: number; paid: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'PENDING')::int AS pending,
              count(*) FILTER (WHERE status = 'QUALIFIED')::int AS qualified,
              count(*) FILTER (WHERE status = 'REWARDED')::int AS rewarded,
              count(*) FILTER (WHERE status = 'REJECTED')::int AS rejected,
              (SELECT COALESCE(sum(amount_cents),0)::int FROM referral_rewards) AS paid
         FROM referrals`,
    ),
    query<{ referrer_id: string; full_name: string; member_id: string; referral_code: string; invited: number; rewarded: number; earned: number }>(
      `SELECT r.referrer_id, u.full_name, u.member_id, u.referral_code,
              count(*)::int AS invited,
              count(*) FILTER (WHERE r.status = 'REWARDED')::int AS rewarded,
              COALESCE(sum(r.reward_cents),0)::int AS earned
         FROM referrals r JOIN users u ON u.id = r.referrer_id
        GROUP BY r.referrer_id, u.full_name, u.member_id, u.referral_code
        ORDER BY invited DESC, earned DESC LIMIT 12`,
    ),
    query<{
      id: string; code: string; status: string; reward_cents: number; created_at: Date; qualified_at: Date | null;
      referrer_id: string; referrer_name: string; referrer_member_id: string;
      referred_id: string; referred_name: string; referred_member_id: string; referred_status: string;
      membership_status: string | null;
    }>(
      `SELECT r.id, r.code, r.status, r.reward_cents, r.created_at, r.qualified_at,
              ref.id AS referrer_id, ref.full_name AS referrer_name, ref.member_id AS referrer_member_id,
              mem.id AS referred_id, mem.full_name AS referred_name, mem.member_id AS referred_member_id,
              mem.account_status AS referred_status, m.status AS membership_status
         FROM referrals r
         JOIN users ref ON ref.id = r.referrer_id
         JOIN users mem ON mem.id = r.referred_id
         LEFT JOIN memberships m ON m.user_id = mem.id
        ORDER BY r.created_at DESC LIMIT 200`,
    ),
    query<{ label: string; value: number }>(
      `SELECT to_char(d, 'Mon YYYY') AS label, count(r.id)::int AS value
         FROM generate_series(date_trunc('month', CURRENT_DATE) - interval '5 months', date_trunc('month', CURRENT_DATE), interval '1 month') AS d
         LEFT JOIN referrals r ON date_trunc('month', r.created_at) = d
        GROUP BY d ORDER BY d`,
    ),
    getSettings(),
  ]);

  const m = metrics ?? { total: 0, pending: 0, qualified: 0, rewarded: 0, rejected: 0, paid: 0 };
  const conversion = pct(m.rewarded, m.total);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Growth"
        title="Referrals"
        description="Track referral attribution, qualification and simulated reward spend. Rewards are credited exactly once when a referred membership activates."
        actions={<LinkButton href="/api/admin/export?type=referrals" variant="secondary" size="sm"><Download className="h-4 w-4" /> Export CSV</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total referrals" value={m.total} hint={`${m.pending} pending attribution`} icon={<Users2 className="h-5 w-5" />} />
        <StatCard label="Qualified / rewarded" value={`${m.qualified + m.rewarded} / ${m.rewarded}`} hint={`${conversion}% rewarded`} icon={<BadgeCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Demo rewards paid" value={formatMoney(m.paid, settings.currency)} hint={`${formatMoney(settings.referral_reward_cents, settings.currency)} per referral`} icon={<Gift className="h-5 w-5" />} tone="brand" />
        <StatCard
          label="Programme status"
          value={settings.referral_enabled ? "Enabled" : "Paused"}
          hint={settings.referral_enabled ? "New activations qualify" : "Referrals qualify without reward"}
          icon={<TrendingUp className="h-5 w-5" />}
          tone={settings.referral_enabled ? "success" : "warning"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.25fr]">
        <Card>
          <CardHeader title="Referral volume" description="Attributions recorded over the last six months." />
          <CardBody>
            <BarsChart data={trend.map((row) => ({ label: row.label.trim(), value: Number(row.value) }))} height={255} color="#16A36A" />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top referrers" description="Ranked by invitations attributed." />
          {topReferrers.length === 0 ? (
            <EmptyState icon={<Users2 className="h-5 w-5" />} title="No referrals yet" />
          ) : (
            <TableWrap>
              <Table className="min-w-[620px]">
                <thead>
                  <tr><Th>Member</Th><Th className="text-right">Invited</Th><Th className="text-right">Rewarded</Th><Th>Conversion</Th><Th className="text-right">Earned</Th></tr>
                </thead>
                <tbody>
                  {topReferrers.map((row) => (
                    <Tr key={row.referrer_id}>
                      <Td>
                        <Link href={`/admin/users/${row.referrer_id}`} className="font-medium text-navy hover:text-brand">{row.full_name}</Link>
                        <p className="font-mono text-[10px] text-muted">{row.member_id} · {row.referral_code}</p>
                      </Td>
                      <Td className="text-right font-medium">{row.invited}</Td>
                      <Td className="text-right text-muted">{row.rewarded}</Td>
                      <Td>
                        <div className="flex items-center gap-2">
                          <Progress value={pct(row.rewarded, row.invited || 1)} className="w-20" tone="success" />
                          <span className="text-[11px] text-muted">{pct(row.rewarded, row.invited || 1)}%</span>
                        </div>
                      </Td>
                      <Td className="text-right text-muted">{formatMoney(row.earned, settings.currency)}</Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Referral programme"
          description="Configuration applied when a referred membership activates."
          actions={<Link href="/admin/settings" className="text-[12px] font-semibold text-brand hover:text-brand-dark">Edit settings</Link>}
        />
        <CardBody className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Reward per referral</p>
            <p className="mt-1 text-[18px] font-semibold text-navy">{formatMoney(settings.referral_reward_cents, settings.currency)}</p>
            <p className="mt-0.5 text-[11px] text-muted">Simulated wallet credit</p>
          </div>
          <div className="rounded-xl border border-line px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Programme</p>
            <p className="mt-1">
              <Badge tone={settings.referral_enabled ? "success" : "warning"}>{settings.referral_enabled ? "Enabled" : "Paused"}</Badge>
            </p>
            <p className="mt-0.5 text-[11px] text-muted">Pausing stops new credits, not attribution.</p>
          </div>
          <div className="rounded-xl border border-line px-3.5 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Attribution rules</p>
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-navy"><Link2 className="h-3.5 w-3.5 text-brand" /> Code at registration</p>
            <p className="mt-0.5 text-[11px] text-muted">Self-referral and duplicates are blocked.</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="All referrals" description="Inviter, invited member and qualification state." actions={<Badge tone="brand">{m.total} total</Badge>} />
        {rows.length === 0 ? (
          <EmptyState icon={<Users2 className="h-5 w-5" />} title="No referral activity" description="Referrals appear when a new member registers with someone's code." />
        ) : (
          <TableWrap>
            <Table className="min-w-[1080px]">
              <thead>
                <tr><Th>Code</Th><Th>Referrer</Th><Th>Referred member</Th><Th>Membership</Th><Th>Status</Th><Th className="text-right">Reward</Th><Th>Created</Th><Th>Qualified</Th><Th /></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td className="font-mono text-[11px]">{row.code}</Td>
                    <Td>
                      <Link href={`/admin/users/${row.referrer_id}`} className="font-medium text-navy hover:text-brand">{row.referrer_name}</Link>
                      <p className="font-mono text-[10px] text-muted">{row.referrer_member_id}</p>
                    </Td>
                    <Td>
                      <Link href={`/admin/users/${row.referred_id}`} className="font-medium text-navy hover:text-brand">{row.referred_name}</Link>
                      <p className="font-mono text-[10px] text-muted">{row.referred_member_id} · {statusLabel(row.referred_status)}</p>
                    </Td>
                    <Td><Badge tone={STATUS_TONE[row.membership_status ?? "PENDING"] ?? "neutral"}>{statusLabel(row.membership_status ?? "PENDING")}</Badge></Td>
                    <Td><Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</Badge></Td>
                    <Td className={`text-right ${row.status === "REWARDED" ? "font-semibold text-success" : "text-muted"}`}>
                      {row.status === "REWARDED" ? formatMoney(row.reward_cents, settings.currency) : "—"}
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(row.created_at)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(row.qualified_at)}</Td>
                    <Td>
                      {row.status === "PENDING" ? (
                        <form action={rewardQualifiedReferralAction}>
                          <input type="hidden" name="referralId" value={row.id} />
                          <SubmitButton size="sm" variant="ghost" pendingLabel="Checking…" confirm="Re-evaluate this referral? A reward may be credited if the membership is active.">
                            <RefreshCw className="h-3.5 w-3.5" /> Re-check
                          </SubmitButton>
                        </form>
                      ) : (
                        <span className="text-[10.5px] text-muted">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11.5px] text-muted">
        Referral rewards are demo credits with no cash value. A member cannot refer themselves, and each referred account can be
        attributed to only one referrer. Re-checking is idempotent — a referral can never be rewarded twice.
      </p>
    </div>
  );
}
