import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, History, PlayCircle, Sparkles } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { adHistory, memberAdStats } from "@/lib/services/ads";
import { getSettings } from "@/lib/settings";
import { Badge, Card, CardHeader, EmptyState, LinkButton, PageHeader, Progress, StatCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/primitives";
import { formatDate, formatDuration, formatMoney } from "@/lib/format";
import { STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Ad history" };
export const dynamic = "force-dynamic";

export default async function AdHistoryPage() {
  const user = await requireMember("/dashboard/ad-history");
  const [rows, stats, settings] = await Promise.all([adHistory(user.id), memberAdStats(user.id), getSettings()]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advertising"
        title="Ad history"
        description="Every advertisement session with its server-verified progress and outcome."
        actions={<LinkButton href="/dashboard/ads" size="sm">Watch more</LinkButton>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Completed" value={stats.completed} icon={<CheckCircle2 className="h-5 w-5" />} tone="success" />
        <StatCard label="Total sessions" value={stats.started} icon={<PlayCircle className="h-5 w-5" />} />
        <StatCard label="Flagged" value={stats.flagged} icon={<AlertTriangle className="h-5 w-5" />} tone="warning" hint="Under moderator review" />
        <StatCard label="Demo rewards earned" value={formatMoney(stats.earned, settings.currency)} icon={<Sparkles className="h-5 w-5" />} tone="brand" />
      </div>

      <Card>
        <CardHeader title="Session history" description="Newest first. Expired and invalidated sessions show no reward." actions={<History className="h-4 w-4 text-muted" />} />
        {rows.length === 0 ? (
          <EmptyState
            icon={<PlayCircle className="h-5 w-5" />}
            title="No sessions yet"
            description="Start your first advertisement to see verified watch time and outcomes here."
            action={<LinkButton href="/dashboard/ads" size="sm">Browse advertisements</LinkButton>}
          />
        ) : (
          <TableWrap>
            <Table>
              <thead>
                <tr>
                  <Th>Advertisement</Th>
                  <Th>Campaign</Th>
                  <Th>Progress</Th>
                  <Th>Status</Th>
                  <Th>Reward</Th>
                  <Th>Started</Th>
                  <Th>Completed</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const progress = Math.min(100, Math.round((row.watched_seconds / Math.max(1, row.required_seconds)) * 100));
                  return (
                    <Tr key={row.id}>
                      <Td>
                        <p className="font-medium text-navy">{row.title}</p>
                        {row.flag_reason ? <p className="mt-0.5 max-w-xs text-[11px] leading-relaxed text-danger">{row.flag_reason}</p> : null}
                      </Td>
                      <Td className="text-muted">{row.campaign_name}</Td>
                      <Td>
                        <div className="w-36">
                          <div className="mb-1 flex justify-between text-[10.5px] text-muted">
                            <span>
                              {formatDuration(row.watched_seconds)}/{formatDuration(row.required_seconds)}
                            </span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-1.5" tone={row.status === "COMPLETED" ? "success" : "brand"} />
                        </div>
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{statusLabel(row.status)}</Badge>
                      </Td>
                      <Td className={row.status === "COMPLETED" ? "font-semibold text-success" : "text-muted"}>
                        {row.status === "COMPLETED" ? formatMoney(row.reward_cents, settings.currency) : "—"}
                      </Td>
                      <Td className="text-muted">{formatDate(row.started_at, true)}</Td>
                      <Td className="text-muted">{formatDate(row.completed_at, true)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <div className="rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
        <span className="font-semibold text-navy">About flagged sessions.</span> Sessions are flagged when server-side
        requirements are not met — for example, completion attempted before the required elapsed time. A moderator reviews
        flagged sessions; no reward is credited and the member is notified if action is needed.
      </div>
    </div>
  );
}
