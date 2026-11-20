import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy notice" };

const sections = [
  {
    title: "What we collect",
    body: "Account registration details (full name, email address, mobile number), authentication metadata (hashed password, session timestamps, IP address and browser user-agent), membership and wallet records, advertising session activity, referral attribution, support messages and notification history.",
  },
  {
    title: "Why we collect it",
    body: "To operate the demonstration: create and secure your account, generate your Member ID and referral code, demonstrate membership activation, validate advertisement viewing sessions, maintain a demo wallet ledger, respond to support requests, and keep an audit trail of administrative actions.",
  },
  {
    title: "Passwords and security",
    body: "Passwords are hashed with bcrypt and never stored in plain text. Sessions use httpOnly cookies and are stored server-side so they can be revoked. Role permissions are enforced by the backend on every protected operation.",
  },
  {
    title: "What we never ask for",
    body: "We never ask for your online banking password, card PIN, private keys, wallet recovery phrases or identity documents. Withdrawal destinations in this demo are fictional and masked. Do not enter real financial credentials anywhere on this site.",
  },
  {
    title: "Advertising activity",
    body: "The platform records session start, playback progress, completion and limited risk indicators such as whether the browser tab was hidden. It does not use invasive device fingerprinting, camera, microphone or location tracking.",
  },
  {
    title: "Cookies",
    body: "One essential session cookie is used to keep you signed in. No advertising or third-party analytics cookies are set by this demonstration application.",
  },
  {
    title: "Data retention",
    body: "Demonstration data is retained for the life of the demo environment. Financial ledger rows and audit records are append-only by design. Account deactivation does not erase records required for audit and dispute handling.",
  },
  {
    title: "Your choices",
    body: "You can update your profile and password in the member portal, mark notifications as read and contact support. To request deletion of demonstration account data, use the contact page.",
  },
  {
    title: "Third-party services",
    body: "Sample advertisement videos are loaded from a public sample media host. No payment processor, email provider, SMS provider or identity-verification service is connected. Future integrations will be disclosed before launch.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Privacy</p>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-navy sm:text-[40px]">Privacy notice</h1>
        <p className="mt-3 text-[12.5px] text-muted">Demonstration version · Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long" })}</p>

        <p className="mt-6 text-[13.5px] leading-relaxed text-[#51617a]">
          This notice explains what the demonstration platform stores and why. It is written for a client demonstration and
          must be replaced with a jurisdiction-specific notice before any real launch.
        </p>

        <div className="mt-8 space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-[16px] font-semibold text-navy">{section.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#51617a]">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-line bg-surface p-5 text-[12.5px] leading-relaxed text-muted">
          <p className="font-semibold text-navy">Demo data notice</p>
          <p className="mt-1">
            The members, staff accounts, payments and campaigns shown by default are fictional seed data. They do not use real
            people's private information.
          </p>
        </div>
      </div>
    </div>
  );
}
