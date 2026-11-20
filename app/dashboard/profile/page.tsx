import type { Metadata } from "next";
import { BadgeCheck, CalendarDays, Mail, Phone, ShieldCheck, UserCircle } from "lucide-react";
import { requireMember } from "@/lib/auth";
import { one } from "@/lib/db";
import { updateProfileAction } from "@/lib/actions/member";
import { getMembership } from "@/lib/services/membership";
import { getReferrer } from "@/lib/services/referrals";
import { getSettings } from "@/lib/settings";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Field,
  InfoRow,
  Input,
  PageHeader,
} from "@/components/ui/primitives";
import { CopyButton, SubmitButton } from "@/components/ui/interactive";
import { formatDate } from "@/lib/format";
import { statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "My profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireMember("/dashboard/profile");
  const [row, membership, referrer, settings] = await Promise.all([
    one<{ full_name: string; email: string; mobile: string; member_id: string; created_at: Date; activated_at: Date | null }>(
      `SELECT full_name, email, mobile, member_id, created_at, activated_at FROM users WHERE id = $1`,
      [user.id],
    ),
    getMembership(user.id),
    getReferrer(user.id),
    getSettings(),
  ]);

  const referralLink = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/register?ref=${user.referralCode}`;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Keep your contact details accurate. Your Member ID and referral code are permanent and cannot be changed."
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.4fr]">
        <Card className="h-fit">
          <CardBody className="text-center">
            <div className="mx-auto w-fit">
              <Avatar name={row?.full_name ?? user.fullName} size="lg" />
            </div>
            <h2 className="mt-3 text-[16px] font-semibold text-navy">{row?.full_name ?? user.fullName}</h2>
            <p className="text-[12px] text-muted">{row?.email ?? user.email}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              <Badge tone={membership?.status === "ACTIVE" ? "success" : "warning"}>{statusLabel(membership?.status ?? "PENDING")}</Badge>
              <Badge tone={user.accountStatus === "ACTIVE" ? "brand" : "warning"}>{statusLabel(user.accountStatus)}</Badge>
            </div>
            <div className="mt-4 divide-y divide-line/70 text-left">
              <InfoRow label="Member ID">
                <span className="font-mono text-[12px]">{row?.member_id ?? user.memberId}</span>
              </InfoRow>
              <InfoRow label="Referral code">
                <span className="font-mono text-[12px]">{user.referralCode}</span>
              </InfoRow>
              <InfoRow label="Member since">{formatDate(row?.created_at)}</InfoRow>
              <InfoRow label="Activated">{row?.activated_at ? formatDate(row.activated_at) : "Not yet"}</InfoRow>
              <InfoRow label="Currency">{settings.currency}</InfoRow>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Contact details" description="Used for account notifications and support." />
            <CardBody>
              <form action={updateProfileAction} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Full name" htmlFor="fullName">
                    <Input id="fullName" name="fullName" defaultValue={row?.full_name ?? user.fullName} required minLength={3} />
                  </Field>
                  <Field label="Mobile number" htmlFor="mobile">
                    <Input id="mobile" name="mobile" defaultValue={row?.mobile ?? ""} required />
                  </Field>
                </div>
                <Field label="Email address" htmlFor="email" hint="Email changes require support verification in this demo.">
                  <Input id="email" type="email" defaultValue={row?.email ?? user.email} disabled />
                </Field>
                <div className="flex justify-end">
                  <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Your referral link" description="Share this link to attribute new members to your account." />
            <CardBody className="space-y-3">
              <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 sm:flex-row sm:items-center">
                <span className="flex-1 truncate font-mono text-[11.5px] text-ink">{referralLink}</span>
                <CopyButton value={referralLink} label="Copy link" />
              </div>
              {referrer ? (
                <p className="text-[12px] text-muted">
                  You were referred by <span className="font-medium text-ink">{referrer.full_name}</span> ({referrer.member_id}).
                </p>
              ) : (
                <p className="text-[12px] text-muted">No referrer is attached to your account.</p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: UserCircle, title: "Profile accuracy", body: "Use your real contact details so support can verify account ownership." },
          { icon: ShieldCheck, title: "Private by default", body: "Your email and mobile number are never shown publicly or to other members." },
          { icon: CalendarDays, title: "Permanent identifiers", body: "Member IDs, referral codes and ledger references never change once issued." },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="p-4">
              <Icon className="h-5 w-5 text-brand" />
              <p className="mt-2 text-[13px] font-semibold text-navy">{item.title}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{item.body}</p>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title="Membership" description="A quick summary of your plan and activation state." actions={<BadgeCheck className="h-5 w-5 text-brand" />} />
        <CardBody className="grid gap-3 text-[12.5px] sm:grid-cols-3">
          <div>
            <p className="text-muted">Plan</p>
            <p className="mt-0.5 font-medium text-ink">{membership?.plan_name ?? "Founding Membership"}</p>
          </div>
          <div>
            <p className="text-muted">Status</p>
            <p className="mt-0.5 font-medium text-ink">{statusLabel(membership?.status ?? "PENDING")}</p>
          </div>
          <div>
            <p className="text-muted">Activated</p>
            <p className="mt-0.5 font-medium text-ink">{membership?.activated_at ? formatDate(membership.activated_at) : "—"}</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
