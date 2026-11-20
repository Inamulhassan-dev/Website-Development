import type { Metadata } from "next";
import Link from "next/link";
import { Boxes, Clapperboard, Layers, Pencil, Plus, Users2 } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { saveBundleAction, toggleBundleStatusAction } from "@/lib/actions/admin";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatCard,
  Table,
  TableWrap,
  Td,
  Textarea,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { SubmitButton, Toggle } from "@/components/ui/interactive";
import { formatDate } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Bundles" };
export const dynamic = "force-dynamic";

export default async function AdminBundlesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdminPage("bundles.view");
  const params = await searchParams;
  const editId = params.edit ?? null;

  const [bundles, ads, stats, editing, selectedAds] = await Promise.all([
    query<{
      id: string;
      code: string;
      name: string;
      description: string;
      ad_count: number;
      eligibility: string;
      status: string;
      display_order: number;
      updated_at: Date;
      assigned_ads: number;
      members: number;
      completions: number;
    }>(
      `SELECT b.id, b.code, b.name, b.description, b.ad_count, b.eligibility, b.status, b.display_order, b.updated_at,
              (SELECT count(*)::int FROM bundle_advertisements ba WHERE ba.bundle_id = b.id) AS assigned_ads,
              (SELECT count(*)::int FROM member_bundles mb WHERE mb.bundle_id = b.id) AS members,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.bundle_id = b.id AND s.status = 'COMPLETED') AS completions
         FROM bundles b ORDER BY b.display_order ASC, b.created_at ASC`,
    ),
    query<{ id: string; code: string; title: string; status: string; campaign_name: string }>(
      `SELECT a.id, a.code, a.title, a.status, c.name AS campaign_name
         FROM advertisements a JOIN campaigns c ON c.id = a.campaign_id
        WHERE a.status <> 'ARCHIVED'
        ORDER BY c.name ASC, a.display_order ASC, a.created_at ASC LIMIT 300`,
    ),
    one<{ total: number; active: number; members: number; assigned: number }>(
      `SELECT (SELECT count(*)::int FROM bundles) AS total,
              (SELECT count(*)::int FROM bundles WHERE status = 'ACTIVE') AS active,
              (SELECT count(DISTINCT user_id)::int FROM member_bundles) AS members,
              (SELECT count(*)::int FROM bundle_advertisements) AS assigned`,
    ),
    editId
      ? one<{ id: string; name: string; description: string; ad_count: number; status: string; eligibility: string; display_order: number }>(
          `SELECT id, name, description, ad_count, status, eligibility, display_order FROM bundles WHERE id = $1`,
          [editId],
        )
      : Promise.resolve(null),
    editId
      ? query<{ advertisement_id: string }>(`SELECT advertisement_id FROM bundle_advertisements WHERE bundle_id = $1`, [editId])
      : Promise.resolve([]),
  ]);

  const selected = new Set(selectedAds.map((row) => row.advertisement_id));
  const s = stats ?? { total: 0, active: 0, members: 0, assigned: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advertising"
        title="Ad bundles"
        description="Group advertisements into curated viewing bundles. Members can receive bundle access individually or see public bundles."
        actions={
          editing ? (
            <Link href="/admin/bundles" className="text-[12.5px] font-semibold text-brand hover:text-brand-dark">
              Cancel editing
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bundles" value={s.total} icon={<Boxes className="h-5 w-5" />} />
        <StatCard label="Active bundles" value={s.active} icon={<Layers className="h-5 w-5" />} tone="success" />
        <StatCard label="Members with access" value={s.members} icon={<Users2 className="h-5 w-5" />} tone="brand" />
        <StatCard label="Ad placements" value={s.assigned} hint="Across all bundles" icon={<Clapperboard className="h-5 w-5" />} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.35fr]">
        <Card className="h-fit">
          <CardHeader
            title={editing ? "Edit bundle" : "Create a bundle"}
            description={editing ? "Changes replace the current advertisement selection." : "Bundles can be public or restricted to granted members."}
          />
          <CardBody>
            <form action={saveBundleAction} className="space-y-4">
              {editing ? <input type="hidden" name="bundleId" value={editing.id} /> : null}
              <Field label="Bundle name" htmlFor="name">
                <Input id="name" name="name" defaultValue={editing?.name ?? ""} required minLength={2} maxLength={120} placeholder="Daily discovery" />
              </Field>
              <Field label="Description" htmlFor="description">
                <Textarea id="description" name="description" defaultValue={editing?.description ?? ""} maxLength={500} className="min-h-[80px]" placeholder="A short summary members will see." />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Advertisement slots" htmlFor="adCount" hint="1–500.">
                  <Input id="adCount" name="adCount" type="number" min={1} max={500} defaultValue={editing?.ad_count ?? 10} required />
                </Field>
                <Field label="Display order" htmlFor="displayOrder">
                  <Input id="displayOrder" name="displayOrder" type="number" min={0} max={999} defaultValue={editing?.display_order ?? 0} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Eligibility" htmlFor="eligibility">
                  <Select id="eligibility" name="eligibility" defaultValue={editing?.eligibility ?? "ALL_MEMBERS"}>
                    <option value="ALL_MEMBERS">All members</option>
                    <option value="RESTRICTED">Restricted access</option>
                  </Select>
                </Field>
                <Field label="Status" htmlFor="status">
                  <div className="flex h-11 items-center">
                    <Toggle name="status" defaultChecked={(editing?.status ?? "ACTIVE") === "ACTIVE"} label="Active" />
                  </div>
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-medium text-ink">Advertisements</p>
                <p className="mb-2 text-[12px] text-muted">Select the creatives included in this bundle.</p>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-line p-2 scrollbar-thin">
                  {ads.length === 0 ? (
                    <p className="px-2 py-3 text-[12px] text-muted">No advertisements available yet.</p>
                  ) : (
                    ads.map((ad) => (
                      <label key={ad.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 transition hover:bg-surface">
                        <input
                          type="checkbox"
                          name="adIds"
                          value={ad.id}
                          defaultChecked={selected.has(ad.id)}
                          className="mt-0.5 h-4 w-4 rounded border-line accent-[#1769e0]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] font-medium text-ink">{ad.title}</span>
                          <span className="block truncate font-mono text-[10px] text-muted">
                            {ad.code} · {ad.campaign_name} · {statusLabel(ad.status)}
                          </span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <SubmitButton className="w-full" pendingLabel="Saving bundle…">
                {editing ? "Save changes" : <><Plus className="h-4 w-4" /> Create bundle</>}
              </SubmitButton>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="All bundles" description="Display order controls how bundles appear to members." />
          {bundles.length === 0 ? (
            <EmptyState icon={<Boxes className="h-5 w-5" />} title="No bundles yet" description="Create your first bundle to group advertisements for members." />
          ) : (
            <TableWrap>
              <Table className="min-w-[780px]">
                <thead>
                  <tr><Th>Bundle</Th><Th>Status</Th><Th>Eligibility</Th><Th className="text-right">Ads</Th><Th className="text-right">Members</Th><Th className="text-right">Completions</Th><Th>Updated</Th><Th /></tr>
                </thead>
                <tbody>
                  {bundles.map((bundle) => (
                    <Tr key={bundle.id}>
                      <Td>
                        <p className="font-medium text-navy">{bundle.name}</p>
                        <p className="font-mono text-[10px] text-muted">{bundle.code} · order {bundle.display_order}</p>
                        {bundle.description ? <p className="mt-0.5 line-clamp-1 max-w-xs text-[11px] text-muted">{bundle.description}</p> : null}
                      </Td>
                      <Td><Badge tone={STATUS_TONE[bundle.status] ?? "neutral"}>{statusLabel(bundle.status)}</Badge></Td>
                      <Td className="text-muted">{statusLabel(bundle.eligibility)}</Td>
                      <Td className="text-right text-muted">
                        {bundle.assigned_ads}/{bundle.ad_count}
                      </Td>
                      <Td className="text-right text-muted">{bundle.members}</Td>
                      <Td className="text-right">{bundle.completions}</Td>
                      <Td className="whitespace-nowrap text-muted">{formatDate(bundle.updated_at)}</Td>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <Link href={`/admin/bundles?edit=${bundle.id}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:text-brand-dark">
                            <Pencil className="h-3 w-3" /> Edit
                          </Link>
                          <form action={toggleBundleStatusAction}>
                            <input type="hidden" name="bundleId" value={bundle.id} />
                            <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                              {bundle.status === "ACTIVE" ? "Disable" : "Enable"}
                            </SubmitButton>
                          </form>
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </div>

      <div className="rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
        <span className="font-semibold text-navy">How bundles work.</span> Public bundles are visible to every active member.
        Restricted bundles only appear when a staff member grants access from the member profile. Bundle access never involves
        a payment in this demonstration.
      </div>
    </div>
  );
}
