import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/constants";
import { loginAction } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/primitives";
import { PasswordInput, SubmitButton } from "@/components/ui/interactive";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(isStaffRole(user.role) ? "/admin/dashboard" : "/dashboard");

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your member portal to view campaigns, rewards and account activity."
      footer={
        <div className="space-y-3">
          <p>
            New here?{" "}
            <Link href="/register" className="font-semibold text-brand hover:text-brand-dark">
              Create an account
            </Link>
          </p>
          <div className="rounded-xl bg-surface p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">Demo member</p>
            <p className="mt-1 font-mono text-[11.5px] text-ink">ayesha.khan@umarbaig.demo</p>
            <p className="font-mono text-[11.5px] text-ink">Demo#2026</p>
          </div>
          <p className="text-[11px] text-muted">
            Administrator?{" "}
            <Link href="/admin/login" className="font-semibold text-brand hover:text-brand-dark">
              Use the admin portal
            </Link>
          </p>
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
          <Input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput name="password" id="password" placeholder="Your password" autoComplete="current-password" required />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input type="checkbox" name="remember" value="on" className="h-4 w-4 rounded border-line accent-[#1769e0]" />
            Keep me signed in
          </label>
          <Link href="/forgot-password" className="text-[12px] font-medium text-brand hover:text-brand-dark">
            Forgot password?
          </Link>
        </div>
        <SubmitButton className="w-full" pendingLabel="Signing in…">
          Sign in <ArrowRight className="h-4 w-4" />
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
