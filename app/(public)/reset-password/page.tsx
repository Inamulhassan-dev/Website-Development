import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { resetPasswordAction } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field } from "@/components/ui/primitives";
import { PasswordInput, SubmitButton } from "@/components/ui/interactive";

export const metadata: Metadata = { title: "Choose a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const token = params.token ?? "";

  return (
    <AuthShell
      title="Choose a new password"
      subtitle="Your new password must be at least 8 characters and include upper case, lower case and a number."
      footer={
        <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
          Return to sign in
        </Link>
      }
    >
      {!token ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#f6d0d0] bg-[#fdecec] px-3.5 py-3 text-[12px] font-medium text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          This reset link is missing its token. Request a new link from the forgot-password page.
        </div>
      ) : (
        <>
          {params.error ? (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-[#f6d0d0] bg-[#fdecec] px-3.5 py-3 text-[12px] font-medium text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {params.error}
            </div>
          ) : null}
          <form action={resetPasswordAction} className="space-y-4">
            <input type="hidden" name="token" value={token} />
            <Field label="New password" htmlFor="password">
              <PasswordInput name="password" id="password" placeholder="New password" autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="Confirm new password" htmlFor="confirmPassword">
              <PasswordInput
                name="confirmPassword"
                id="confirmPassword"
                placeholder="Repeat new password"
                autoComplete="new-password"
                minLength={8}
                required
              />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Updating password…">
              Update password <ArrowRight className="h-4 w-4" />
            </SubmitButton>
          </form>
        </>
      )}
    </AuthShell>
  );
}
