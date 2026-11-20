import type { Metadata } from "next";
import Link from "next/link";
import { Download, Search, Users } from "lucide-react";
import { can, requireAdminPage } from "@/lib/auth";
import { query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Avatar, Badge, Card, CardHeader, EmptyState, Input, LinkButton, PageHeader, Select, StatCard, Table, TableWrap, Td, Th, Tr } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney, relativeTime } from "@/lib/format";
import { ACCOUNT_STATUS_LABELS, STATUS_TONE, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "User management" };
export const dynamic = "force-dynamic";

type Row = {
  id: string;
  member_id: string;
  full_name: string;
  email: string;
  mobile: string;
  role: string;
  account_status: string;
  membership_status: string;
  available_cents: number;
  completed: number;
  created_at: Date;
  last_login_at: Date | null;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; membership?: string }>;
}) {
  const admin = await requireAdminPage("users.view");
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 80);
  const status = params.status && params.status !== "ALL" ? params.status : null;
  const membership = params.membership && params.membership !== "ALL" ? params.membership : null;

  const [rows, settings, counts] = await Promise.all([
    query<Row>(
      `SELECT u.id, u.member_id, u.full_name, u.email, u.mobile, u.role, u.account_status,
              COALESCE(m.status, 'PENDING') AS membership_status,
              COALESCE(w.available_cents, 0)::int AS available_cents,
              (SELECT count(*)::int FROM ad_sessions s WHERE s.user_id = u.id AND s.status = 'COMPLETED') AS completed,
              u.created_at, u.last_login_at
         FROM users u
         LEFT JOIN memberships m ON m.user_id = u.id
         LEFT JOIN wallets w ON w.user_id = u.id
        WHERE u.role = 'MEMBER'
          AND ($1 = '' OR u.full_name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%' OR u.member_id ILIKE '%' || $1 || '%')
          AND ($2::text IS NULL OR u.account_status = $2)
          AND ($3::text IS NULL OR COALESCE(m.status,'PENDING') = $3)
        ORDER BY u.created_at DESC LIMIT 300`,
      [q, status, membership],
    ),
    getSettings(),
    query<{ members: number; active: number; pending: number; suspended: number; restricted: number }>(
      `SELECT count(*)::int AS members,
              count(*) FILTER (WHERE account_status = 'ACTIVE')::int AS active,
              count(*) FILTER (WHERE account_status = 'PENDING_ACTIVATION')::int AS pending,
              count(*) FILTER (WHERE account_status IN ('SUSPENDED','BLOCKED'))::int AS suspended,
              count(*) FILTER (WHERE account_status = 'DEACTIVATED')::int AS restricted
         FROM users WHERE role = 'MEMBER'`,
    ),
  ]);

  const c = counts[0] ?? { members: 0, active: 0, pending: 0, suspended: 0, restricted: 0 };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Members"
        title="User management"
        description="Search members, review account state and open a member record for sensitive actions."
        actions={
          can(admin, "reports.export") ? (
            <LinkButton href="/api/admin/export?type=users" variant="secondary" size="sm">
              <Download className="h-4 w-4" /> Export CSV
            </LinkButton>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" value={c.members} icon={<Users className="h-5 w-5" />} />
        <StatCard label="Active" value={c.active} icon={<Users className="h-5 w-5" />} tone="success" />
        <StatCard label="Pending activation" value={c.pending} icon={<Users className="h-5 w-5" />} tone="warning" />
        <StatCard label="Suspended / blocked" value={c.suspended} icon={<Users className="h-5 w-5" />} tone="danger" />
      </div>

      <Card>
        <CardHeader title="Search members" description="Name, email or Member ID." />
        <div className="border-b border-line p-4 sm:p-5">
          <form className="grid gap-2.5 sm:grid-cols-[1.6fr_1fr_1fr_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input name="q" defaultValue={q} placeholder="Search name, email or UB-2026-…" className="pl-9" />
            </div>
            <Select name="status" defaultValue={status ?? "ALL"} aria-label="Account status">
              <option value="ALL">All account statuses</option>
              {Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Select name="membership" defaultValue={membership ?? "ALL"} aria-label="Membership status">
              <option value="ALL">All memberships</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <SubmitButton variant="secondary">Apply filters</SubmitButton>
          </form>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={<Users className="h-5 w-5" />} title="No members match" description="Try a different search term or clear the filters." />
        ) : (
          <TableWrap>
            <Table className="min-w-[860px]">
              <thead>
                <tr>
                  <Th>Member</Th>
                  <Th>Member ID</Th>
                  <Th>Account</Th>
                  <Th>Membership</Th>
                  <Th className="text-right">Demo balance</Th>
                  <Th className="text-right">Ads</Th>
                  <Th>Joined</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <Tr key={row.id}>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={row.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-navy">{row.full_name}</p>
                          <p className="truncate text-[11px] text-muted">{row.email}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="font-mono text-[11.5px] text-muted">{row.member_id}</Td>
                    <Td>
                      <Badge tone={STATUS_TONE[row.account_status] ?? "neutral"}>{statusLabel(row.account_status)}</Badge>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[row.membership_status] ?? "neutral"}>{statusLabel(row.membership_status)}</Badge>
                    </Td>
                    <Td className="text-right font-medium">{formatMoney(row.available_cents, settings.currency)}</Td>
                    <Td className="text-right text-muted">{row.completed}</Td>
                    <Td className="whitespace-nowrap text-muted">
                      <p>{formatDate(row.created_at)}</p>
                      <p className="text-[10.5px]">last login {row.last_login_at ? relativeTime(row.last_login_at) : "never"}</p>
                    </Td>
                    <Td>
                      <Link href={`/admin/users/${row.id}`} className="text-[12px] font-semibold text-brand hover:text-brand-dark">
                        Open
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      <p className="text-[11.5px] text-muted">
        Showing up to 300 member records. Sensitive changes require a reason and are written to the audit log.
      </p>
    </div>
  );
}
