import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Clapperboard,
  Fingerprint,
  Gauge,
  Layers,
  LockKeyhole,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users2,
  Wallet,
} from "lucide-react";
import { getPlan } from "@/lib/services/membership";
import { query } from "@/lib/db";
import { formatMoney } from "@/lib/format";
import { LinkButton } from "@/components/ui/primitives";
import { DashboardPreview } from "@/components/site/dashboard-preview";

export const dynamic = "force-dynamic";

const features = [
  { icon: BadgeCheck, title: "Configurable membership", body: "One-time activation with an administrator-managed fee, benefits and eligibility rules." },
  { icon: Clapperboard, title: "Campaign control", body: "Draft, schedule, pause and archive campaigns. Assign ads to flexible bundles without code changes." },
  { icon: PlayCircle, title: "Server-validated sessions", body: "Rewards are decided by stored playback progress and server timestamps — never a frontend click." },
  { icon: Wallet, title: "Ledger-based demo wallet", body: "Every credit and debit is an immutable transaction. Balances are always derived from the ledger." },
  { icon: Users2, title: "Referral attribution", body: "Unique codes, duplicate prevention and controlled reward eligibility with full history." },
  { icon: ShieldCheck, title: "Four admin roles", body: "Super Admin, Finance, Support and Moderator each receive only the permissions they need." },
];

const faqs = [
  {
    q: "Is this a live money-making platform?",
    a: "No. This is a demonstration environment. Membership payments, rewards, referrals and withdrawals are clearly labelled DEMO and move no real money. A production launch requires legal review and approved payment partners.",
  },
  {
    q: "How do demo rewards work?",
    a: "Eligible members start an advertisement session. The server records playback progress and only credits a demo reward when the configured watch requirement is met. Switching away pauses the session.",
  },
  {
    q: "Can I withdraw demo earnings?",
    a: "You can submit a simulated withdrawal request. A Finance Admin reviews it and records an approval or rejection. No bank transfer or crypto payout is ever made.",
  },
  {
    q: "How are member accounts protected?",
    a: "Passwords are hashed with bcrypt, sessions are stored server-side and revocable, and every protected route checks role permissions on the server. Repeated failed logins trigger a temporary lock.",
  },
  {
    q: "What happens when an advertisement is archived?",
    a: "Archived campaigns and advertisements are removed from member eligibility immediately. Historical sessions and wallet records remain intact for audit purposes.",
  },
  {
    q: "Is this ready for production?",
    a: "It is a complete functional prototype with a production-oriented architecture. Live payments, email/SMS delivery and real advertising verification need separate integrations and approvals before launch.",
  },
];

