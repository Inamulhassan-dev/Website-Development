import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive, Clapperboard, PlayCircle, Target, Users2 } from "lucide-react";
import { can, requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { setCampaignStatusAction, updateCampaignAction } from "@/lib/actions/admin";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, LinkButton, PageHeader, Select, StatCard, Table, TableWrap, Td, Textarea, Th, Tr } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney } from "@/lib/format";
import { CAMPAIGN_STATUSES, STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Campaign detail" };
export const dynamic = "force-dynamic";

export default async function AdminCampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage("campaigns.view");
  const { id } = await params;
  const campaign = await one<{
    id: string; code: string; name: string; description: string; advertiser_name: string; status: string;
    start_date: string; end_date: string; total_ad_allocation: number; default_reward_cents: number; terms: string; created_at: Date;
    ad_total: number; completed_sessions: number; unique_members: number; rewards_paid: number; flagged: number;
  }>(
    `SELECT c.id, c.code, c.name, c.description, c.advertiser_name, c.status,
            to_char(c.start_date, 'YYYY-MM-DD') AS start_date, to_char(c.end_date, 'YYYY-MM-DD') AS end_date,
            c.total_ad_allocation, c.default_reward_cents, c.terms, c.created_at,
            (SELECT count(*)::int FROM advertisements a WHERE a.campaign_id = c.id) AS ad_total,
            (SELECT count(*)::int FROM ad_sessions s WHERE s.campaign_id = c.id AND s.status = 'COMPLETED') AS completed_sessions,
            (SELECT count(DISTINCT s.user_id)::int FROM ad_sessions s WHERE s.campaign_id = c.id AND s.status = 'COMPLETED') AS unique_members,
            (SELECT COALESCE(sum(w.amount_cents),0)::int FROM wallet_transactions w JOIN ad_sessions s2 ON s2.id = w.related_id
              WHERE s2.campaign_id = c.id AND w.type = 'AD_REWARD' AND w.status = 'COMPLETED') AS rewards_paid,
            (SELECT count(*)::int FROM ad_sessions s WHERE s.campaign_id = c.id AND s.status = 'FLAGGED') AS flagged
       FROM campaigns c WHERE c.id = $1`,
    [id],
  );
  if (!campaign) notFound();

  const [ads, settings] = await Promise.all([
    query<{ id: string; code: string; title: string; status: string; duration_seconds: number; required_watch_seconds: number; reward_cents: number; completions: number }>(
      `SELECT a.id, a.code, a.title, a.status, a.duration_seconds, a.required_watch_seconds, a.reward_cents,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.advertisement_id = a.id AND s.status = 'COMPLETED') AS completions
         FROM advertisements a WHERE a.campaign_id = $1 ORDER BY a.display_order ASC, a.created_at DESC`,
      [campaign.id],
    ),
    getSettings(),
  ]);

  const canManage = can(admin, "campaigns.manage");
  const archived = campaign.status === "ARCHIVED";

  return (
    <div className="space-y-6">
      <Link href="/admin/campaigns" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-navy">
        <ArrowLeft className="h-3.5 w-3.5" /> All campaigns
      </Link>

      <PageHeader
        eyebrow={campaign.code}
        title={campaign.name}
        description={`${campaign.advertiser_name} · ${formatDate(campaign.start_date)} to ${formatDate(campaign.end_date)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[campaign.status] ?? "neutral"}>{statusLabel(campaign.status)}</Badge>
            <LinkButton href={`/admin/advertisements/new?campaign=${campaign.id}`} size="sm" variant="secondary">
              <Clapperboard className="h-4 w-4" /> Add advertisement
            </LinkButton>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Advertisements" value={campaign.ad_total} icon={<Clapperboard className="h-5 w-5" />} />
        <StatCard label="Completed sessions" value={campaign.completed_sessions} icon={<PlayCircle className="h-5 w-5" />} tone="success" />
        <StatCard label="Unique members" value={campaign.unique_members} icon={<Users2 className="h-5 w-5" />} tone="brand" />
        <StatCard label="Demo rewards paid" value={formatMoney(Number(campaign.rewards_paid), settings.currency)} icon={<Target className="h-5 w-5" />} tone="warning" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title="Campaign settings" description={archived ? "Archived campaigns are read-only." : "Changes apply immediately."} />
          <CardBody>
            {canManage ? (
              <form action={updateCampaignAction} className="space-y-4">
                <input type="hidden" name="campaignId" value={campaign.id} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Name" htmlFor="name"><Input id="name" name="name" defaultValue={campaign.name} disabled={archived} required minLength={3} maxLength={140} /></Field>
                  <Field label="Advertiser" htmlFor="advertiser"><Input id="advertiser" name="advertiser" defaultValue={campaign.advertiser_name} disabled={archived} required maxLength={140} /></Field>
                </div>
                <Field label="Description" htmlFor="description"><Textarea id="description" name="description" defaultValue={campaign.description} disabled={archived} maxLength={3000} className="min-h-[80px]" /></Field>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Start" htmlFor="startDate"><Input id="startDate" name="startDate" type="date" defaultValue={campaign.start_date} disabled={archived} required /></Field>
                  <Field label="End" htmlFor="endDate"><Input id="endDate" name="endDate" type="date" defaultValue={campaign.end_date} disabled={archived} required /></Field>
                  <Field label="Allocation" htmlFor="totalAllocation"><Input id="totalAllocation" name="totalAllocation" type="number" min="0" defaultValue={campaign.total_ad_allocation} disabled={archived} required /></Field>
                  <Field label={`Reward (${settings.currency})`} htmlFor="reward"><Input id="reward" name="reward" type="number" min="0" step="0.01" defaultValue={(Number(campaign.default_reward_cents) / 100).toFixed(2)} disabled={archived} required /></Field>
                </div>
                <Field label="Terms" htmlFor="terms"><Textarea id="terms" name="terms" defaultValue={campaign.terms} disabled={archived} maxLength={4000} className="min-h-[70px]" /></Field>
                <div className="flex justify-end">
                  <SubmitButton disabled={archived} pendingLabel="Saving…">Save campaign</SubmitButton>
                </div>
              </form>
            ) : (
              <p className="text-[12.5px] text-muted">Your role has view-only access to campaigns.</p>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Lifecycle" description="Changing status affects member eligibility immediately." actions={<Archive className="h-4 w-4 text-muted" />} />
            <CardBody>
              {canManage ? (
                <form action={setCampaignStatusAction} className="space-y-3">
                  <input type="hidden" name="campaignId" value={campaign.id} />
                  <Field label="Campaign status" htmlFor="status">
                    <Select id="status" name="status" defaultValue={campaign.status} disabled={archived}>
                      {CAMPAIGN_STATUSES.map((status) => (
                        <option key={status} value={status} disabled={archived && status !== "ARCHIVED"}>{statusLabel(status)}</option>
                      ))}
                    </Select>
                  </Field>
                  <SubmitButton className="w-full" variant="secondary" disabled={archived} confirm="Change this campaign's status?">
                    Update status
                  </SubmitButton>
                  {archived ? <p className="text-[11px] text-muted">Archived campaigns cannot be reactivated.</p> : null}
                </form>
              ) : (
                <p className="text-[12.5px] text-muted">Status changes require campaign management permission.</p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Delivery summary" />
            <CardBody className="space-y-2 text-[12.5px]">
              {[
                ["Allocation", `${campaign.total_ad_allocation.toLocaleString()} ads`],
                ["Advertisements", String(campaign.ad_total)],
                ["Completed sessions", String(campaign.completed_sessions)],
                ["Flagged sessions", String(campaign.flagged)],
                ["Demo rewards", formatMoney(Number(campaign.rewards_paid), settings.currency)],
                ["Created", formatDate(campaign.created_at, true)],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3 border-b border-line/60 py-1.5 last:border-0">
                  <span className="text-muted">{label}</span>
                  <span className="font-medium text-ink">{value}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Advertisements in this campaign" description="Open an advertisement to edit its creative and reward." />
        {ads.length === 0 ? (
          <EmptyState icon={<Clapperboard className="h-5 w-5" />} title="No advertisements yet" action={<LinkButton href={`/admin/advertisements/new?campaign=${campaign.id}`} size="sm">Add the first advertisement</LinkButton>} />
        ) : (
          <TableWrap>
            <Table className="min-w-[760px]">
              <thead><tr><Th>Advertisement</Th><Th>Status</Th><Th>Duration</Th><Th>Required</Th><Th className="text-right">Reward</Th><Th className="text-right">Completions</Th><Th /></tr></thead>
              <tbody>
                {ads.map((ad) => (
                  <Tr key={ad.id}>
                    <Td>
                      <p className="font-medium text-navy">{ad.title}</p>
                      <p className="font-mono text-[10.5px] text-muted">{ad.code}</p>
                    </Td>
                    <Td><Badge tone={STATUS_TONE[ad.status] ?? "neutral"}>{statusLabel(ad.status)}</Badge></Td>
                    <Td className="text-muted">{ad.duration_seconds}s</Td>
                    <Td className="text-muted">{ad.required_watch_seconds}s</Td>
                    <Td className="text-right">{formatMoney(ad.reward_cents, settings.currency)}</Td>
                    <Td className="text-right">{ad.completions}</Td>
                    <Td><Link href={`/admin/advertisements/${ad.id}`} className="text-[12px] font-semibold text-brand hover:text-brand-dark">Edit</Link></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}
