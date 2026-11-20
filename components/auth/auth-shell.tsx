import type { ReactNode } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Logo, DemoBadge } from "@/components/brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  side = "member",
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  side?: "member" | "admin";
}) {
  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[24px] border border-line bg-white shadow-card lg:grid-cols-[0.92fr_1.08fr]">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-navy p-8 lg:flex">
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-brand/15 blur-3xl" />
          <div className="relative">
            <Logo light />
            <div className="mt-10">
              <DemoBadge />
              <h2 className="mt-4 text-[26px] font-semibold leading-tight tracking-tight text-white">
                {side === "admin" ? "Administration with clear boundaries." : "Membership, campaigns and rewards in one calm place."}
              </h2>
              <p className="mt-3 text-[13px] leading-relaxed text-white/65">
                {side === "admin"
                  ? "Four roles, a visible permission matrix and an append-only audit trail for sensitive actions."
                  : "Everything you need to understand your membership, activity and demo wallet — with no noise."}
              </p>
            </div>
          </div>
          <ul className="relative mt-10 space-y-3 text-[12px] text-white/70">
            {(side === "admin"
              ? ["Server-enforced permissions", "Every decision recorded", "Finance, support and moderation separated"]
              : ["Server-validated sessions", "Ledger-based demo wallet", "Transparent, auditable history"]
            ).map((item) => (
              <li key={item} className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-[#7fb3ff]" /> {item}
              </li>
            ))}
          </ul>
          <div className="relative mt-10 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[10.5px] leading-relaxed text-white/60">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#7fb3ff]" />
            Demonstration environment. No real payments, rewards or withdrawals.
          </div>
        </div>

        <div className="p-6 sm:p-9">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="mt-6 lg:mt-0">
            <h1 className="text-[24px] font-semibold tracking-tight text-navy">{title}</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{subtitle}</p>
          </div>
          <div className="mt-6">{children}</div>
          {footer ? <div className="mt-6 border-t border-line pt-5 text-[12.5px] text-muted">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
