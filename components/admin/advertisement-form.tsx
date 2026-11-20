import Link from "next/link";
import { Save } from "lucide-react";
import { createAdvertisementAction, updateAdvertisementAction } from "@/lib/actions/admin";
import { Badge, Card, CardBody, CardHeader, Checkbox, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { MediaUploadField } from "@/components/admin/media-upload-field";
import { formatMoney } from "@/lib/format";

export type AdFormValues = {
  id?: string;
  title: string;
  advertiser_name: string;
  description: string;
  campaign_id: string;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  reward_cents: number;
  required_watch_seconds: number;
  start_date: string;
  end_date: string;
  display_order: number;
  status: string;
  bundle_ids: string[];
};

export function AdvertisementForm({
  mode,
  ad,
  campaigns,
  bundles,
  defaultCampaignId,
}: {
  mode: "create" | "edit";
  ad: AdFormValues;
  campaigns: Array<{ id: string; name: string; status: string }>;
  bundles: Array<{ id: string; name: string; eligibility: string }>;
  defaultCampaignId?: string;
}) {
  const action = mode === "create" ? createAdvertisementAction : updateAdvertisementAction;

  return (
    <form action={action} className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
      {ad.id ? <input type="hidden" name="advertisementId" value={ad.id} /> : null}
      <div className="space-y-5">
        <Card>
          <CardHeader title="Creative" description="Title, copy and the video members will watch." />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Title" htmlFor="title">
                <Input id="title" name="title" defaultValue={ad.title} required minLength={3} maxLength={160} placeholder="A short creative title" />
              </Field>
              <Field label="Advertiser" htmlFor="advertiser">
                <Input id="advertiser" name="advertiser" defaultValue={ad.advertiser_name} required minLength={2} maxLength={140} />
              </Field>
            </div>
            <Field label="Description" htmlFor="description">
              <Textarea id="description" name="description" defaultValue={ad.description} maxLength={3000} className="min-h-[90px]" placeholder="What members will see before playing." />
            </Field>
            <Field label="Video source" htmlFor="videoUrl" hint="MP4 or WebM, up to 60 MB. Google sample videos are already used by the seed data.">
              <MediaUploadField name="videoUrl" kind="VIDEO" defaultValue={ad.video_url} />
            </Field>
            <Field label="Thumbnail (optional)" htmlFor="thumbnailUrl" hint="JPEG, PNG or WebP up to 5 MB. Used as the video poster.">
              <MediaUploadField name="thumbnailUrl" kind="IMAGE" defaultValue={ad.thumbnail_url ?? ""} />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Schedule and placement" description="Only active advertisements inside an active campaign are shown." />
          <CardBody className="space-y-4">
            <Field label="Campaign" htmlFor="campaignId">
              <Select id="campaignId" name="campaignId" defaultValue={ad.campaign_id || defaultCampaignId || ""} required>
                <option value="">Select a campaign</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id} disabled={campaign.status === "ARCHIVED"}>
                    {campaign.name} ({campaign.status.toLowerCase()})
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Start date" htmlFor="startDate">
                <Input id="startDate" name="startDate" type="date" defaultValue={ad.start_date} required />
              </Field>
              <Field label="End date" htmlFor="endDate">
                <Input id="endDate" name="endDate" type="date" defaultValue={ad.end_date} required />
              </Field>
              <Field label="Display order" htmlFor="displayOrder">
                <Input id="displayOrder" name="displayOrder" type="number" min="0" max="1000" defaultValue={ad.display_order} required />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Bundle access" description="Leave all unchecked to make the advertisement available to every active member." />
          <CardBody>
            {bundles.length === 0 ? (
              <p className="text-[12px] text-muted">No bundles configured yet.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {bundles.map((bundle) => (
                  <label key={bundle.id} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-line px-3 py-2.5 transition hover:bg-surface">
                    <Checkbox name="bundleIds" value={bundle.id} defaultChecked={ad.bundle_ids.includes(bundle.id)} className="mt-0.5" />
                    <span>
                      <span className="block text-[12.5px] font-medium text-ink">{bundle.name}</span>
                      <span className="block text-[10.5px] text-muted">{bundle.eligibility === "RESTRICTED" ? "Restricted — grant required" : "All members"}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              Adding an advertisement to any bundle restricts it to bundle-eligible members. If no bundle is linked, the
              advertisement is available to all active members.
            </p>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Reward and verification" description="Amounts are stored as integer cents." />
          <CardBody className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Video duration (seconds)" htmlFor="durationSeconds">
                <Input id="durationSeconds" name="durationSeconds" type="number" min="3" max="3600" defaultValue={ad.duration_seconds} required />
              </Field>
              <Field label="Required watch (seconds)" htmlFor="requiredWatchSeconds">
                <Input id="requiredWatchSeconds" name="requiredWatchSeconds" type="number" min="3" max="3600" defaultValue={ad.required_watch_seconds} required />
              </Field>
            </div>
            <Field label="Demo reward (USD)" htmlFor="reward" hint={`Stored as ${formatMoney(ad.reward_cents)} by default. Members see this as a demo credit.`}>
              <Input id="reward" name="reward" type="number" min="0" step="0.01" defaultValue={(Number(ad.reward_cents) / 100).toFixed(2)} required />
            </Field>
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={ad.status}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
              </Select>
            </Field>
            <div className="rounded-xl bg-surface px-3 py-2.5 text-[11px] leading-relaxed text-muted">
              Required watch time cannot exceed the video duration. Completion is verified server-side using elapsed
              database time and stored progress, never client input.
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Summary" actions={<Badge tone="brand">{mode === "create" ? "New" : "Editing"}</Badge>} />
          <CardBody className="space-y-2 text-[12px]">
            <div className="flex justify-between border-b border-line/60 py-1.5">
              <span className="text-muted">Reward</span>
              <span className="font-medium text-ink">{formatMoney(ad.reward_cents)}</span>
            </div>
            <div className="flex justify-between border-b border-line/60 py-1.5">
              <span className="text-muted">Watch requirement</span>
              <span className="font-medium text-ink">{ad.required_watch_seconds}s</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted">Bundles</span>
              <span className="font-medium text-ink">{ad.bundle_ids.length || "All members"}</span>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-2">
          <SubmitButton className="w-full" size="lg" pendingLabel="Saving advertisement…">
            <Save className="h-4 w-4" /> {mode === "create" ? "Create advertisement" : "Save changes"}
          </SubmitButton>
          <Link
            href="/admin/advertisements"
            className="inline-flex h-11 items-center justify-center rounded-full border border-line bg-white text-[13px] font-semibold text-ink transition hover:bg-surface"
          >
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
