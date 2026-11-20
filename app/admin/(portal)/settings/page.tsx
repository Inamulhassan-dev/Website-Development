import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, BellRing, Globe2, Save, Settings2, ShieldCheck, Wallet } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { one } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { updateSettingsAction } from "@/lib/actions/admin";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  InfoRow,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui/primitives";
import { SubmitButton, Toggle } from "@/components/ui/interactive";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Platform settings" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  await requireAdminPage("settings.manage");
  const [settings, system] = await Promise.all([
    getSettings(true),
    one<{ members: number; staff: number; campaigns: number; advertisements: number; tickets: number; version: string }>(
      `SELECT (SELECT count(*)::int FROM users WHERE role = 'MEMBER') AS members,
              (SELECT count(*)::int FROM users WHERE role <> 'MEMBER') AS staff,
              (SELECT count(*)::int FROM campaigns) AS campaigns,
              (SELECT count(*)::int FROM advertisements) AS advertisements,
              (SELECT count(*)::int FROM support_tickets) AS tickets,
              current_setting('server_version') AS version`,
    ),
  ]);
  const s = system ?? { members: 0, staff: 0, campaigns: 0, advertisements: 0, tickets: 0, version: "unknown" };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Platform settings"
        description="Control identity, contact details, financial limits, programme defaults and platform availability."
        actions={<Badge tone="brand"><Settings2 className="h-3.5 w-3.5" /> Super Admin</Badge>}
      />

      <form action={updateSettingsAction} className="space-y-5">
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Brand & contact" description="Shown across the public site and member portal." actions={<Globe2 className="h-4 w-4 text-muted" />} />
            <CardBody className="space-y-4">
              <Field label="Platform name" htmlFor="platform_name">
                <Input id="platform_name" name="platform_name" defaultValue={settings.platform_name} required minLength={2} maxLength={80} />
              </Field>
              <Field label="Tagline" htmlFor="platform_tagline">
                <Input id="platform_tagline" name="platform_tagline" defaultValue={settings.platform_tagline} maxLength={160} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Contact email" htmlFor="contact_email">
                  <Input id="contact_email" name="contact_email" type="email" defaultValue={settings.contact_email} required maxLength={200} />
                </Field>
                <Field label="Support email" htmlFor="support_email">
                  <Input id="support_email" name="support_email" type="email" defaultValue={settings.support_email} required maxLength={200} />
                </Field>
              </div>
              <Field label="Support phone" htmlFor="support_phone" hint="Display only. Use a fictional number for the demo.">
                <Input id="support_phone" name="support_phone" defaultValue={settings.support_phone} maxLength={40} />
              </Field>
              <Field label="Currency" htmlFor="currency" hint="3-letter ISO code. Amounts remain stored in minor units.">
                <Input id="currency" name="currency" defaultValue={settings.currency} required maxLength={3} minLength={3} className="uppercase" />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Finance limits" description="Applied to member withdrawal requests and demo adjustments." actions={<Wallet className="h-4 w-4 text-muted" />} />
            <CardBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Minimum withdrawal (USD)" htmlFor="min_withdrawal" hint="Minimum 0.01.">
                  <Input id="min_withdrawal" name="min_withdrawal" type="number" min="0.01" step="0.01" defaultValue={(settings.min_withdrawal_cents / 100).toFixed(2)} required />
                </Field>
                <Field label="Maximum withdrawal (USD)" htmlFor="max_withdrawal" hint="Must exceed the minimum.">
                  <Input id="max_withdrawal" name="max_withdrawal" type="number" min="0.01" step="0.01" defaultValue={(settings.max_withdrawal_cents / 100).toFixed(2)} required />
                </Field>
              </div>
              <div className="rounded-xl border border-[#f4e2bd] bg-[#fffaf0] px-3.5 py-3 text-[11.5px] leading-relaxed text-[#8a6114]">
                <span className="font-semibold">No real payouts.</span> Limits govern simulated withdrawal requests only. Approving
                a request never moves real funds. Current range:{" "}
                {formatMoney(settings.min_withdrawal_cents, settings.currency)} – {formatMoney(settings.max_withdrawal_cents, settings.currency)}.
              </div>
              <div className="rounded-xl border border-line bg-surface px-3.5 py-3 text-[11.5px] leading-relaxed text-muted">
                The membership price and benefits are managed on the{" "}
                <Link href="/admin/memberships" className="font-semibold text-brand hover:text-brand-dark">Memberships</Link> page.
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader title="Rewards & referrals" description="Defaults for new advertisements and the referral programme." actions={<BadgeCheck className="h-4 w-4 text-muted" />} />
            <CardBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Default ad reward (USD)" htmlFor="default_reward" hint="Pre-fills new advertisement forms.">
                  <Input id="default_reward" name="default_reward" type="number" min="0" step="0.01" defaultValue={(settings.default_reward_cents / 100).toFixed(2)} required />
                </Field>
                <Field label="Referral reward (USD)" htmlFor="referral_reward" hint="Credited once per qualified referral.">
                  <Input id="referral_reward" name="referral_reward" type="number" min="0" step="0.01" defaultValue={(settings.referral_reward_cents / 100).toFixed(2)} required />
                </Field>
              </div>
              <Field label="Default required watch time (seconds)" htmlFor="default_required_watch_seconds" hint="Between 3 and 600 seconds.">
                <Input id="default_required_watch_seconds" name="default_required_watch_seconds" type="number" min={3} max={600} defaultValue={settings.default_required_watch_seconds} required />
              </Field>
              <div className="flex items-center justify-between rounded-xl border border-line px-3.5 py-3">
                <div>
                  <p className="text-[12.5px] font-medium text-ink">Referral programme</p>
                  <p className="text-[11px] text-muted">When paused, referrals still qualify but no reward is credited.</p>
                </div>
                <Toggle name="referral_enabled" defaultChecked={settings.referral_enabled} label="Enabled" />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Platform availability" description="Use with care — these controls affect every visitor." actions={<ShieldCheck className="h-4 w-4 text-muted" />} />
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-line px-3.5 py-3">
                <div>
                  <p className="text-[12.5px] font-medium text-ink">Registration open</p>
                  <p className="text-[11px] text-muted">Allow new member registrations from the public site.</p>
                </div>
                <Toggle name="registration_open" defaultChecked={settings.registration_open} label="Open" />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line px-3.5 py-3">
                <div>
                  <p className="text-[12.5px] font-medium text-ink">Maintenance mode</p>
                  <p className="text-[11px] text-muted">Displays a maintenance notice to members. Staff access remains available.</p>
                </div>
                <Toggle name="maintenance_mode" defaultChecked={settings.maintenance_mode} label="On" />
              </div>
              <Field label="Audit retention (days)" htmlFor="audit_retention_days" hint="Minimum 90 days. Shown for policy transparency.">
                <Input id="audit_retention_days" name="audit_retention_days" type="number" min={90} max={3650} defaultValue={settings.audit_retention_days} />
              </Field>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader title="Announcement banner" description="Optional single-line message shown above the platform." actions={<BellRing className="h-4 w-4 text-muted" />} />
          <CardBody>
            <Field label="Banner text" htmlFor="announcement_banner" hint="Leave blank to hide the banner. Maximum 300 characters.">
              <Textarea id="announcement_banner" name="announcement_banner" defaultValue={settings.announcement_banner} maxLength={300} className="min-h-[70px]" placeholder="Example: Demo maintenance scheduled for Friday at 18:00 UTC." />
            </Field>
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white p-4 shadow-card">
          <p className="text-[11.5px] leading-relaxed text-muted">
            Saving applies immediately and writes a <span className="font-mono">settings.updated</span> audit entry listing the changed keys.
          </p>
          <SubmitButton pendingLabel="Saving settings…"><Save className="h-4 w-4" /> Save all settings</SubmitButton>
        </div>
      </form>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Environment" description="Current demonstration system information." />
          <CardBody className="py-1">
            <InfoRow label="Database">PostgreSQL {s.version}</InfoRow>
            <InfoRow label="Members"><span className="font-mono">{s.members}</span></InfoRow>
            <InfoRow label="Staff accounts"><span className="font-mono">{s.staff}</span></InfoRow>
            <InfoRow label="Campaigns"><span className="font-mono">{s.campaigns}</span></InfoRow>
            <InfoRow label="Advertisements"><span className="font-mono">{s.advertisements}</span></InfoRow>
            <InfoRow label="Support tickets"><span className="font-mono">{s.tickets}</span></InfoRow>
            <InfoRow label="Mode"><Badge tone="warning">Demonstration</Badge></InfoRow>
            <InfoRow label="Rendered">{formatDate(new Date(), true)}</InfoRow>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Operational notes" description="Things to know before changing live settings." />
          <CardBody className="space-y-3 text-[11.5px] leading-relaxed text-muted">
            {[
              { title: "Currency changes", body: "Changing the currency updates display only; existing ledger amounts are not converted." },
              { title: "Maintenance mode", body: "Use it for demo walkthroughs, not as a security control. Authentication remains enforced." },
              { title: "Audit retention", body: "Retention is documented here. Automated deletion is intentionally not exposed in the UI." },
              { title: "Reset the demo", body: "Resetting demo data is a command-line operation (npm run db:reset && npm run db:seed), never a web button." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl border border-line px-3 py-2.5">
                <p className="font-semibold text-navy">{item.title}</p>
                <p className="mt-0.5">{item.body}</p>
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5">
              <ShieldCheck className="h-4 w-4 text-brand" />
              <span>Only the Super Admin role can access this page.</span>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