export default async function HomePage() {
  const [plan, bundles] = await Promise.all([
    getPlan(),
    query<{ id: string; name: string; description: string; ad_count: number; eligibility: string }>(
      `SELECT id, name, description, ad_count, eligibility FROM bundles WHERE status = 'ACTIVE' ORDER BY display_order LIMIT 6`,
    ),
  ]);

  return (
    <>
      <section className="hero-grid relative overflow-hidden">
        <div className="container-page grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-white/80 px-3 py-1.5 text-[11.5px] font-medium text-[#51617a] shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Private membership platform · DEMO environment
            </div>
            <h1 className="mt-5 max-w-2xl text-[34px] font-semibold leading-[1.08] tracking-[-0.03em] text-navy sm:text-[46px] lg:text-[52px]">
              A private platform for advertising, membership and member rewards.
            </h1>
            <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-[#51617a] sm:text-base">
              Umar Baig brings membership activation, curated advertising campaigns, transparent demo rewards and a complete
              administrator control centre into one calm, secure product experience.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <LinkButton href="/register" size="lg">
                Create your account <ArrowRight className="h-4 w-4" />
              </LinkButton>
              <LinkButton href="/how-it-works" size="lg" variant="secondary">
                See how it works
              </LinkButton>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-[12px] text-[#5d6d85]">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> One-time membership activation
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Ledger-backed demo wallet
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> No income guarantees
              </span>
            </div>
          </div>
          <div className="animate-in lg:pl-4">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="container-page grid grid-cols-2 gap-4 py-7 sm:grid-cols-4">
          {[
            { icon: LockKeyhole, label: "Server-side permissions" },
            { icon: Fingerprint, label: "Hashed passwords" },
            { icon: BarChart3, label: "Database-backed analytics" },
            { icon: Layers, label: "Immutable ledger history" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2.5 text-[12px] font-medium text-[#51617a]">
              <item.icon className="h-4 w-4 text-brand" />
              {item.label}
            </div>
          ))}
        </div>
      </section>

      <section className="container-page py-16 sm:py-20" id="how-it-works">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">A clear member journey</p>
          <h2 className="mt-3 text-[27px] font-semibold tracking-tight text-navy sm:text-[34px]">From registration to your first reward</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Every step is connected to the same secure backend, with status changes you can see in your dashboard.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "01", title: "Register", body: "Create an account with your details and an optional referral code. A unique Member ID is generated automatically." },
            { n: "02", title: "Activate membership", body: "Complete the one-time DEMO membership payment. Your member features unlock immediately." },
            { n: "03", title: "Choose a campaign", body: "Browse eligible demonstration campaigns and bundles, then start an advertisement." },
            { n: "04", title: "Earn demo rewards", body: "Complete the watch requirement. The server verifies progress and credits your demo wallet once." },
          ].map((step) => (
            <div key={step.n} className="relative rounded-2xl border border-line bg-white p-5 shadow-card">
              <span className="text-[11px] font-bold tracking-[0.12em] text-brand">{step.n}</span>
              <h3 className="mt-2 text-[15px] font-semibold text-navy">{step.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/how-it-works" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-brand-dark">
            Read the full walkthrough <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      <section className="border-y border-line bg-surface/60">
        <div className="container-page grid items-center gap-10 py-16 lg:grid-cols-2 sm:py-20">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Membership</p>
            <h2 className="mt-3 text-[27px] font-semibold tracking-tight text-navy sm:text-[34px]">One clear membership. Fully configurable.</h2>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
              The membership fee, benefits and activation requirements are managed by administrators — never hardcoded into
              the website. This demonstration uses a one-time activation to keep the member experience simple.
            </p>
            <ul className="mt-6 space-y-3">
              {plan.benefits.slice(0, 5).map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5 text-[13px] text-ink">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {benefit}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <LinkButton href="/membership" variant="secondary">
                View membership details <ArrowRight className="h-4 w-4" />
              </LinkButton>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-6 shadow-card sm:p-8">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">Founding member</p>
                <h3 className="mt-1.5 text-xl font-semibold text-navy">{plan.name}</h3>
              </div>
              <Sparkles className="h-5 w-5 text-brand" />
            </div>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="text-[38px] font-semibold tracking-tight text-navy">{formatMoney(plan.price_cents, plan.currency)}</span>
              <span className="text-[12px] text-muted">one-time (DEMO)</span>
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">{plan.description}</p>
            <div className="mt-5 rounded-xl bg-surface p-4 text-[12px] leading-relaxed text-[#51617a]">
              <p className="font-semibold text-navy">Activation requirement</p>
              <p className="mt-1">{plan.activation_requirements}</p>
            </div>
            <div className="mt-5">
              <LinkButton href="/register" className="w-full">
                Start registration
              </LinkButton>
              <p className="mt-2.5 text-center text-[10.5px] text-muted">No real payment is processed in this demonstration.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Advertising bundles</p>
            <h2 className="mt-3 text-[27px] font-semibold tracking-tight text-navy sm:text-[34px]">Structured, flexible campaign access</h2>
          </div>
          <p className="max-w-md text-[12.5px] leading-relaxed text-muted">
            Administrators can add, rename, pause or resize any bundle. Members only see the bundles their account is eligible for.
          </p>
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bundles.map((bundle, index) => (
            <div key={bundle.id} className={`rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-float ${index === 2 ? "border-brand/30 bg-brandsoft/40" : "border-line bg-white"}`}>
              <div className="flex items-center justify-between">
                <h3 className="text-[14px] font-semibold text-navy">{bundle.name}</h3>
                {bundle.eligibility === "RESTRICTED" ? (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[9.5px] font-semibold text-brand ring-1 ring-[#cfe2ff]">Invite only</span>
                ) : null}
              </div>
              <p className="mt-1 text-[11.5px] text-muted">{bundle.ad_count} advertisement allocation</p>
              <p className="mt-3 text-[12px] leading-relaxed text-[#5b6b82]">{bundle.description}</p>
            </div>
          ))}
          {bundles.length === 0 ? (
            <p className="text-[13px] text-muted">No active bundles yet. An administrator can create bundles from the admin portal.</p>
          ) : null}
        </div>
      </section>

      <section className="border-y border-line bg-surface/60">
        <div className="container-page py-16 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Platform capabilities</p>
            <h2 className="mt-3 text-[27px] font-semibold tracking-tight text-navy sm:text-[34px]">Built like a real product, not a template</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              A connected member portal, four administrator roles, financial controls and an auditable backend.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-line bg-white p-5 shadow-card">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brandsoft text-brand">
                  <feature.icon className="h-[18px] w-[18px]" />
                </span>
                <h3 className="mt-3.5 text-[14px] font-semibold text-navy">{feature.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{feature.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <LinkButton href="/register">Create an account</LinkButton>
            <LinkButton href="/login" variant="secondary">
              Sign in to the demo
            </LinkButton>
          </div>
        </div>
      </section>

      <section className="container-page py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Questions</p>
            <h2 className="mt-3 text-[27px] font-semibold tracking-tight text-navy sm:text-[32px]">Clarity before commitment</h2>
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted">
              This demonstration uses simulated rewards and payments. If something is unclear, ask before registering.
            </p>
            <Link href="/contact" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:text-brand-dark">
              Contact the team <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-line rounded-2xl border border-line bg-white">
            {faqs.map((faq) => (
              <details key={faq.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[13.5px] font-medium text-navy">
                  {faq.q}
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-line text-muted transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2.5 pr-8 text-[12.5px] leading-relaxed text-muted">{faq.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page pb-20">
        <div className="relative overflow-hidden rounded-[24px] bg-navy px-6 py-12 text-center sm:px-12 sm:py-16">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
          <div className="absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-brand/15 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-white/70">
              <Gauge className="h-3 w-3" /> Demonstration environment
            </span>
            <h2 className="mx-auto mt-4 max-w-xl text-[26px] font-semibold tracking-tight text-white sm:text-[32px]">
              Explore the complete member and administrator experience
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[13px] leading-relaxed text-white/65">
              Register a member account, activate the demo membership and watch a sample campaign. Administrator demo
              credentials are listed on the sign-in screen.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <LinkButton href="/register" size="lg" className="!bg-white !text-navy hover:!bg-white/90">
                Join the demonstration
              </LinkButton>
              <LinkButton href="/login" size="lg" className="!border !border-white/20 !bg-white/5 !text-white hover:!bg-white/10">
                Sign in
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
