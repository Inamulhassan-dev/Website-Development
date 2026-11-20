import type { Metadata } from "next";
import Link from "next/link";
import { Clapperboard, Plus, Search } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { setAdvertisementStatusAction } from "@/lib/actions/admin";
import { Badge, Card, CardHeader, EmptyState, Input, LinkButton, PageHeader, Select, StatCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Advertisements" };
export const dynamic = "force-dynamic";

export default async function AdminAdvertisementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; campaign?: string; q?: string }>;
}) {
  await requireAdminPage("ads.view");
  const params = await searchParams;
  const status = params.status && params.status !== "ALL" ? params.status : null;
  const campaign = params.campaign || null;
  const q = (params.q ?? "").trim().slice(0, 80);

  const [ads, campaigns, stats, settings] = await Promise.all([
    query<{
      id: string; code: string; title: string; advertiser_name: string; status: string;
      duration_seconds: number; required_watch_seconds: number; reward_cents: number;
      start_date: string; end_date: string; thumbnail_url: string | null; video_url: string;
      campaign_name: string; bundle_count: number; completions: number; flagged: number;
    }>(
      `SELECT a.id, a.code, a.title, a.advertiser_name, a.status, a.duration_seconds, a.required_watch_seconds,
              a.reward_cents, to_char(a.start_date,'YYYY-MM-DD') AS start_date, to_char(a.end_date,'YYYY-MM-DD') AS end_date,
              a.thumbnail_url, a.video_url, c.name AS campaign_name,
              (SELECT count(*)::int FROM bundle_advertisements ba WHERE ba.advertisement_id = a.id) AS bundle_count,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.advertisement_id = a.id AND s.status = 'COMPLETED') AS completions,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.advertisement_id = a.id AND s.status = 'FLAGGED') AS flagged
         FROM advertisements a JOIN campaigns c ON c.id = a.campaign_id
        WHERE ($1::text IS NULL OR a.status = $1)
          AND ($2::text IS NULL OR a.campaign_id = $2)
          AND ($3 = '' OR a.title ILIKE '%' || $3 || '%' OR a.code ILIKE '%' || $3 || '%' OR a.advertiser_name ILIKE '%' || $3 || '%')
        ORDER BY a.created_at DESC LIMIT 200`,
      [status, campaign, q],
    ),
    query<{ id: string; name: string; status: string }>(`SELECT id, name, status FROM campaigns ORDER BY created_at DESC`),
    query<{ total: number; active: number; paused: number; completions: number }>(
      `SELECT (SELECT count(*)::int FROM advertisements) AS total,
              (SELECT count(*)::int FROM advertisements WHERE status = 'ACTIVE') AS active,
              (SELECT count(*)::int FROM advertisements WHERE status = 'PAUSED') AS paused,
              (SELECT count(*)::int FROM ad_sessions WHERE status = 'COMPLETED') AS completions`,
    ),
    getSettings(),
  ]);
  const s = stats[0] ?? { total: 0, active: 0, paused: 0, completions: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advertising"
        title="Advertisements"
        description="Upload creatives, set verified watch requirements and manage status."
        actions={<LinkButton href="/admin/advertisements/new" size="sm"><Plus className="h-4 w-4" /> New advertisement</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Advertisements" value={s.total} icon={<Clapperboard className="h-5 w-5" />} />
        <StatCard label="Active" value={s.active} icon={<Clapperboard className="h-5 w-5" />} tone="success" />
        <StatCard label="Paused" value={s.paused} icon={<Clapperboard className="h-5 w-5" />} tone="warning" />
        <StatCard label="Completions" value={s.completions} icon={<Clapperboard className="h-5 w-5" />} tone="brand" />
      </div>

      <Card>
        <CardHeader title="Filters" description="Find a creative by status, campaign or search." />
        <div className="border-b border-line p-4 sm:p-5">
          <form className="grid gap-2.5 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input name="q" defaultValue={q} placeholder="Search title, code, advertiser" className="pl-9" />
            </div>
            <Select name="status" defaultValue={status ?? "ALL"} aria-label="Status">
              <option value="ALL">All statuses</option>
              {["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"].map((value) => (
                <option key={value} value={value}>{statusLabel(value)}</option>
              ))}
            </Select>
            <Select name="campaign" defaultValue={campaign ?? ""} aria-label="Campaign">
              <option value="">All campaigns</option>
              {campaigns.map((row) => (
                <option key={row.id} value={row.id}>{row.name}</option>
              ))}
            </Select>
            <SubmitButton variant="secondary">Apply</SubmitButton>
          </form>
        </div>

        {ads.length === 0 ? (
          <EmptyState icon={<Clapperboard className="h-5 w-5" />} title="No advertisements match" description="Try clearing filters or create a new advertisement." />
        ) : (
          <TableWrap>
            <Table className="min-w-[1000px]">
              <thead>
                <tr><Th>Creative</Th><Th>Campaign</Th><Th>Status</Th><Th>Watch</Th><Th className="text-right">Reward</Th><Th>Schedule</Th><Th className="text-right">Bundles</Th><Th className="text-right">Completions</Th><Th /></tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <Tr key={ad.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        {ad.thumbnail_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ad.thumbnail_url} alt="" className="h-9 w-14 rounded-md object-cover" />
                        ) : (
                          <span className="grid h-9 w-14 place-items-center rounded-md bg-navy/90 text-white"><Clapperboard className="h-4 w-4" /></span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy">{ad.title}</p>
                          <p className="font-mono text-[10px] text-muted">{ad.code} · {ad.advertiser_name}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-muted">{ad.campaign_name}</Td>
                    <Td><Badge tone={STATUS_TONE[ad.status] ?? "neutral"}>{statusLabel(ad.status)}</Badge></Td>
                    <Td className="text-muted">{ad.required_watch_seconds}s / {ad.duration_seconds}s</Td>
                    <Td className="text-right font-medium">{formatMoney(ad.reward_cents, settings.currency)}</Td>
                    <Td className="whitespace-nowrap text-muted">{formatDate(ad.start_date)} → {formatDate(ad.end_date)}</Td>
                    <Td className="text-right text-muted">{ad.bundle_count || "All"}</Td>
                    <Td className="text-right">
                      {ad.completions}
                      {ad.flagged > 0 ? <span className="ml-1 text-[10px] text-danger">({ad.flagged} flagged)</span> : null}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/advertisements/${ad.id}`} className="text-[12px] font-semibold text-brand hover:text-brand-dark">Edit</Link>
                        {ad.status !== "ARCHIVED" ? (
                          <form action={setAdvertisementStatusAction}>
                            <input type="hidden" name="advertisementId" value={ad.id} />
                            <input type="hidden" name="status" value={ad.status === "ACTIVE" ? "PAUSED" : "ACTIVE"} />
                            <SubmitButton variant="ghost" size="sm" pendingLabel="…">{ad.status === "ACTIVE" ? "Pause" : "Activate"}</SubmitButton>
                          </form>
                        ) : null}
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11.5px] text-muted">Archived advertisements are read-only. Advertisements with viewing history cannot be deleted; archive them instead.</p>
    </div>
  );
}
