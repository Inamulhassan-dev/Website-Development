import type { Metadata } from "next";
import { Clock3, Mail, MapPin, MessageSquare, ShieldCheck } from "lucide-react";
import { contactAction } from "@/lib/actions/public";
import { getSettings } from "@/lib/settings";
import { Card, CardBody, Field, Input, Textarea } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";

export const metadata: Metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const settings = await getSettings();
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Contact</p>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-navy sm:text-[42px]">Talk to the team</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-[#51617a]">
          Questions about membership, campaigns or the demonstration? Send a message — it is stored in the platform database
          and visible to the support team in the admin portal.
        </p>
      </div>

      <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardBody className="sm:p-8">
            <form action={contactAction} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" htmlFor="name">
                  <Input id="name" name="name" placeholder="Jordan Lee" required maxLength={120} />
                </Field>
                <Field label="Email address" htmlFor="email">
                  <Input id="email" name="email" type="email" placeholder="you@example.com" required maxLength={200} />
                </Field>
              </div>
              <Field label="Subject" htmlFor="subject">
                <Input id="subject" name="subject" placeholder="How can we help?" required maxLength={180} />
              </Field>
              <Field label="Message" htmlFor="message" hint="Please do not include passwords, private keys or real banking details.">
                <Textarea id="message" name="message" placeholder="Write your message…" required maxLength={5000} rows={6} />
              </Field>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <p className="max-w-xs text-[11px] leading-relaxed text-muted">
                  This demo inbox does not send email. Messages appear in the admin support area.
                </p>
                <SubmitButton pendingLabel="Sending…">
                  <MessageSquare className="h-4 w-4" /> Send message
                </SubmitButton>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[14px] font-semibold text-navy">Platform contacts</h2>
            <div className="mt-4 space-y-4 text-[12.5px]">
              <div className="flex gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <p className="font-medium text-ink">General enquiries</p>
                  <p className="text-muted">{settings.contact_email}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <p className="font-medium text-ink">Member support</p>
                  <p className="text-muted">{settings.support_email}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <p className="font-medium text-ink">Typical response</p>
                  <p className="text-muted">1–2 business days (demonstration)</p>
                </div>
              </div>
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div>
                  <p className="font-medium text-ink">Office</p>
                  <p className="text-muted">Private client demonstration · remote</p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-[13px] font-semibold text-navy">Existing member?</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              For account-specific questions, sign in and open Support in your dashboard. That creates a tracked ticket with
              your member details attached.
            </p>
          </div>
          <div className="rounded-2xl border border-[#f4e2bd] bg-[#fffaf0] p-5 text-[12px] leading-relaxed text-[#8a6114]">
            <p className="font-semibold">Demonstration notice</p>
            <p className="mt-1">
              Contact details shown here are fictional. This form stores your message in the demo database but does not send
              an email or SMS.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
