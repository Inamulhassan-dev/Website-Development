import type { Metadata } from "next";
import { CheckCircle2, ShieldCheck, Users2, Target } from "lucide-react";
import { LinkButton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">About the platform</p>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-navy sm:text-[42px]">
          A private membership and advertising platform, built with clarity.
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#51617a]">
          Umar Baig is a private platform concept that brings together membership activation, curated advertising campaigns,
          member rewards and a complete administrative control centre. This website is a functional demonstration of the
          proposed product — every screen is connected to a real database and a real backend.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          { icon: Target, title: "Purpose", body: "Give members a simple, transparent place to view campaigns, complete eligible demo sessions and track their activity." },
          { icon: Users2, title: "Membership", body: "A single one-time membership activation unlocks the member portal. Administrators control the fee and benefits." },
          { icon: ShieldCheck, title: "Accountability", body: "Role-based administration, immutable ledger entries and an audit trail for sensitive actions." },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-line bg-white p-5 shadow-card">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-brandsoft text-brand">
              <item.icon className="h-[18px] w-[18px]" />
            </span>
            <h2 className="mt-3.5 text-[14px] font-semibold text-navy">{item.title}</h2>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-14 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-8">
          <div>
            <h2 className="text-[20px] font-semibold text-navy">How the system works</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              The public website, member portal and administrator portal share one backend and one relational database.
              Member IDs, referral codes, campaign eligibility and wallet balances are calculated on the server. The browser
              never decides a reward amount, a balance or a permission.
            </p>
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-navy">Platform responsibilities</h2>
            <ul className="mt-3 space-y-2.5">
              {[
                "Provide accurate, clearly labelled demonstration content.",
                "Protect member data with hashed passwords, secure sessions and server-side authorization.",
                "Record every financial movement as an immutable ledger transaction.",
                "Give administrators the tools to review accounts, campaigns, activity and support requests.",
                "Keep all payments, rewards and withdrawals simulated until approved integrations exist.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-ink">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[20px] font-semibold text-navy">User responsibilities</h2>
            <ul className="mt-3 space-y-2.5">
              {[
                "Provide accurate registration details and keep your password private.",
                "Use one account per person. Duplicate or automated activity may be reviewed.",
                "Do not attempt to manipulate viewing sessions or reward eligibility.",
                "Never enter real banking credentials, private keys or seed phrases anywhere in this demo.",
                "Understand that demonstration rewards have no cash value.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-ink">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-line bg-surface p-6">
          <div className="rounded-xl bg-white p-4 ring-1 ring-line">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-warning">Important</p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#51617a]">
              This is a demonstration product. No real money is collected, held or paid out. Simulated ad engagement does not
              constitute verified advertising traffic, and no income is guaranteed.
            </p>
          </div>
          <h3 className="mt-5 text-[14px] font-semibold text-navy">What you can explore</h3>
          <ul className="mt-3 space-y-2 text-[12.5px] text-[#51617a]">
            <li>• Registration, membership activation and a Member ID</li>
            <li>• Campaign browsing and server-validated ad sessions</li>
            <li>• Demo wallet, transactions and withdrawal review</li>
            <li>• Referral tracking with eligibility rules</li>
            <li>• Support tickets and notifications</li>
            <li>• Four administrator roles with a permission matrix</li>
          </ul>
          <div className="mt-6">
            <LinkButton href="/register" className="w-full">
              Create a demo account
            </LinkButton>
          </div>
        </aside>
      </div>
    </div>
  );
}
