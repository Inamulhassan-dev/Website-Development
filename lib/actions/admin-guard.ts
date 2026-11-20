import { redirect } from "next/navigation";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { isStaffRole, roleHasPermission, type Permission } from "@/lib/constants";
import { fail } from "./helpers";

export async function requireAdminAction(permission: Permission): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || !isStaffRole(user.role)) redirect("/admin/login");
  if (!roleHasPermission(user.role, permission)) {
    fail("/admin/dashboard", "Your role does not have permission to perform that action.");
  }
  return user;
}
