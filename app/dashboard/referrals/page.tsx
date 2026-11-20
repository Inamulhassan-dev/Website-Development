import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock3, Gift, Link2, ShieldCheck, Sparkles, Users2 } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { getReferrer, listReferrals, referralStats } from "@/lib/services/referrals";
import { getSettings } from "@/lib/settings";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, StatCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/primitives";
import { CopyButton } from "@/components/ui/interactive";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Referrals" };
export const dynamic = "force-dynamic";

export default async function ReferralsPage() {
  const user = await requireMember("/dashboard/referrals");
  const [stats, rows, settings, referrer] = await Promise.all([
    referralStats(user.id),
    listReferrals(user.id),
    getSettings(),
    getReferrer(user.id),
  ]);

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = `${base}/register?ref=${user.referralCode}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Growth"
        title="Referrals"
        description="Invite people you trust. When a referred member activates their demo membership, your reward is credited once."
        actions={<LinkButton href="/dashboard/wallet" variant="secondary" size="sm">View wallet</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total referrals" value={stats.total} icon={<Users2 className="h-5 w-5" />} />
        <StatCard label="Pending" value={stats.pending} icon={<Clock3 className="h-5 w-5" />} tone="warning" hint="Awaiting activation" />
        <StatCard label="Qualified" value={stats.qualified} icon={<BadgeCheck className="h-5 w-5" />} tone="success" />
        <StatCard
          label="Demo rewards earned"
          value={formatMoney(stats.earned, settings.currency)}
          hint={`${formatMoney(settings.referral_reward_cents, settings.currency)} per qualified referral`}
          icon={<Gift className="h-5 w-5" />}
          tone="brand"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardHeader title="Your invitation" description="Share your link or code. Attribution happens at registration." />
          <CardBody className="space-y-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Referral link</p>
              <div className="mt-1.5 flex flex-col gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 sm:flex-row sm:items-center">
                <Link2 className="hidden h-4 w-4 shrink-0 text-muted sm:block" />
                <span className="flex-1 truncate font-mono text-[11.5px] text-ink">{link}</span>
                <CopyButton value={link} label="Copy link" />
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">Referral code</p>
              <div className="mt-1.5 flex items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5">
                <span className="font-mono text-[14px] font-semibold tracking-wide text-navy">{user.referralCode}</span>
                <CopyButton value={user.referralCode} label="Copy code" />
              </div>
            </div>
            <div className="rounded-xl border border-[#cfe2ff] bg-brandsoft px-3.5 py-3 text-[12px] leading-relaxed text-brand">
              <span className="font-semibold">Self-referral is blocked.</span> The same email or mobile number cannot refer
              itself, and each referred account can be attributed only once.
            </div>
            {referrer ? (
              <p className="text-[12px] text-muted">
                You joined through <span className="font-medium text-ink">{referrer.full_name}</span> ({referrer.member_id}).
              </p>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How it works" description="Three clear steps, no surprises." />
          <CardBody>
            <ol className="space-y-3.5">
              {[
                { title: "Share your link", body: "Send your personal link to someone who may be interested." },
                { title: "They register", body: "Your code is attached to their new account at registration." },
                { title: "They activate", body: "When their DEMO membership activates, the referral becomes qualified." },
                { title: "Reward credited once", body: "A simulated reward enters your demo wallet. Duplicate credits are impossible." },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brandsoft text-[11px] font-bold text-brand">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-navy">{step.title}</p>
                    <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Referral activity"
          description="Members you invited and their qualification state."
          actions={<Badge tone={settings.referral_enabled ? "success" : "neutral"}>{settings.referral_enabled ? "Programme enabled" : "Programme paused"}</Badge>}
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Users2 className="h-5 w-5" />}
            title="No referrals yet"
            description="Copy your link above and share it. New referrals appear here as soon as someone registers with your code."
            action={<CopyButton value={link} label="Copy referral link" />}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Member</Th>
                  <Th>Member ID</Th>
                  <Th>Status</Th>
                  <Th>Reward</Th>
                  <Th>Attributed</Th>
                  <Th>Qualified</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <p className="font-medium text-navy">{row.referred_name}</p>
                      <p className="text-[11px] text-muted">{statusLabel(row.referred_status)} account</p>
                    </Td>
                    <Td className="font-mono text-[11.5px] text-muted">{row.referred_member_id}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</Badge>
                    </Td>
                    <Td className={row.status === "REWARDED" ? "font-semibold text-success" : "text-muted"}>
                      {row.status === "REWARDED" ? formatMoney(row.reward_cents, settings.currency) : "—"}
                    </Td>
                    <Td className="text-muted">{formatDate(row.created_at)}</Td>
                    <Td className="text-muted">{formatDate(row.qualified_at)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Sparkles, title: "Simulated rewards", body: "Referral rewards are demo credits only. There is no cash value and no income promise." },
          { icon: ShieldCheck, title: "Fair attribution", body: "Codes are validated at registration and self-referral is rejected server-side." },
          { icon: ArrowRight, title: "Transparent status", body: "Track pending, qualified and rewarded referrals with clear timestamps." },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="p-4">
              <Icon className="h-5 w-5 text-brand" />
              <p className="mt-2 text-[13px] font-semibold text-navy">{item.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
            </Card>
          );
        })}
      </div>

      <p className="text-[11.5px] text-muted">
        Questions about a referral?{" "}
        <Link href="/dashboard/support" className="font-semibold text-brand hover:text-brand-dark">
          Contact support
        </Link>
        .
      </p>
    </div>
  );
}
