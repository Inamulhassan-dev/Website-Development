import type { Metadata } from "next";
import Link from "next/link";
import { Fragment } from "react";
import { Check, KeyRound, Minus, ShieldCheck, UserCog } from "lucide-react";
import { requireAdminPage } from "@/lib/auth";
import { query } from "@/lib/db";
import { Badge, Card, CardBody, CardHeader, PageHeader, Table, TableWrap, Td, Th, Tr } from "@/components/ui/primitives";
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES, permissionsForRole } from "@/lib/constants";

export const metadata: Metadata = { title: "Roles & permissions" };
export const dynamic = "force-dynamic";

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  users: "Members",
  memberships: "Memberships",
  campaigns: "Campaigns",
  ads: "Advertisements",
  bundles: "Bundles",
  sessions: "Ad sessions",
  moderation: "Moderation",
  wallet: "Wallet",
  transactions: "Transactions",
  withdrawals: "Withdrawals",
  referrals: "Referrals",
  support: "Support",
  staff: "Staff",
  roles: "Roles",
  audit: "Audit",
  reports: "Reports",
  settings: "Settings",
};

export default async function AdminRolesPage() {
  await requireAdminPage("roles.view");
  const counts = await query<{ role: string; count: number }>(
    `SELECT role, count(*)::int AS count FROM users WHERE role <> 'MEMBER' GROUP BY role`,
  );
  const countMap = new Map(counts.map((row) => [row.role, Number(row.count)]));

  const entries = Object.entries(PERMISSIONS) as Array<[keyof typeof PERMISSIONS, string]>;
  const grouped = entries.reduce<Record<string, Array<{ key: keyof typeof PERMISSIONS; label: string }>>>((acc, [key, label]) => {
    const module = key.split(".")[0];
    acc[module] = acc[module] ?? [];
    acc[module].push({ key, label });
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Administration"
        title="Roles & permissions"
        description="The permission matrix enforced by every admin page, server action and API route."
        actions={<Badge tone="brand"><ShieldCheck className="h-3.5 w-3.5" /> Server-enforced</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((role) => (
          <Card key={role} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-navy">{ROLE_LABELS[role]}</p>
                <p className="mt-0.5 text-[11px] text-muted">{countMap.get(role) ?? 0} active account{(countMap.get(role) ?? 0) === 1 ? "" : "s"}</p>
              </div>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-brandsoft text-brand"><UserCog className="h-4 w-4" /></span>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
              {role === "SUPER_ADMIN"
                ? "Every module, including staff, roles and platform settings."
                : role === "FINANCE_ADMIN"
                  ? "Financial operations, withdrawal decisions, wallet adjustments and exports."
                  : role === "SUPPORT_ADMIN"
                    ? "Member records, support conversations and member notifications."
                    : "Advertising catalogue, viewing sessions and moderation decisions."}
            </p>
            <p className="mt-2 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-brand">{permissionsForRole(role).length} permissions</p>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader title="Permission matrix" description="A check means the role can access the capability. Denied routes redirect; denied actions fail closed." actions={<KeyRound className="h-4 w-4 text-muted" />} />
        <TableWrap>
          <Table className="min-w-[900px]">
            <thead>
              <tr>
                <Th className="sticky left-0 z-10 bg-[#fafcff]">Capability</Th>
                {ROLES.map((role) => (
                  <Th key={role} className="text-center">{ROLE_LABELS[role]}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([module, permissions]) => (
                <Fragment key={module}>
                  <tr>
                    <Td className="sticky left-0 z-10 bg-surface/80 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                      {MODULE_LABELS[module] ?? module}
                    </Td>
                    {ROLES.map((role) => (
                      <Td key={`${module}-${role}`} className="bg-surface/40" />
                    ))}
                  </tr>
                  {permissions.map((permission) => (
                    <Tr key={permission.key}>
                      <Td className="sticky left-0 z-10 bg-white">
                        <p className="text-[12.5px] font-medium text-ink">{permission.label}</p>
                        <p className="font-mono text-[10px] text-muted">{permission.key}</p>
                      </Td>
                      {ROLES.map((role) => {
                        const allowed = ROLE_PERMISSIONS[role].includes(permission.key);
                        return (
                          <Td key={`${permission.key}-${role}`} className="text-center">
                            {allowed ? (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#e9f8f1] text-success">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface text-[#c0cad8]">
                                <Minus className="h-3 w-3" />
                              </span>
                            )}
                          </Td>
                        );
                      })}
                    </Tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "Least privilege", body: "Each role receives only the capabilities required for its function. Sensitive actions are limited to Super Admin and Finance Admin." },
          { title: "Defence in depth", body: "Permissions are checked in the page guard, the server action and the API handler — never only in the interface." },
          { title: "Auditability", body: "Every sensitive mutation writes an audit entry with the acting staff identity, target and optional reason." },
        ].map((item) => (
          <Card key={item.title} className="p-4">
            <p className="text-[13px] font-semibold text-navy">{item.title}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
          </Card>
        ))}
      </div>

      <Card className="bg-[#fafcff]">
        <CardBody className="flex flex-wrap items-center justify-between gap-3 text-[11.5px] text-muted">
          <p>Need to change someone's role? Staff accounts are managed by a Super Admin.</p>
          <Link href="/admin/staff" className="font-semibold text-brand hover:text-brand-dark">Open staff accounts</Link>
        </CardBody>
      </Card>
    </div>
  );
}
