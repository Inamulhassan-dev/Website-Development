import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, KeyRound, MailCheck } from "lucide-react";
import { forgotPasswordAction } from "@/lib/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Field, Input } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";

export const metadata: Metadata = { title: "Forgot password" };
export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; devLink?: string; error?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";

  return (
    <AuthShell
      title={sent ? "Check your reset link" : "Reset your password"}
      subtitle={
        sent
          ? "If an account exists for that email address, a password reset link has been created."
          : "Enter the email address on your account and we will create a single-use reset link."
      }
      footer={
        <div className="space-y-2">
          <Link href="/login" className="inline-flex items-center gap-1.5 font-semibold text-brand hover:text-brand-dark">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
          </Link>
          <p className="text-[11px] leading-relaxed text-muted">
            DEMO environment: no email provider is connected. Reset links are printed to the server log, and shown below
            while <span className="font-mono">AUTH_DEBUG_LOG_RESET_LINKS</span> is enabled.
          </p>
        </div>
      }
    >
      {params.error ? (
        <div className="mb-4 rounded-xl border border-[#f6d0d0] bg-[#fdecec] px-3.5 py-3 text-[12px] font-medium text-danger">
          {params.error}
        </div>
      ) : null}

      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-success shadow-sm">
              <MailCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-navy">Request received</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
                For privacy, the response is the same whether or not the address is registered. Reset links expire after
                45 minutes and can only be used once.
              </p>
            </div>
          </div>
          {params.devLink ? (
            <div className="rounded-xl border border-[#cfe2ff] bg-brandsoft p-3.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-brand">Demo reset link</p>
              <Link
                href={params.devLink}
                className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-brand hover:text-brand-dark"
              >
                Open reset form <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : null}
          <Link href="/forgot-password" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:text-brand-dark">
            <KeyRound className="h-3.5 w-3.5" /> Request another link
          </Link>
        </div>
      ) : (
        <form action={forgotPasswordAction} className="space-y-4">
          <Field label="Email address" htmlFor="email" hint="Use the email address you registered with.">
            <Input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" required />
          </Field>
          <SubmitButton className="w-full" pendingLabel="Creating link…">
            Send reset link <ArrowRight className="h-4 w-4" />
          </SubmitButton>
        </form>
      )}
    </AuthShell>
  );
}
