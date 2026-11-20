import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, Clock, Lock, PlayCircle, Sparkles, Timer } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { countAvailableAds, listAvailableAds, memberAdStats } from "@/lib/services/ads";
import { getMembership } from "@/lib/services/membership";
import { getSettings } from "@/lib/settings";
import { Badge, Card, EmptyState, LinkButton, PageHeader, Progress, StatCard } from "@/components/ui/primitives";
import { formatDuration, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Watch advertisements" };
export const dynamic = "force-dynamic";

export default async function AdsPage() {
  const user = await requireMember("/dashboard/ads");
  const [ads, count, stats, membership, settings] = await Promise.all([
    listAvailableAds(user.id),
    countAvailableAds(user.id),
    memberAdStats(user.id),
    getMembership(user.id),
    getSettings(),
  ]);

  const active = membership?.status === "ACTIVE" && user.accountStatus === "ACTIVE";
  const totalPotential = ads.reduce((sum, ad) => sum + ad.reward_cents, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advertising"
        title="Watch advertisements"
        description="Each advertisement has a server-enforced minimum watch time. Complete it honestly to receive a simulated reward."
        actions={<LinkButton href="/dashboard/ad-history" variant="secondary" size="sm">View history</LinkButton>}
      />

      {!active ? (
        <Card className="border-[#f4e2bd] bg-[#fffaf0]">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-warning shadow-sm">
                <Lock className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[14px] font-semibold text-navy">Membership required</p>
                <p className="mt-0.5 text-[12.5px] text-muted">Activate your DEMO membership to unlock the advertisement library.</p>
              </div>
            </div>
            <LinkButton href="/dashboard/membership" size="sm">Activate membership</LinkButton>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Available now" value={count} icon={<PlayCircle className="h-5 w-5" />} />
        <StatCard label="Completed total" value={stats.completed} icon={<BadgeCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Demo rewards earned" value={formatMoney(stats.earned, settings.currency)} icon={<Sparkles className="h-5 w-5" />} tone="brand" />
        <StatCard
          label="Available reward value"
          value={formatMoney(totalPotential, settings.currency)}
          hint="Across all available ads"
          icon={<Clock className="h-5 w-5" />}
          tone="warning"
        />
      </div>

      {!active ? null : ads.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PlayCircle className="h-5 w-5" />}
            title="You have completed everything available"
            description="New campaigns and advertisements will appear here automatically when they are published."
            action={<LinkButton href="/dashboard/campaigns" variant="secondary" size="sm">Browse campaigns</LinkButton>}
          />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {ads.map((ad) => (
            <Card key={ad.id} className="group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-float">
              <Link href={`/dashboard/ads/${ad.id}`} className="relative block aspect-video overflow-hidden bg-navy">
                {ad.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ad.thumbnail_url} alt="" className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03]" />
                ) : (
                  <video
                    src={`${ad.video_url}#t=0.1`}
                    preload="metadata"
                    muted
                    playsInline
                    aria-hidden
                    className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03]"
                  />
                )}
                <div className="absolute inset-0 grid place-items-center bg-navy/20">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-brand shadow-float transition group-hover:scale-105">
                    <PlayCircle className="ml-0.5 h-6 w-6" />
                  </span>
                </div>
                <div className="absolute bottom-2.5 left-2.5 flex gap-1.5">
                  <span className="rounded-full bg-navy/75 px-2 py-0.5 text-[10.5px] font-medium text-white backdrop-blur">
                    {formatDuration(ad.duration_seconds)}
                  </span>
                  <span className="rounded-full bg-white/90 px-2 py-0.5 text-[10.5px] font-semibold text-success">
                    {formatMoney(ad.reward_cents, settings.currency)}
                  </span>
                </div>
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-center gap-2">
                  <Badge tone="brand">{ad.campaign_name}</Badge>
                  {ad.bundle_name ? <span className="text-[10.5px] text-muted">{ad.bundle_name}</span> : null}
                </div>
                <h3 className="mt-1.5 line-clamp-2 text-[14px] font-semibold leading-snug text-navy">{ad.title}</h3>
                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">{ad.description}</p>
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3.5 w-3.5" /> {ad.required_watch_seconds}s required
                  </span>
                  <span>{ad.advertiser_name}</span>
                </div>
                <div className="mt-3">
                  <Progress value={0} className="h-1.5" />
                </div>
                <LinkButton href={`/dashboard/ads/${ad.id}`} size="sm" className="mt-3 w-full">
                  Start watching
                </LinkButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-[#fafcff]">
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:gap-4 sm:p-6">
          <Sparkles className="h-5 w-5 shrink-0 text-brand" />
          <div className="text-[12px] leading-relaxed text-muted">
            <span className="font-semibold text-navy">How verification works.</span> Starting an advertisement creates a
            server-side session. Progress is accepted only for real elapsed time while the tab is visible. Seeking ahead,
            switching tabs or attempting completion early pauses the session or flags it for review. Rewards are demo
            credits with no cash value.
          </div>
        </div>
      </Card>
    </div>
  );
}
