import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/auth";
import { AdminShell } from "@/components/layouts/admin-shell";
import type { StaffRole } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminPage();
  if (user.accountStatus !== "ACTIVE") redirect("/admin/login");
  return (
    <AdminShell user={{ fullName: user.fullName, email: user.email, role: user.role as StaffRole }}>
      {children}
    </AdminShell>
  );
}
