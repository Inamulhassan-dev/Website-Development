import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/primitives";
import { AdvertisementForm, type AdFormValues } from "@/components/admin/advertisement-form";

export const metadata: Metadata = { title: "New advertisement" };
export const dynamic = "force-dynamic";

function isoDate(offsetDays: number) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default async function NewAdvertisementPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  await requireAdminPage("ads.manage");
  const params = await searchParams;
  const [campaigns, bundles, settings] = await Promise.all([
    query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM campaigns WHERE status <> 'ARCHIVED' ORDER BY created_at DESC`,
    ),
    query<{ id: string; name: string; eligibility: string }>(
      `SELECT id, name, eligibility FROM bundles WHERE status = 'ACTIVE' ORDER BY display_order ASC`,
    ),
    getSettings(),
  ]);

  const initial: AdFormValues = {
    title: "",
    advertiser_name: "",
    description: "",
    campaign_id: params.campaign && campaigns.some((campaign) => campaign.id === params.campaign) ? params.campaign : campaigns[0]?.id ?? "",
    video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    thumbnail_url: null,
    duration_seconds: 15,
    reward_cents: settings.default_reward_cents,
    required_watch_seconds: Math.min(15, Math.max(3, settings.default_required_watch_seconds)),
    start_date: isoDate(0),
    end_date: isoDate(30),
    display_order: 0,
    status: "DRAFT",
    bundle_ids: [],
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/advertisements" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-navy">
        <ArrowLeft className="h-3.5 w-3.5" /> All advertisements
      </Link>
      <PageHeader
        eyebrow="Advertising"
        title="New advertisement"
        description="Create the creative, set the required watch time and choose which bundles can access it."
      />
      <AdvertisementForm mode="create" ad={initial} campaigns={campaigns} bundles={bundles} defaultCampaignId={params.campaign} />
    </div>
  );
}
