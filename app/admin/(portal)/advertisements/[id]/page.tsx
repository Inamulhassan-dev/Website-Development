import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, PlayCircle, Trash2 } from "lucide-react";
import { can, requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { deleteAdvertisementAction } from "@/lib/actions/admin";
import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { AdvertisementForm, type AdFormValues } from "@/components/admin/advertisement-form";
import { formatDate, formatMoney } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Edit advertisement" };
export const dynamic = "force-dynamic";

export default async function EditAdvertisementPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage("ads.manage");
  const { id } = await params;
  const ad = await one<AdFormValues & {
    code: string;
    created_at: Date;
    completed: number;
    flagged: number;
    session_count: number;
  }>(
    `SELECT a.id, a.code, a.title, a.advertiser_name, a.description, a.campaign_id, a.video_url, a.thumbnail_url,
            a.duration_seconds, a.reward_cents, a.required_watch_seconds,
            to_char(a.start_date,'YYYY-MM-DD') AS start_date, to_char(a.end_date,'YYYY-MM-DD') AS end_date,
            a.display_order, a.status, a.created_at,
            (SELECT count(*)::int FROM ad_sessions s WHERE s.advertisement_id = a.id AND s.status = 'COMPLETED') AS completed,
            (SELECT count(*)::int FROM ad_sessions s WHERE s.advertisement_id = a.id AND s.status = 'FLAGGED') AS flagged,
            (SELECT count(*)::int FROM ad_sessions s WHERE s.advertisement_id = a.id) AS session_count
       FROM advertisements a WHERE a.id = $1`,
    [id],
  );
  if (!ad) notFound();

  const [campaigns, bundles, bundleRows, settings] = await Promise.all([
    query<{ id: string; name: string; status: string }>(`SELECT id, name, status FROM campaigns ORDER BY created_at DESC`),
    query<{ id: string; name: string; eligibility: string }>(`SELECT id, name, eligibility FROM bundles ORDER BY display_order ASC`),
    query<{ bundle_id: string }>(`SELECT bundle_id FROM bundle_advertisements WHERE advertisement_id = $1`, [ad.id]),
    getSettings(),
  ]);

  const values: AdFormValues = { ...ad, bundle_ids: bundleRows.map((row) => row.bundle_id) };
  const archived = ad.status === "ARCHIVED";

  return (
    <div className="space-y-6">
      <Link href="/admin/advertisements" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-navy">
        <ArrowLeft className="h-3.5 w-3.5" /> All advertisements
      </Link>

      <PageHeader
        eyebrow={ad.code}
        title={ad.title}
        description={`${ad.advertiser_name} · created ${formatDate(ad.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[ad.status] ?? "neutral"}>{statusLabel(ad.status)}</Badge>
            <LinkButton href={`/dashboard/ads/${ad.id}`} variant="secondary" size="sm" target="_blank">
              <PlayCircle className="h-4 w-4" /> Preview page
            </LinkButton>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Completed sessions</p>
          <p className="mt-1 text-[20px] font-semibold text-navy">{ad.completed}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Flagged sessions</p>
          <p className={`mt-1 text-[20px] font-semibold ${ad.flagged ? "text-danger" : "text-navy"}`}>{ad.flagged}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Demo reward</p>
          <p className="mt-1 text-[20px] font-semibold text-navy">{formatMoney(ad.reward_cents, settings.currency)}</p>
        </Card>
      </div>

      {archived ? (
        <div className="rounded-2xl border border-[#f4e2bd] bg-[#fffaf0] px-4 py-3 text-[12px] text-[#8a6114]">
          This advertisement is archived. Its fields are read-only and it cannot be reactivated.
        </div>
      ) : null}

      <AdvertisementForm mode="edit" ad={values} campaigns={campaigns} bundles={bundles} />

      <Card>
        <CardHeader title="Danger zone" description="Deletion is only permitted when no member has started this advertisement." actions={<Trash2 className="h-4 w-4 text-danger" />} />
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] leading-relaxed text-muted">
            {ad.session_count > 0
              ? `${ad.session_count} session(s) exist. Archive the advertisement instead to preserve the audit trail.`
              : "No sessions exist, so this advertisement can be safely deleted."}
          </p>
          {ad.session_count === 0 && can(admin, "ads.manage") ? (
            <form action={deleteAdvertisementAction}>
              <input type="hidden" name="advertisementId" value={ad.id} />
              <SubmitButton variant="danger" size="sm" confirm="Permanently delete this advertisement? This cannot be undone.">
                Delete advertisement
              </SubmitButton>
            </form>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
