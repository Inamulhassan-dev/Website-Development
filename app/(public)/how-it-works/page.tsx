import type { Metadata } from "next";
import { ArrowRight, Bell, CheckCircle2, Landmark, PlayCircle, ShieldCheck, UserPlus, Wallet } from "lucide-react";
import { LinkButton } from "@/components/ui/primitives";
import { getPlan } from "@/lib/services/membership";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "How it works" };
export const dynamic = "force-dynamic";

const steps = [
  {
    icon: UserPlus,
    number: "01",
    title: "Register an account",
    body: "Provide your full name, email, mobile number and a secure password. Add a referral code if someone invited you. Your unique Member ID and referral code are generated automatically.",
    detail: "Member IDs follow the format UB-2026-000001 and are allocated by a database sequence, so duplicates are impossible.",
  },
  {
    icon: Landmark,
    number: "02",
    title: "Complete membership activation",
    body: "Review the membership summary and complete the one-time DEMO payment. The server verifies the amount against the current plan price.",
    detail: "A successful simulated payment activates your membership, records a payment reference and writes an audit event.",
  },
  {
    icon: PlayCircle,
    number: "03",
    title: "Watch eligible advertisements",
    body: "Browse campaigns and bundles available to your account. Start an advertisement session and watch to the required point.",
    detail: "Progress is reported to the server. Switching tabs pauses the session, and rewards cannot be claimed before the minimum time has elapsed.",
  },
  {
    icon: Wallet,
    number: "04",
    title: "Track demo rewards and withdraw",
    body: "Completed sessions credit your demo wallet once. Review every transaction, then submit a simulated withdrawal request for finance review.",
    detail: "Approvals and rejections are recorded with an administrator, a reason and a ledger entry. No real payout occurs.",
  },
];

export default async function HowItWorksPage() {
  const plan = await getPlan();
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">How it works</p>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-navy sm:text-[42px]">A simple path from registration to your demo wallet.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#51617a]">
          Four connected steps, each backed by server-side checks. This walkthrough reflects exactly what happens in the
          demonstration environment.
        </p>
      </div>

      <div className="mt-12 space-y-4">
        {steps.map((step) => (
          <div key={step.number} className="grid gap-5 rounded-2xl border border-line bg-white p-5 shadow-card sm:grid-cols-[56px_1fr] sm:p-7">
            <div>
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brandsoft text-brand">
                <step.icon className="h-5 w-5" />
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10.5px] font-bold tracking-[0.12em] text-brand">{step.number}</span>
                <h2 className="text-[17px] font-semibold text-navy">{step.title}</h2>
              </div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[#51617a]">{step.body}</p>
              <div className="mt-3 rounded-xl bg-surface px-4 py-3 text-[12px] leading-relaxed text-muted">
                <span className="font-semibold text-ink">Behind the scenes: </span>
                {step.detail}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-[16px] font-semibold text-navy">Membership at a glance</h2>
          <div className="mt-4 flex items-end justify-between gap-3 border-b border-line pb-4">
            <div>
              <p className="text-[12px] text-muted">One-time activation</p>
              <p className="text-[26px] font-semibold text-navy">{formatMoney(plan.price_cents, plan.currency)}</p>
            </div>
            <span className="rounded-full bg-[#fffaf0] px-2.5 py-1 text-[10px] font-bold text-[#916412]">DEMO</span>
          </div>
          <ul className="mt-4 space-y-2">
            {plan.benefits.slice(0, 4).map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-[12.5px] text-ink">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {benefit}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <LinkButton href="/membership" variant="secondary" size="sm">
              Membership details <ArrowRight className="h-3.5 w-3.5" />
            </LinkButton>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-6">
          <h2 className="flex items-center gap-2 text-[16px] font-semibold text-navy">
            <ShieldCheck className="h-4 w-4 text-brand" /> Fair-use controls
          </h2>
          <ul className="mt-4 space-y-2.5 text-[12.5px] text-[#51617a]">
            <li className="flex gap-2"><span className="text-brand">•</span> Server-created sessions with expiry and single completion per advertisement.</li>
            <li className="flex gap-2"><span className="text-brand">•</span> Playback progress cannot exceed real elapsed time.</li>
            <li className="flex gap-2"><span className="text-brand">•</span> Duplicate reward credits are blocked by unique ledger keys.</li>
            <li className="flex gap-2"><span className="text-brand">•</span> Suspicious completion attempts are flagged for moderator review.</li>
            <li className="flex gap-2"><span className="text-brand">•</span> Rate limiting on sign-in, sessions and withdrawal requests.</li>
          </ul>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-navy px-6 py-6 sm:px-8">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-white/70" />
          <p className="text-[13px] text-white/80">Ready to try it? The full demo takes about five minutes.</p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/register" className="!bg-white !text-navy hover:!bg-white/90">
            Create account
          </LinkButton>
          <LinkButton href="/login" className="!border !border-white/20 !bg-white/5 !text-white hover:!bg-white/10">
            Sign in
          </LinkButton>
        </div>
      </div>
    </div>
  );
}
