import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/constants";
import { adminLoginAction } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { DemoRibbon, Field, Input } from "@/components/ui/primitives";
import { PasswordInput, SubmitButton } from "@/components/ui/interactive";

export const metadata: Metadata = { title: "Administrator sign in" };
export const dynamic = "force-dynamic";

const STAFF_CREDENTIALS = [
  { role: "Super Admin", email: "superadmin@umarbaig.demo", scope: "Full access" },
  { role: "Finance Admin", email: "finance@umarbaig.demo", scope: "Ledger & withdrawals" },
  { role: "Support Admin", email: "support@umarbaig.demo", scope: "Members & tickets" },
  { role: "Moderator", email: "moderator@umarbaig.demo", scope: "Ads & moderation" },
];

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; toast?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user && isStaffRole(user.role)) redirect("/admin/dashboard");

  return (
    <div className="min-h-screen bg-white">
      <DemoRibbon />
      <AuthShell
        side="admin"
        title="Administrator sign in"
        subtitle="This portal is restricted to authorised staff. Every administrative action is written to the audit log."
        footer={
          <div className="space-y-3">
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted">
                <ShieldCheck className="h-3.5 w-3.5" /> Demo administrator accounts
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
              <p className="mt-2 border-t border-line pt-2 text-[11px] text-muted">
                Password for every demo staff account: <span className="font-mono text-ink">Admin#2026</span>
              </p>
            </div>
            <p className="text-[11px] text-muted">
              Member?{" "}
              <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
                Use the member sign-in
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
        <form action={adminLoginAction} className="space-y-4">
          <Field label="Work email address" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="name@umarbaig.demo" autoComplete="username" required />
          </Field>
          <Field label="Password" htmlFor="password">
            <PasswordInput name="password" id="password" placeholder="Administrator password" autoComplete="current-password" required />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Verifying…">
            Sign in securely <ArrowRight className="h-4 w-4" />
          </SubmitButton>
        </form>
        <p className="mt-4 text-[11px] leading-relaxed text-muted">
          Access is logged with IP address and user agent. Repeated failed attempts trigger a temporary lockout.
        </p>
      </AuthShell>
    </div>
  );
}
