import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms of use" };

const sections = [
  {
    title: "1. Demonstration status",
    body: "This website is a functional demonstration of a proposed private membership platform. It is not a live financial service. Membership fees, advertising rewards, referral rewards and withdrawals are simulated. No real money is collected, held, transferred or paid out on this platform.",
  },
  {
    title: "2. No income guarantee",
    body: "Nothing on this website is a promise of income, earnings or financial return. Demonstration reward values are illustrative. Simulated viewing activity is not verified advertising traffic and does not represent real advertising performance.",
  },
  {
    title: "3. Eligibility and accounts",
    body: "You must provide accurate registration information and maintain one account per person. Accounts may be suspended or blocked where there is evidence of duplicate accounts, automated activity, attempts to manipulate viewing sessions, or misuse of the platform. Administrators record reasons for account status changes.",
  },
  {
    title: "4. Membership activation",
    body: "Membership is activated after completion of the demonstration payment workflow or an auditable administrative activation. The membership fee and benefits are configurable by platform administrators and may change before a production launch.",
  },
  {
    title: "5. Rewards and wallet credits",
    body: "Demo rewards are credited only when server-side eligibility checks pass. Wallet balances are recorded in a transaction ledger. Duplicate credits are prevented. Demo credits have no cash value and cannot be exchanged for real currency.",
  },
  {
    title: "6. Withdrawal requests",
    body: "Withdrawal requests are simulations used to demonstrate a review workflow. No bank transfer, card payout or cryptocurrency transfer is executed. Never submit real banking credentials, private keys or seed phrases. Requests may be approved or rejected by an authorized finance administrator for demonstration purposes.",
  },
  {
    title: "7. Referral programme",
    body: "Referral codes are provided to demonstrate attribution and eligibility rules. A referral reward is not dependent on a referred person recruiting further members. The production referral programme requires legal review before launch.",
  },
  {
    title: "8. Acceptable use",
    body: "You may not attempt to bypass authentication, access another member's account, call administrator APIs without authorization, upload malicious files, scrape personal data, or interfere with the platform's operation. Security controls and audit logging are active.",
  },
  {
    title: "9. Data and privacy",
    body: "Personal data submitted in this demonstration is used to operate the demo experience. See the Privacy Notice for details. Do not submit sensitive personal, financial or identity documents.",
  },
  {
    title: "10. Changes and contact",
    body: "These terms may be updated as the product develops. For questions about this demonstration, use the contact page. Production terms must be reviewed by qualified legal counsel in the relevant jurisdiction.",
  },
];

export default function TermsPage() {
  return (
    <div className="container-page py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand">Legal</p>
        <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-navy sm:text-[40px]">Terms of use</h1>
        <p className="mt-3 text-[12.5px] text-muted">Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} · Demonstration version</p>

        <div className="mt-6 rounded-2xl border border-[#f4e2bd] bg-[#fffaf0] p-5 text-[12.5px] leading-relaxed text-[#8a6114]">
          <p className="font-semibold">Summary</p>
          <p className="mt-1">
            This is a private platform demonstration. Payments, rewards and withdrawals are simulated. No income is
            guaranteed. Real-money operation requires legal approval and licensed payment partners.
          </p>
        </div>

        <div className="mt-8 space-y-7">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-[16px] font-semibold text-navy">{section.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[#51617a]">{section.body}</p>
            </section>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-3 border-t border-line pt-6 text-[12.5px]">
          <Link href="/privacy" className="font-semibold text-brand hover:text-brand-dark">Privacy notice →</Link>
          <Link href="/contact" className="font-semibold text-brand hover:text-brand-dark">Contact us →</Link>
        </div>
      </div>
    </div>
  );
}
