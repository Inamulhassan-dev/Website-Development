import type { Metadata } from "next";
import { Download, ScrollText, Search, ShieldCheck } from "lucide-react";
import { can, requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Input,
  LinkButton,
  PageHeader,
  Select,
  StatCard,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, relativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Audit logs" };
export const dynamic = "force-dynamic";

const MODULES = [
  "user", "membership", "campaign", "advertisement", "bundle", "wallet", "withdrawal",
  "support", "moderation", "staff", "settings", "referral", "report", "announcement", "notification", "auth",
];

export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; module?: string; actor?: string }>;
}) {
  const admin = await requireAdminPage("audit.view");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 100);
  const module = params.module && params.module !== "ALL" ? params.module : null;
  const actor = params.actor || null;

  const [rows, metrics, actors] = await Promise.all([
    query<{
      id: string; actor_label: string; action: string; target_type: string; target_id: string | null;
      reason: string | null; metadata: unknown; ip: string | null; created_at: Date;
    }>(
      `SELECT id, actor_label, action, target_type, target_id, reason, metadata, ip, created_at
         FROM audit_logs
        WHERE ($1 = '' OR action ILIKE '%' || $1 || '%' OR actor_label ILIKE '%' || $1 || '%'
               OR COALESCE(reason,'') ILIKE '%' || $1 || '%' OR COALESCE(target_id,'') ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR action = $2 OR action LIKE $2 || '.%')
          AND ($3::text IS NULL OR actor_label = $3)
        ORDER BY created_at DESC LIMIT 300`,
      [q, module, actor],
    ),
    one<{ total: number; today: number; week: number; actors: number; sensitive: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE created_at::date = CURRENT_DATE)::int AS today,
              count(*) FILTER (WHERE created_at > now() - interval '7 days')::int AS week,
              count(DISTINCT actor_label)::int AS actors,
              count(*) FILTER (WHERE action LIKE 'withdrawal.%' OR action LIKE 'wallet.adjustment.%'
                OR action LIKE 'staff.%' OR action LIKE 'settings.%' OR action LIKE 'user.status.%')::int AS sensitive
         FROM audit_logs`,
    ),
    query<{ actor_label: string; count: number }>(
      `SELECT actor_label, count(*)::int AS count FROM audit_logs GROUP BY actor_label ORDER BY count DESC LIMIT 40`,
    ),
  ]);

  const m = metrics ?? { total: 0, today: 0, week: 0, actors: 0, sensitive: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Insights"
        title="Audit logs"
        description="An append-only record of sensitive actions. Entries capture the actor, target, reason and structured metadata."
        actions={
          can(admin, "reports.export") ? (
            <LinkButton href="/api/admin/export?type=audit" variant="secondary" size="sm">
              <Download className="h-4 w-4" /> Export CSV
            </LinkButton>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total events" value={m.total} hint={`${m.week} in the last 7 days`} icon={<ScrollText className="h-5 w-5" />} />
        <StatCard label="Today" value={m.today} icon={<ScrollText className="h-5 w-5" />} tone="brand" />
        <StatCard label="Unique actors" value={m.actors} icon={<ShieldCheck className="h-5 w-5" />} tone="success" />
        <StatCard label="Sensitive actions" value={m.sensitive} hint="Status, staff, settings, money" icon={<ShieldCheck className="h-5 w-5" />} tone="warning" />
      </div>

      <Card>
        <CardHeader title="Search the trail" description="Filter by action, actor, target or reason." />
        <div className="border-b border-line p-4 sm:p-5">
          <form className="grid gap-2.5 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input name="q" defaultValue={q} placeholder="Search action, actor, target or reason" className="pl-9" />
            </div>
            <Select name="module" defaultValue={module ?? "ALL"} aria-label="Module">
              <option value="ALL">All modules</option>
              {MODULES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </Select>
            <Select name="actor" defaultValue={actor ?? ""} aria-label="Actor">
              <option value="">All actors</option>
              {actors.map((row) => (
                <option key={row.actor_label} value={row.actor_label}>{row.actor_label} ({row.count})</option>
              ))}
            </Select>
            <SubmitButton variant="secondary">Apply</SubmitButton>
          </form>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<ScrollText className="h-5 w-5" />} title="No audit events match" description="Try a broader search or clear the module filter." />
        ) : (
          <TableWrap>
            <Table className="min-w-[1060px]">
              <thead>
                <tr><Th>When</Th><Th>Actor</Th><Th>Action</Th><Th>Target</Th><Th>Reason</Th><Th>Details</Th><Th>IP</Th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td className="whitespace-nowrap text-muted">
                      <p>{formatDate(row.created_at, true)}</p>
                      <p className="text-[10px]">{relativeTime(row.created_at)}</p>
                    </Td>
                    <Td className="font-medium text-navy">{row.actor_label}</Td>
                    <Td><Badge tone="brand" className="font-mono text-[10px]">{row.action}</Badge></Td>
                    <Td>
                      <p className="text-[11.5px] text-ink">{row.target_type}</p>
                      <p className="font-mono text-[10px] text-muted">{row.target_id ?? "—"}</p>
                    </Td>
                    <Td className="max-w-[220px] text-[11.5px] text-muted">{row.reason ?? "—"}</Td>
                    <Td>
                      {row.metadata && typeof row.metadata === "object" && Object.keys(row.metadata as object).length ? (
                        <details className="group">
                          <summary className="cursor-pointer text-[11px] font-semibold text-brand">View</summary>
                          <pre className="mt-1 max-w-[280px] overflow-x-auto rounded-lg bg-surface p-2 font-mono text-[9.5px] leading-relaxed text-muted scrollbar-thin">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        <span className="text-[11px] text-muted">—</span>
                      )}
                    </Td>
                    <Td className="font-mono text-[10px] text-muted">{row.ip ?? "—"}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11.5px] leading-relaxed text-muted">
        Audit entries cannot be edited or deleted from the application. Showing up to 300 newest events. Retention is configured
        in platform settings; CSV export includes the latest 5,000 events.
      </p>
    </div>
  );
}
