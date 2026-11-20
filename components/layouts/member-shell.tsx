"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  BadgeCheck,
  Megaphone,
  PlayCircle,
  History,
  Wallet,
  ArrowLeftRight,
  Banknote,
  Users2,
  Bell,
  LifeBuoy,
  UserCircle,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/brand";
import { Avatar, Badge } from "@/components/ui/primitives";
import { logoutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/format";

const groups = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
      { href: "/dashboard/membership", label: "My membership", icon: BadgeCheck },
    ],
  },
  {
    label: "Advertising",
    items: [
      { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
      { href: "/dashboard/ads", label: "Watch advertisements", icon: PlayCircle },
      { href: "/dashboard/ad-history", label: "Ad history", icon: History },
    ],
  },
  {
    label: "Wallet",
    items: [
      { href: "/dashboard/wallet", label: "My wallet", icon: Wallet },
      { href: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
      { href: "/dashboard/withdrawals", label: "Withdrawals", icon: Banknote },
    ],
  },
  {
    label: "Growth",
    items: [{ href: "/dashboard/referrals", label: "Referrals", icon: Users2 }],
  },
  {
    label: "Inbox",
    items: [
      { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/dashboard/support", label: "Support", icon: LifeBuoy },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/profile", label: "My profile", icon: UserCircle },
      { href: "/dashboard/security", label: "Security", icon: ShieldCheck },
    ],
  },
];

export function MemberShell({
  children,
  user,
  unread,
}: {
  children: React.ReactNode;
  user: { fullName: string; memberId: string; email: string; accountStatus: string; membershipStatus: string };
  unread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#93a1b5]">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition",
                    active ? "bg-brandsoft text-brand" : "text-[#45566f] hover:bg-surface hover:text-navy",
                  )}
                >
                  <Icon className={cn("h-[17px] w-[17px]", active ? "text-brand" : "text-[#8695ab] group-hover:text-navy")} />
                  <span className="flex-1">{item.label}</span>
                  {item.href === "/dashboard/notifications" && unread > 0 ? (
                    <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">{unread}</span>
                  ) : null}
                  {active ? <ChevronRight className="h-3.5 w-3.5 text-brand/60" /> : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-line bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <Logo href="/dashboard" />
        </div>
        {nav}
        <div className="border-t border-line p-3">
          <div className="rounded-xl bg-surface p-3">
            <p className="text-[11px] font-semibold text-navy">DEMO environment</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">Rewards and withdrawals are simulated. No real funds are held.</p>
          </div>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button className="absolute inset-0 bg-navy/40 backdrop-blur-[2px]" aria-label="Close menu" onClick={() => setOpen(false)} />
          <aside className="animate-in absolute inset-y-0 left-0 flex w-[280px] flex-col bg-white shadow-float">
            <div className="flex h-16 items-center justify-between border-b border-line px-4">
              <Logo href="/dashboard" />
              <button onClick={() => setOpen(false)} className="rounded-full p-2 text-muted hover:bg-surface" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        <header className="sticky top-0 z-20 border-b border-line bg-white/85 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setOpen(true)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-line text-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-navy">Welcome back, {user.fullName.split(" ")[0]}</p>
              <p className="truncate text-[11px] text-muted">
                {user.memberId} · {user.membershipStatus === "ACTIVE" ? "Active membership" : "Membership pending"}
              </p>
            </div>
            <Badge tone={user.accountStatus === "ACTIVE" ? "success" : user.accountStatus === "SUSPENDED" ? "danger" : "warning"}>
              {user.accountStatus === "ACTIVE" ? "Active" : user.accountStatus.replaceAll("_", " ").toLowerCase()}
            </Badge>
            <Link
              href="/dashboard/notifications"
              className="relative grid h-10 w-10 place-items-center rounded-full text-[#5b6b82] transition hover:bg-surface"
              aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-white" /> : null}
            </Link>
            <details className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full p-1 pr-2 transition hover:bg-surface [&::-webkit-details-marker]:hidden">
                <Avatar name={user.fullName} size="sm" />
                <span className="hidden text-left sm:block">
                  <span className="block text-[12px] font-semibold leading-tight text-navy">{user.fullName.split(" ")[0]}</span>
                  <span className="block text-[10px] text-muted">Member</span>
                </span>
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-white p-1.5 shadow-float">
                <div className="px-3 py-2">
                  <p className="truncate text-[12.5px] font-semibold text-navy">{user.fullName}</p>
                  <p className="truncate text-[11px] text-muted">{user.email}</p>
                </div>
                <div className="my-1 h-px bg-line" />
                <Link href="/dashboard/profile" className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-ink hover:bg-surface">
                  <UserCircle className="h-4 w-4 text-muted" /> Profile
                </Link>
                <Link href="/dashboard/security" className="flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] text-ink hover:bg-surface">
                  <ShieldCheck className="h-4 w-4 text-muted" /> Security
                </Link>
                <form action={logoutAction}>
                  <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-medium text-danger hover:bg-[#fdecec]">
                    <LogOut className="h-4 w-4" /> Sign out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>
        <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
