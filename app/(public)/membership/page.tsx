import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Info, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getMembership, getPlan } from "@/lib/services/membership";
import { formatMoney } from "@/lib/format";
import { LinkButton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Membership" };
export const dynamic = "force-dynamic";

export default async function MembershipPage() {
  const [plan, user] = await Promise.all([getPlan(), getCurrentUser()]);
  const membership = user && user.role === "MEMBER" ? await getMembership(user.id) : null;

  return (
    <div className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Membership</p>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-navy sm:text-[42px]">One clear activation. Everything unlocked.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#51617a]">
          The membership fee and benefits below are read from the platform database. Administrators can change them at any
          time without touching the website code.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-4xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-2xl border border-brand/25 bg-white p-6 shadow-card sm:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-brand">Private membership</p>
              <h2 className="mt-1.5 text-[22px] font-semibold text-navy">{plan.name}</h2>
            </div>
            <span className="rounded-full bg-[#fffaf0] px-2.5 py-1 text-[10px] font-bold text-[#916412]">DEMO PAYMENT</span>
          </div>
          <div className="mt-5 flex items-baseline gap-2">
            <span className="text-[40px] font-semibold tracking-tight text-navy">{formatMoney(plan.price_cents, plan.currency)}</span>
            <span className="text-[12px] text-muted">one-time</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-[#51617a]">{plan.description}</p>

          <div className="mt-6 border-t border-line pt-5">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">What's included</h3>
            <ul className="mt-3 space-y-2.5">
              {plan.benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-[13px] text-ink">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {benefit}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-6 rounded-xl bg-surface p-4">
            <p className="text-[12px] font-semibold text-navy">Activation requirements</p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">{plan.activation_requirements}</p>
          </div>

          <div className="mt-6">
            {membership?.status === "ACTIVE" ? (
              <LinkButton href="/dashboard" className="w-full">
                Membership active — open dashboard <ArrowRight className="h-4 w-4" />
              </LinkButton>
            ) : user && user.role === "MEMBER" ? (
              <LinkButton href="/dashboard/membership" className="w-full">
                Complete activation
              </LinkButton>
            ) : (
              <LinkButton href="/register" className="w-full">
                Create an account <ArrowRight className="h-4 w-4" />
              </LinkButton>
            )}
            <p className="mt-2.5 text-center text-[10.5px] leading-relaxed text-muted">
              No card details are collected. This demonstration simulates payment outcomes only.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-navy">
              <ShieldCheck className="h-4 w-4 text-brand" /> Membership status
            </h3>
            {membership ? (
              <div className="mt-3 space-y-2 text-[12.5px]">
                <div className="flex justify-between gap-4"><span className="text-muted">Status</span><span className="font-semibold text-success">{membership.status}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted">Activated</span><span className="font-medium text-ink">{membership.activated_at ? new Date(membership.activated_at).toLocaleDateString() : "Not yet"}</span></div>
                <div className="flex justify-between gap-4"><span className="text-muted">Member ID</span><span className="font-medium text-ink">{user?.memberId}</span></div>
              </div>
            ) : (
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                Sign in to see your activation status, or create an account to begin. Membership status is stored against
                your account, not in the browser.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-white p-5">
            <h3 className="text-[14px] font-semibold text-navy">Activation steps</h3>
            <ol className="mt-3 space-y-2.5 text-[12.5px] text-[#51617a]">
              {[
                "Create your member account.",
                "Open My Membership in the dashboard.",
                "Review the amount and choose the DEMO payment method.",
                "Confirm a simulated successful or failed outcome.",
                "Your membership and features update immediately.",
              ].map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brandsoft text-[10px] font-bold text-brand">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-2xl border border-[#f4e2bd] bg-[#fffaf0] p-5">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-[#8a6114]">
              <Info className="h-4 w-4" /> Before you join
            </h3>
            <p className="mt-2 text-[12px] leading-relaxed text-[#8a6114]/90">
              This is a demonstration. No real payment is taken, no cash value is created, and no income is promised. Review
              our <Link href="/terms" className="underline underline-offset-2">terms</Link> and{" "}
              <Link href="/privacy" className="underline underline-offset-2">privacy notice</Link>.
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-12 max-w-4xl rounded-2xl border border-line bg-surface px-6 py-6 text-center">
        <p className="text-[12.5px] leading-relaxed text-muted">
          Membership eligibility, fees and benefits are managed in the administrator portal and recorded in the audit log.
          Referral rewards are subject to programme rules and are never dependent on recruiting additional paying members.
        </p>
      </div>
    </div>
  );
}
