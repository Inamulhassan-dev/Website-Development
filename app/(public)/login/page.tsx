import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight, ShieldCheck, UserCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/constants";
import { loginAction } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/primitives";
import { PasswordInput, SubmitButton } from "@/components/ui/interactive";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const STAFF_CREDENTIALS = [
  { role: "Super Admin", email: "superadmin@umarbaig.demo", scope: "Full access" },
  { role: "Finance Admin", email: "finance@umarbaig.demo", scope: "Ledger & withdrawals" },
  { role: "Support Admin", email: "support@umarbaig.demo", scope: "Members & tickets" },
  { role: "Moderator", email: "moderator@umarbaig.demo", scope: "Ads & moderation" },
];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(isStaffRole(user.role) ? "/admin/dashboard" : "/dashboard");

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to access your portal. Members see campaigns, rewards and wallet. Staff access the admin console."
      footer={
        <div className="space-y-3">
          <p>
            New here?{" "}
            <Link href="/register" className="font-semibold text-brand hover:text-brand-dark">
              Create an account
            </Link>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-surface p-3">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                <UserCircle className="h-3.5 w-3.5" /> Demo member
              </div>
              <ul className="mt-2 space-y-1.5 font-mono text-[11px] text-ink">
                <li>ayesha.khan@umarbaig.demo</li>
                <li>Demo#2026</li>
              </ul>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                <ShieldCheck className="h-3.5 w-3.5" /> Demo staff (all use Admin#2026)
              </div>
              <ul className="mt-2 space-y-1.5">
                {STAFF_CREDENTIALS.map((account) => (
                  <li key={account.email} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <span className="text-[11.5px] font-medium text-ink">{account.role}</span>
                    <span className="font-mono text-[11px] text-muted">{account.email}</span>
                    <span className="w-full text-[10.5px] text-muted sm:w-auto">{account.scope}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      }
    >
      {params.error ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#f6d0d0] bg-[#fdecec] px-3.5 py-3 text-[12px] font-medium text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {params.error}
        </div>
      ) : null}
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={params.next ?? ""} />
        <Field label="Email address" htmlFor="email">
          <Input id="email" name="email" type="email" placeholder="you@umarbaig.demo" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput name="password" id="password" placeholder="Your password" autoComplete="current-password" required />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input type="checkbox" name="remember" value="on" className="h-4 w-4 rounded border-line accent-[#1769e0]" />
            Keep me signed in (14 days)
          </label>
          <Link href="/forgot-password" className="text-[12px] font-medium text-brand hover:text-brand-dark">
            Forgot password?
          </Link>
        </div>
        <SubmitButton className="w-full" pendingLabel="Signing in…">
          Sign in <ArrowRight className="h-4 w-4" />
        </SubmitButton>
      </form>
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Access is logged with IP address and user agent. Repeated failed attempts trigger a temporary lockout.
      </p>
    </AuthShell>
  );
}
