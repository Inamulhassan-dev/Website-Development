import { requireMember } from "@/lib/auth";
import { unreadNotificationCount } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { MemberShell } from "@/components/layouts/member-shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await requireMember();
  const [unread, settings] = await Promise.all([unreadNotificationCount(user.id), getSettings()]);

  if (settings.maintenance_mode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface p-6">
        <div className="max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-[#fdf5e7] text-warning">!</div>
          <h1 className="text-lg font-semibold text-navy">Scheduled maintenance</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            The member portal is temporarily unavailable while the platform is updated. Please check back shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MemberShell
      user={{
        fullName: user.fullName,
        memberId: user.memberId,
        email: user.email,
        accountStatus: user.accountStatus,
        membershipStatus: user.membershipStatus,
      }}
      unread={unread}
    >
      {children}
    </MemberShell>
  );
}
