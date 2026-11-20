import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, CalendarDays, CheckCircle2, Clock, Info, ShieldCheck, Sparkles, Timer } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { one } from "@/lib/db";
import { getAdForMember } from "@/lib/services/ads";
import { getSettings } from "@/lib/settings";
import { Badge, Card, CardBody, CardHeader, EmptyState, InfoRow, LinkButton, PageHeader } from "@/components/ui/primitives";
import { AdPlayer } from "@/components/dashboard/ad-player";
import { formatDate, formatDuration, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Advertisement" };
export const dynamic = "force-dynamic";

export default async function AdDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireMember("/dashboard/ads");
  const { id } = await params;
  const [ad, settings, completed] = await Promise.all([
    getAdForMember(user.id, id),
    getSettings(),
    one<{ id: string; completed_at: Date | null; reward_cents: number }>(
      `SELECT id, completed_at, reward_cents FROM ad_sessions
        WHERE user_id = $1 AND advertisement_id = $2 AND status = 'COMPLETED' LIMIT 1`,
      [user.id, id],
    ),
  ]);

  if (!ad) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Advertising" title="Advertisement unavailable" />
        <Card>
          <EmptyState
            icon={<Info className="h-5 w-5" />}
            title="This advertisement is not available for your account"
            description="It may have ended, been paused, or require a different bundle. Browse the current library instead."
            action={<LinkButton href="/dashboard/ads" size="sm">Back to advertisements</LinkButton>}
          />
        </Card>
      </div>
    );
  }

  const campaign = await one<{ terms: string; description: string }>(
    `SELECT terms, description FROM campaigns WHERE id = $1`,
    [ad.campaign_id],
  );

  return (
    <div className="space-y-6">
      <Link href="/dashboard/ads" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-navy">
        <ArrowLeft className="h-3.5 w-3.5" /> All advertisements
      </Link>

      <PageHeader
        eyebrow={ad.campaign_name}
        title={ad.title}
        description={`${ad.advertiser_name} · ${ad.code}`}
        actions={<Badge tone="success">Demo reward {formatMoney(ad.reward_cents, settings.currency)}</Badge>}
      />

      {completed ? (
        <Card>
          <EmptyState
            icon={<CheckCircle2 className="h-5 w-5" />}
            title="You have already completed this advertisement"
            description={`Completed ${formatDate(completed.completed_at, true)}. A demo reward of ${formatMoney(completed.reward_cents, settings.currency)} was credited once.`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/dashboard/ads" size="sm">Find another advertisement</LinkButton>
                <LinkButton href="/dashboard/ad-history" size="sm" variant="secondary">View history</LinkButton>
              </div>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <AdPlayer ad={ad} />

          <div className="space-y-5">
            <Card>
              <CardHeader title="Session details" description="Read before you start." />
              <CardBody className="divide-y divide-line/70 py-1">
                <InfoRow label="Campaign">{ad.campaign_name}</InfoRow>
                <InfoRow label="Advertiser">{ad.advertiser_name}</InfoRow>
                <InfoRow label="Video length">{formatDuration(ad.duration_seconds)}</InfoRow>
                <InfoRow label="Required watch time">{formatDuration(ad.required_watch_seconds)}</InfoRow>
                <InfoRow label="Demo reward">{formatMoney(ad.reward_cents, settings.currency)}</InfoRow>
                <InfoRow label="Available until">{formatDate(ad.end_date)}</InfoRow>
                <InfoRow label="Session window">60 minutes after starting</InfoRow>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Integrity rules" actions={<ShieldCheck className="h-4 w-4 text-brand" />} />
              <CardBody>
                <ul className="space-y-2.5 text-[12px] leading-relaxed text-muted">
                  {[
                    "The session is created by the server, never by the browser.",
                    "Watch time is accepted only when real time has elapsed.",
                    "Switching tab or hiding the page pauses progress and raises risk.",
                    "Seeking ahead or completing early flags the session for review.",
                    "Each advertisement can be rewarded only once per member.",
                  ].map((rule) => (
                    <li key={rule} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {rule}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>

            {campaign?.terms ? (
              <Card>
                <CardHeader title="Campaign terms" />
                <CardBody>
                  <p className="whitespace-pre-line text-[12px] leading-relaxed text-muted">{campaign.terms}</p>
                </CardBody>
              </Card>
            ) : null}

            <div className="rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
              <div className="flex items-center gap-2 font-semibold text-navy">
                <Sparkles className="h-4 w-4 text-brand" /> Demonstration notice
              </div>
              <p className="mt-1.5">
                This advertisement and its reward are part of a demonstration environment. There is no cash value and no
                promise of income. All activity is logged for integrity and support purposes.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: Timer, title: "Minimum watch time", body: `${ad.required_watch_seconds} verified seconds are required before completion unlocks.` },
          { icon: Clock, title: "Pause any time", body: "Leaving the tab pauses the timer. Your verified progress is saved on the server." },
          { icon: BadgeCheck, title: "One reward per ad", body: "Completion is unique per member and enforced by a database index." },
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

      <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
        <CalendarDays className="h-3.5 w-3.5" /> Campaign runs {formatDate(ad.start_date)} – {formatDate(ad.end_date)}
      </div>
    </div>
  );
}
