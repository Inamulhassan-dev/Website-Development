import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isStaffRole } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { registerAction } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Checkbox, Field, Input } from "@/components/ui/primitives";
import { PasswordInput, SubmitButton } from "@/components/ui/interactive";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string; error?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(isStaffRole(user.role) ? "/admin/dashboard" : "/dashboard");
  const settings = await getSettings();

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register to activate your membership and explore the platform demonstration."
      footer={
        <p>
          Already registered?{" "}
          <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
            Sign in
          </Link>
        </p>
      }
    >
      {!settings.registration_open ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#f4e2bd] bg-[#fffaf0] px-3.5 py-3 text-[12px] font-medium text-[#8a6114]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Registration is currently closed. Please try again later.
        </div>
      ) : null}

      {params.error ? (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#f6d0d0] bg-[#fdecec] px-3.5 py-3 text-[12px] font-medium text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {params.error}
        </div>
      ) : null}

      <form action={registerAction} className="space-y-4">
        <Field label="Full name" htmlFor="fullName">
          <Input id="fullName" name="fullName" placeholder="Jordan Lee" autoComplete="name" required minLength={3} maxLength={120} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email address" htmlFor="email">
            <Input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required maxLength={200} />
          </Field>
          <Field label="Mobile number" htmlFor="mobile">
            <Input id="mobile" name="mobile" placeholder="+1 555 0100" autoComplete="tel" required maxLength={24} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Password" htmlFor="password" hint="8+ characters, upper and lower case, one number.">
            <PasswordInput name="password" id="password" placeholder="Create a password" autoComplete="new-password" required minLength={8} />
          </Field>
          <Field label="Confirm password" htmlFor="confirmPassword">
            <PasswordInput name="confirmPassword" id="confirmPassword" placeholder="Repeat password" autoComplete="new-password" required minLength={8} />
          </Field>
        </div>
        <Field label="Referral code (optional)" htmlFor="referralCode" hint="Enter the code from the member who invited you.">
          <Input id="referralCode" name="referralCode" placeholder="UBREF000001" defaultValue={params.ref ?? ""} maxLength={40} className="uppercase" />
        </Field>
        <label className="flex items-start gap-2.5 rounded-xl bg-surface px-3.5 py-3 text-[12px] leading-relaxed text-[#51617a]">
          <Checkbox name="terms" required className="mt-0.5" />
          <span>
            I accept the{" "}
            <Link href="/terms" className="font-semibold text-brand underline underline-offset-2">
              terms of use
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-brand underline underline-offset-2">
              privacy notice
            </Link>
            , and I understand this is a demonstration with no real payments or payouts.
          </span>
        </label>
        <SubmitButton className="w-full" pendingLabel="Creating account…" disabled={!settings.registration_open}>
          Create account <ArrowRight className="h-4 w-4" />
        </SubmitButton>
        <p className="text-center text-[10.5px] leading-relaxed text-muted">
          A unique Member ID and referral code are generated automatically.
        </p>
      </form>
    </AuthShell>
  );
}
