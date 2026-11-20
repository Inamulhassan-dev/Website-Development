import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Megaphone, Plus, Target } from "lucide-react";
import { can, requireAdminPage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { createCampaignAction, setCampaignStatusAction } from "@/lib/actions/admin";
import { Badge, Card, CardBody, CardHeader, EmptyState, Field, Input, LinkButton, PageHeader, Select, StatCard, Table, TableWrap, Td, Textarea, Th, Tr } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney } from "@/lib/format";
import { CAMPAIGN_STATUSES, STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  const admin = await requireAdminPage("campaigns.view");
  const [rows, stats, settings] = await Promise.all([
    query<{
      id: string; code: string; name: string; advertiser_name: string; status: string;
      start_date: string; end_date: string; total_ad_allocation: number; default_reward_cents: number;
      ad_count: number; completions: number; rewards_paid: number;
    }>(
      `SELECT c.id, c.code, c.name, c.advertiser_name, c.status,
              to_char(c.start_date, 'YYYY-MM-DD') AS start_date,
              to_char(c.end_date, 'YYYY-MM-DD') AS end_date,
              c.total_ad_allocation, c.default_reward_cents,
              (SELECT count(*)::int FROM advertisements a WHERE a.campaign_id = c.id) AS ad_count,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.campaign_id = c.id AND s.status = 'COMPLETED') AS completions,
              (SELECT COALESCE(sum(w.amount_cents),0)::int FROM wallet_transactions w
                JOIN ad_sessions s2 ON s2.id = w.related_id
                WHERE s2.campaign_id = c.id AND w.type = 'AD_REWARD' AND w.status = 'COMPLETED') AS rewards_paid
         FROM campaigns c ORDER BY c.created_at DESC`,
    ),
    query<{ total: number; active: number; ads: number; completions: number }>(
      `SELECT (SELECT count(*)::int FROM campaigns) AS total,
              (SELECT count(*)::int FROM campaigns WHERE status = 'ACTIVE') AS active,
              (SELECT count(*)::int FROM advertisements) AS ads,
              (SELECT count(*)::int FROM ad_sessions WHERE status = 'COMPLETED') AS completions`,
    ),
    getSettings(),
  ]);
  const s = stats[0] ?? { total: 0, active: 0, ads: 0, completions: 0 };
  const canManage = can(admin, "campaigns.manage");

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advertising"
        title="Campaigns"
        description="Group advertisements under campaigns, control lifecycle status and review delivery."
        actions={canManage ? <LinkButton href="/admin/campaigns#new" size="sm"><Plus className="h-4 w-4" /> New campaign</LinkButton> : null}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Campaigns" value={s.total} icon={<Megaphone className="h-5 w-5" />} />
        <StatCard label="Active campaigns" value={s.active} icon={<Target className="h-5 w-5" />} tone="success" />
        <StatCard label="Advertisements" value={s.ads} icon={<CalendarDays className="h-5 w-5" />} tone="brand" />
        <StatCard label="Completed sessions" value={s.completions} icon={<Target className="h-5 w-5" />} tone="warning" />
      </div>

      <Card>
        <CardHeader title="All campaigns" description="Newest first." />
        {rows.length === 0 ? (
          <EmptyState icon={<Megaphone className="h-5 w-5" />} title="No campaigns yet" description="Create the first campaign to start grouping advertisements." />
        ) : (
          <TableWrap>
            <Table className="min-w-[960px]">
              <thead>
                <tr><Th>Campaign</Th><Th>Status</Th><Th>Schedule</Th><Th className="text-right">Allocation</Th><Th className="text-right">Ads</Th><Th className="text-right">Completions</Th><Th className="text-right">Rewards paid</Th><Th /></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <p className="font-medium text-navy">{row.name}</p>
                      <p className="font-mono text-[10.5px] text-muted">{row.code} · {row.advertiser_name}</p>
                    </Td>
                    <Td><Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</Badge></Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(row.start_date)} → {formatDate(row.end_date)}</Td>
                    <Td className="text-right text-muted">{row.total_ad_allocation.toLocaleString()}</Td>
                    <Td className="text-right">{row.ad_count}</Td>
                    <Td className="text-right">{row.completions}</Td>
                    <Td className="text-right font-medium">{formatMoney(Number(row.rewards_paid), settings.currency)}</Td>
                    <Td>
                      <Link href={`/admin/campaigns/${row.id}`} className="text-[12px] font-semibold text-brand hover:text-brand-dark">Manage</Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {canManage ? (
        <Card id="new">
          <CardHeader title="Create a campaign" description="Created as a draft. Activate it when the creatives are ready." />
          <CardBody>
            <form action={createCampaignAction} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Campaign name" htmlFor="name"><Input id="name" name="name" required minLength={3} maxLength={140} placeholder="Spring product launch" /></Field>
                <Field label="Advertiser" htmlFor="advertiser"><Input id="advertiser" name="advertiser" required minLength={2} maxLength={140} placeholder="Advertiser name" /></Field>
              </div>
              <Field label="Description" htmlFor="description"><Textarea id="description" name="description" maxLength={3000} className="min-h-[80px]" placeholder="What is this campaign for?" /></Field>
              <div className="grid gap-3 sm:grid-cols-4">
                <Field label="Start date" htmlFor="startDate"><Input id="startDate" name="startDate" type="date" required /></Field>
                <Field label="End date" htmlFor="endDate"><Input id="endDate" name="endDate" type="date" required /></Field>
                <Field label="Ad allocation" htmlFor="totalAllocation"><Input id="totalAllocation" name="totalAllocation" type="number" min="0" step="1" defaultValue="1000" required /></Field>
                <Field label={`Default reward (${settings.currency})`} htmlFor="reward"><Input id="reward" name="reward" type="number" min="0" step="0.01" defaultValue={(settings.default_reward_cents / 100).toFixed(2)} required /></Field>
              </div>
              <Field label="Terms" htmlFor="terms" hint="Shown to members on the advertisement page."><Textarea id="terms" name="terms" maxLength={4000} className="min-h-[70px]" placeholder="Demonstration terms and conditions" /></Field>
              <div className="flex justify-end"><SubmitButton pendingLabel="Creating…"><Plus className="h-4 w-4" /> Create draft campaign</SubmitButton></div>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <p className="text-[11.5px] text-muted">Campaign status controls whether its advertisements are eligible for members. Archived campaigns are read-only.</p>
    </div>
  );
}
