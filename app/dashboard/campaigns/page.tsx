import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Megaphone, PlayCircle, Target } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { getMembership } from "@/lib/services/membership";
import { getSettings } from "@/lib/settings";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, Progress, StatCard } from "@/components/ui/primitives";
import { formatDate, formatMoney, pct } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

type CampaignRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  advertiser_name: string;
  status: string;
  start_date: string;
  end_date: string;
  default_reward_cents: number;
  total_ad_allocation: number;
  ad_count: number;
  completed: number;
  potential_cents: number;
};

export default async function CampaignsPage() {
  const user = await requireMember("/dashboard/campaigns");
  const [membership, settings, campaigns] = await Promise.all([
    getMembership(user.id),
    getSettings(),
    query<CampaignRow>(
      `SELECT c.id, c.code, c.name, c.description, c.advertiser_name, c.status,
              to_char(c.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(c.end_date, 'YYYY-MM-DD') AS end_date,
              c.default_reward_cents, c.total_ad_allocation,
              (SELECT count(*)::int FROM advertisements a WHERE a.campaign_id = c.id AND a.status = 'ACTIVE') AS ad_count,
              (SELECT count(*)::int FROM ad_sessions s JOIN advertisements a ON a.id = s.advertisement_id
                WHERE a.campaign_id = c.id AND s.user_id = $1 AND s.status = 'COMPLETED') AS completed,
              (SELECT COALESCE(sum(a.reward_cents),0)::int FROM advertisements a WHERE a.campaign_id = c.id AND a.status = 'ACTIVE') AS potential_cents
         FROM campaigns c
        WHERE c.status IN ('ACTIVE','SCHEDULED','COMPLETED')
        ORDER BY CASE c.status WHEN 'ACTIVE' THEN 0 WHEN 'SCHEDULED' THEN 1 ELSE 2 END, c.end_date ASC`,
      [user.id],
    ),
  ]);

  const activeCampaigns = campaigns.filter((campaign) => campaign.status === "ACTIVE");
  const totalAvailable = campaigns.reduce((sum, campaign) => sum + campaign.ad_count, 0);
  const totalCompleted = campaigns.reduce((sum, campaign) => sum + campaign.completed, 0);
  const potential = campaigns.reduce((sum, campaign) => sum + campaign.potential_cents, 0);
  const membershipActive = membership?.status === "ACTIVE";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advertising"
        title="Campaigns"
        description="Browse active advertising campaigns and see your verified participation in each one."
        actions={
          membershipActive ? (
            <LinkButton href="/dashboard/ads" size="sm">
              <PlayCircle className="h-4 w-4" /> Watch advertisements
            </LinkButton>
          ) : (
            <LinkButton href="/dashboard/membership" size="sm">
              Activate membership
            </LinkButton>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active campaigns" value={activeCampaigns.length} icon={<Megaphone className="h-5 w-5" />} />
        <StatCard label="Available advertisements" value={totalAvailable} icon={<PlayCircle className="h-5 w-5" />} tone="brand" />
        <StatCard label="Your completions" value={totalCompleted} icon={<Target className="h-5 w-5" />} tone="success" />
        <StatCard
          label="Demo reward pool"
          value={formatMoney(potential, settings.currency)}
          hint="If every available ad is completed"
          icon={<CalendarDays className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Megaphone className="h-5 w-5" />}
            title="No campaigns are visible yet"
            description="Campaigns appear here once administrators publish them and your membership is active."
            action={!membershipActive ? <LinkButton href="/dashboard/membership" size="sm">Activate membership</LinkButton> : null}
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {campaigns.map((campaign) => {
            const participation = campaign.ad_count > 0 ? pct(campaign.completed, campaign.ad_count) : 0;
            const ended = campaign.status === "COMPLETED" || new Date(campaign.end_date) < new Date();
            return (
              <Card key={campaign.id} className="flex flex-col">
                <CardHeader
                  title={campaign.name}
                  description={`${campaign.advertiser_name} · ${campaign.code}`}
                  actions={<Badge tone={STATUS_TONE[campaign.status] ?? "neutral"}>{statusLabel(campaign.status)}</Badge>}
                />
                <CardBody className="flex flex-1 flex-col gap-4">
                  <p className="line-clamp-3 text-[12.5px] leading-relaxed text-muted">{campaign.description || "No description provided."}</p>
                  <div className="grid grid-cols-2 gap-3 text-[12px]">
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Advertisements</p>
                      <p className="mt-0.5 font-semibold text-navy">{campaign.ad_count}</p>
                    </div>
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Default reward</p>
                      <p className="mt-0.5 font-semibold text-navy">{formatMoney(campaign.default_reward_cents, settings.currency)}</p>
                    </div>
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Starts</p>
                      <p className="mt-0.5 font-medium text-ink">{formatDate(campaign.start_date)}</p>
                    </div>
                    <div className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-muted">Ends</p>
                      <p className="mt-0.5 font-medium text-ink">{formatDate(campaign.end_date)}</p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1.5 flex justify-between text-[11.5px] text-muted">
                      <span>Your participation</span>
                      <span>
                        {campaign.completed}/{campaign.ad_count} completed
                      </span>
                    </div>
                    <Progress value={participation} tone={participation >= 100 ? "success" : "brand"} />
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                    <span className="text-[11.5px] text-muted">
                      {campaign.potential_cents > 0 ? `${formatMoney(campaign.potential_cents, settings.currency)} in available demo rewards` : "No rewards configured"}
                    </span>
                    {ended ? (
                      <span className="text-[11.5px] font-medium text-muted">Campaign ended</span>
                    ) : (
                      <Link href="/dashboard/ads" className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:text-brand-dark">
                        View advertisements <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
