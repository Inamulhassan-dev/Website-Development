import Link from "next/link";
import { Logo } from "@/components/brand";

const columns = [
  {
    title: "Platform",
    links: [
      { href: "/about", label: "About" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/membership", label: "Membership" },
    ],
  },
  {
    title: "Members",
    links: [
      { href: "/register", label: "Create account" },
      { href: "/login", label: "Sign in" },
      { href: "/dashboard", label: "Member dashboard" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of use" },
      { href: "/privacy", label: "Privacy notice" },
      { href: "/contact", label: "Contact" },
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="border-t border-line bg-surface/60">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_2fr]">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted">
              A private advertising, membership and rewards platform demonstration. Built to show the complete member and
              administrator experience.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#f4e2bd] bg-[#fffaf0] px-3 py-1.5 text-[11px] font-semibold text-[#916412]">
              <span className="h-1.5 w-1.5 rounded-full bg-warning" />
              DEMO — no real payments or payouts
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{column.title}</p>
                <ul className="mt-3 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="text-[13px] text-ink/80 transition hover:text-brand">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-[11.5px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Umar Baig. Demonstration platform. All rights reserved.</p>
          <p>Advertising engagement shown here is simulated and not verified traffic.</p>
        </div>
      </div>
    </footer>
  );
}
