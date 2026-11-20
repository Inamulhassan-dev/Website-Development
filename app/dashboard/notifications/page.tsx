import type { Metadata } from "next";
import Link from "next/link";
import { Bell, BellRing, BadgeCheck, CheckCheck, Inbox, Megaphone, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { query } from "@/lib/db";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/actions/member";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const ICONS: Record<string, typeof Bell> = {
  REWARD: Sparkles,
  WALLET: Wallet,
  REFERRAL: BellRing,
  SECURITY: ShieldCheck,
  ANNOUNCEMENT: Megaphone,
  SUPPORT: Inbox,
  MEMBERSHIP: BadgeCheck,
};

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requireMember("/dashboard/notifications");
  const params = await searchParams;
  const unreadOnly = params.filter === "unread";
  const rows = await query<{ id: string; type: string; title: string; body: string; link: string | null; read_at: Date | null; created_at: Date }>(
    `SELECT id, type, title, body, link, read_at, created_at FROM notifications
      WHERE user_id = $1 ${unreadOnly ? "AND read_at IS NULL" : ""}
      ORDER BY created_at DESC LIMIT 100`,
    [user.id],
  );
  const unread = rows.filter((row) => !row.read_at).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Rewards, wallet updates, referrals, security alerts and platform announcements."
        actions={
          unread > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <SubmitButton variant="secondary" size="sm" pendingLabel="Marking…">
                <CheckCheck className="h-4 w-4" /> Mark all read
              </SubmitButton>
            </form>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Unread" value={unread} icon={<BellRing className="h-5 w-5" />} tone={unread > 0 ? "brand" : "neutral"} />
        <StatCard label="In this view" value={rows.length} icon={<Bell className="h-5 w-5" />} />
        <StatCard label="Total loaded" value={rows.length} hint="Most recent 100" icon={<Inbox className="h-5 w-5" />} tone="success" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/dashboard/notifications"
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[11.5px] font-medium transition",
            !unreadOnly ? "bg-brand text-white" : "bg-surface text-muted hover:text-navy",
          )}
        >
          All notifications
        </Link>
        <Link
          href="/dashboard/notifications?filter=unread"
          className={cn(
            "rounded-full px-3.5 py-1.5 text-[11.5px] font-medium transition",
            unreadOnly ? "bg-brand text-white" : "bg-surface text-muted hover:text-navy",
          )}
        >
          Unread only
        </Link>
      </div>

      <Card>
        <CardHeader title={unreadOnly ? "Unread notifications" : "All notifications"} description="Newest first." />
        {rows.length === 0 ? (
          <EmptyState
            icon={<Bell className="h-5 w-5" />}
            title={unreadOnly ? "No unread notifications" : "You are all caught up"}
            description={unreadOnly ? "Everything has been read. Switch back to all notifications to review history." : "Platform updates and account alerts will appear here."}
          />
        ) : (
          <div className="divide-y divide-line/70">
            {rows.map((row) => {
              const Icon = ICONS[row.type] ?? Bell;
              return (
                <div key={row.id} className={cn("flex items-start gap-3 px-5 py-4 sm:px-6", !row.read_at && "bg-[#fafcff]")}>
                  <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl", row.read_at ? "bg-surface text-muted" : "bg-brandsoft text-brand")}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-navy">{row.title}</p>
                      {!row.read_at ? <Badge tone="brand">New</Badge> : null}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted">{row.body}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-3">
                      <span className="text-[10.5px] text-muted">{relativeTime(row.created_at)}</span>
                      {row.link ? (
                        <Link href={row.link} className="text-[11.5px] font-semibold text-brand hover:text-brand-dark">
                          Open
                        </Link>
                      ) : null}
                    </div>
                  </div>
                  {!row.read_at ? (
                    <form action={markNotificationReadAction} className="shrink-0">
                      <input type="hidden" name="notificationId" value={row.id} />
                      <SubmitButton variant="ghost" size="sm" pendingLabel="…">
                        Mark read
                      </SubmitButton>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
