import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Banknote,
  BellRing,
  Boxes,
  Clapperboard,
  CreditCard,
  LifeBuoy,
  MessageSquare,
  ShieldCheck,
  Users2,
  Wallet,
} from "lucide-react";
import { can, requireAdminPage } from "@/lib/auth";
import { one, query } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  addAdminNoteAction,
  adjustWalletAction,
  grantBundleAction,
  recordManualActivationAction,
  sendMemberNotificationAction,
  updateUserStatusAction,
} from "@/lib/actions/admin";
import {
  Avatar,
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  InfoRow,
  Input,
  LinkButton,
  PageHeader,
  Select,
  Table,
  TableWrap,
  Td,
  Textarea,
  Th,
  Tr,
} from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/interactive";
import { formatDate, formatMoney, relativeTime } from "@/lib/format";
import { ACCOUNT_STATUS_LABELS, STATUS_TONE, TXN_TYPE_LABELS, statusLabel } from "@/lib/constants";

export const metadata: Metadata = { title: "Member record" };
export const dynamic = "force-dynamic";

type UserRow = {
  id: string;
  member_id: string;
  full_name: string;
  email: string;
  mobile: string;
  role: string;
  account_status: string;
  status_reason: string | null;
  referral_code: string;
  created_at: Date;
  activated_at: Date | null;
  last_login_at: Date | null;
  suspended_at: Date | null;
  membership_status: string | null;
  membership_activated_at: Date | null;
  plan_name: string | null;
  price_cents: number | null;
  currency: string | null;
  available_cents: number | null;
  pending_cents: number | null;
  lifetime_credit_cents: number | null;
  referrer_name: string | null;
  referrer_member_id: string | null;
};

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminPage("users.view");
  const { id } = await params;

  const user = await one<UserRow>(
    `SELECT u.id, u.member_id, u.full_name, u.email, u.mobile, u.role, u.account_status, u.status_reason,
            u.referral_code, u.created_at, u.activated_at, u.last_login_at, u.suspended_at,
            m.status AS membership_status, m.activated_at AS membership_activated_at,
            p.name AS plan_name, p.price_cents, p.currency,
            w.available_cents, w.pending_cents, w.lifetime_credit_cents,
            referrer.full_name AS referrer_name, referrer.member_id AS referrer_member_id
       FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
       LEFT JOIN membership_plans p ON p.id = m.plan_id
       LEFT JOIN wallets w ON w.user_id = u.id
       LEFT JOIN users referrer ON referrer.id = u.referred_by_id
      WHERE u.id = $1 AND u.role = 'MEMBER'`,
    [id],
  );
  if (!user) notFound();

  const [settings, notes, txns, sessions, referrals, tickets, payments, bundles, granted] = await Promise.all([
    getSettings(),
    query<{ id: string; body: string; created_at: Date; author_name: string }>(
      `SELECT n.id, n.body, n.created_at, a.full_name AS author_name FROM admin_notes n
        JOIN users a ON a.id = n.author_id WHERE n.subject_user_id = $1 ORDER BY n.created_at DESC LIMIT 20`,
      [user.id],
    ),
    query<{ id: string; reference: string; type: string; direction: string; amount_cents: number; status: string; description: string; created_at: Date }>(
      `SELECT id, reference, type, direction, amount_cents, status, description, created_at
         FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 8`,
      [user.id],
    ),
    query<{ id: string; title: string; status: string; reward_cents: number; watched_seconds: number; required_seconds: number; started_at: Date; flag_reason: string | null }>(
      `SELECT s.id, a.title, s.status, s.reward_cents, s.watched_seconds, s.required_seconds, s.started_at, s.flag_reason
         FROM ad_sessions s JOIN advertisements a ON a.id = s.advertisement_id
        WHERE s.user_id = $1 ORDER BY s.started_at DESC LIMIT 8`,
      [user.id],
    ),
    query<{ id: string; status: string; reward_cents: number; created_at: Date; referred_name: string; referred_member_id: string }>(
      `SELECT r.id, r.status, r.reward_cents, r.created_at, u.full_name AS referred_name, u.member_id AS referred_member_id
         FROM referrals r JOIN users u ON u.id = r.referred_id
        WHERE r.referrer_id = $1 ORDER BY r.created_at DESC LIMIT 10`,
      [user.id],
    ),
    query<{ id: string; reference: string; subject: string; status: string; priority: string; updated_at: Date }>(
      `SELECT id, reference, subject, status, priority, updated_at FROM support_tickets WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 6`,
      [user.id],
    ),
    query<{ id: string; reference: string; amount_cents: number; currency: string; method: string; status: string; created_at: Date }>(
      `SELECT id, reference, amount_cents, currency, method, status, created_at FROM membership_payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [user.id],
    ),
    query<{ id: string; name: string; eligibility: string; status: string }>(
      `SELECT id, name, eligibility, status FROM bundles WHERE status = 'ACTIVE' ORDER BY display_order ASC`,
    ),
    query<{ bundle_id: string }>(`SELECT bundle_id FROM member_bundles WHERE user_id = $1`, [user.id]),
  ]);

  const grantedSet = new Set(granted.map((row) => row.bundle_id));
  const walletBalance = user.available_cents ?? 0;
  const canManage = can(admin, "users.manage");
  const canAdjust = can(admin, "wallet.adjust");
  const canBundles = can(admin, "bundles.manage");
  const canNotify = can(admin, "users.notify");
  const canMembership = can(admin, "memberships.manage");

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-navy">
        <ArrowLeft className="h-3.5 w-3.5" /> All members
      </Link>

      <PageHeader
        eyebrow={user.member_id}
        title={user.full_name}
        description={`${user.email} · ${user.mobile} · member since ${formatDate(user.created_at)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[user.account_status] ?? "neutral"}>{statusLabel(user.account_status)}</Badge>
            <Badge tone={STATUS_TONE[user.membership_status ?? "PENDING"] ?? "neutral"}>
              Membership: {statusLabel(user.membership_status ?? "PENDING")}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Available demo balance</p>
          <p className="mt-1 text-[20px] font-semibold text-navy">{formatMoney(walletBalance, settings.currency)}</p>
          <p className="mt-0.5 text-[11px] text-muted">{formatMoney(user.pending_cents ?? 0, settings.currency)} pending</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Lifetime demo credits</p>
          <p className="mt-1 text-[20px] font-semibold text-navy">{formatMoney(user.lifetime_credit_cents ?? 0, settings.currency)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Membership plan</p>
          <p className="mt-1 truncate text-[15px] font-semibold text-navy">{user.plan_name ?? "No plan"}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            {user.price_cents != null ? formatMoney(Number(user.price_cents), user.currency ?? settings.currency) : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[11.5px] text-muted">Last sign-in</p>
          <p className="mt-1 text-[15px] font-semibold text-navy">{user.last_login_at ? relativeTime(user.last_login_at) : "Never"}</p>
          <p className="mt-0.5 text-[11px] text-muted">{user.last_login_at ? formatDate(user.last_login_at, true) : "—"}</p>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader title="Account profile" description="Read-only identity fields." />
            <CardBody className="divide-y divide-line/70 py-1">
              <InfoRow label="Member ID"><span className="font-mono text-[12px]">{user.member_id}</span></InfoRow>
              <InfoRow label="Email">{user.email}</InfoRow>
              <InfoRow label="Mobile">{user.mobile}</InfoRow>
              <InfoRow label="Referral code"><span className="font-mono text-[12px]">{user.referral_code}</span></InfoRow>
              <InfoRow label="Referred by">
                {user.referrer_name ? `${user.referrer_name} (${user.referrer_member_id})` : "No referrer"}
              </InfoRow>
              <InfoRow label="Activated">{user.activated_at ? formatDate(user.activated_at, true) : "Not activated"}</InfoRow>
              <InfoRow label="Membership activated">
                {user.membership_activated_at ? formatDate(user.membership_activated_at, true) : "—"}
              </InfoRow>
              {user.status_reason ? <InfoRow label="Status reason">{user.status_reason}</InfoRow> : null}
            </CardBody>
          </Card>

          {canManage ? (
            <Card>
              <CardHeader title="Account status" description="Blocking or suspending revokes live sessions immediately." actions={<ShieldCheck className="h-4 w-4 text-muted" />} />
              <CardBody>
                <form action={updateUserStatusAction} className="space-y-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
                    <Field label="New status" htmlFor="status">
                      <Select id="status" name="status" defaultValue={user.account_status}>
                        {Object.entries(ACCOUNT_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Reason" htmlFor="reason" hint="Required for suspension, blocking or deactivation.">
                      <Input id="reason" name="reason" placeholder="Internal reason for this change" maxLength={500} />
                    </Field>
                  </div>
                  <div className="flex justify-end">
                    <SubmitButton variant="danger" size="sm" confirm="Change this member's account status? Sessions may be revoked.">
                      Update account status
                    </SubmitButton>
                  </div>
                </form>
              </CardBody>
            </Card>
          ) : null}

          {canAdjust ? (
            <Card>
              <CardHeader title="Demo wallet adjustment" description="Creates an explicit, auditable ledger entry." actions={<Wallet className="h-4 w-4 text-muted" />} />
              <CardBody>
                <form action={adjustWalletAction} className="space-y-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Direction" htmlFor="direction">
                      <Select id="direction" name="direction" defaultValue="CREDIT">
                        <option value="CREDIT">Credit</option>
                        <option value="DEBIT">Debit</option>
                      </Select>
                    </Field>
                    <Field label="Amount (USD)" htmlFor="amount">
                      <Input id="amount" name="amount" type="number" min="0.01" step="0.01" placeholder="0.00" required />
                    </Field>
                    <Field label="Reason" htmlFor="adjust-reason" hint="5+ characters.">
                      <Input id="adjust-reason" name="reason" placeholder="Why is this needed?" maxLength={300} required minLength={5} />
                    </Field>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-muted">Available: {formatMoney(walletBalance, settings.currency)}</p>
                    <SubmitButton variant="secondary" size="sm" confirm="Record this ledger adjustment? This cannot be edited afterwards.">
                      Record adjustment
                    </SubmitButton>
                  </div>
                </form>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Recent ad sessions"
              description="Latest verified viewing activity."
              actions={<LinkButton href="/admin/ad-analytics" variant="ghost" size="sm">Analytics</LinkButton>}
            />
            {sessions.length === 0 ? (
              <EmptyState icon={<Clapperboard className="h-5 w-5" />} title="No ad sessions" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr><Th>Advertisement</Th><Th>Status</Th><Th>Progress</Th><Th>Reward</Th><Th>Started</Th></tr>
                  </thead>
                  <tbody>
                    {sessions.map((session) => (
                      <Tr key={session.id}>
                        <Td>
                          <p className="font-medium text-navy">{session.title}</p>
                          {session.flag_reason ? <p className="mt-0.5 text-[10.5px] text-danger">{session.flag_reason}</p> : null}
                        </Td>
                        <Td><Badge tone={STATUS_TONE[session.status] ?? "neutral"}>{statusLabel(session.status)}</Badge></Td>
                        <Td className="text-muted">{session.watched_seconds}s / {session.required_seconds}s</Td>
                        <Td className={session.status === "COMPLETED" ? "font-medium text-success" : "text-muted"}>
                          {session.status === "COMPLETED" ? formatMoney(session.reward_cents, settings.currency) : "—"}
                        </Td>
                        <Td className="whitespace-nowrap text-muted">{formatDate(session.started_at, true)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHeader title="Wallet ledger" description="Most recent eight entries." actions={<LinkButton href="/admin/transactions" variant="ghost" size="sm">All transactions</LinkButton>} />
            {txns.length === 0 ? (
              <EmptyState icon={<Banknote className="h-5 w-5" />} title="No transactions" />
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr><Th>Reference</Th><Th>Type</Th><Th>Status</Th><Th className="text-right">Amount</Th><Th>Date</Th></tr>
                  </thead>
                  <tbody>
                    {txns.map((txn) => (
                      <Tr key={txn.id}>
                        <Td className="font-mono text-[11px]">{txn.reference}</Td>
                        <Td>{TXN_TYPE_LABELS[txn.type] ?? txn.type}</Td>
                        <Td><Badge tone={STATUS_TONE[txn.status] ?? "neutral"}>{statusLabel(txn.status)}</Badge></Td>
                        <Td className={`text-right font-medium ${txn.direction === "CREDIT" ? "text-success" : "text-ink"}`}>
                          {txn.direction === "CREDIT" ? "+" : "−"}{formatMoney(txn.amount_cents, settings.currency)}
                        </Td>
                        <Td className="whitespace-nowrap text-muted">{formatDate(txn.created_at, true)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {canNotify ? (
            <Card>
              <CardHeader title="Send a notification" description="Delivered to this member only." actions={<BellRing className="h-4 w-4 text-muted" />} />
              <CardBody>
                <form action={sendMemberNotificationAction} className="space-y-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <Field label="Title" htmlFor="notify-title">
                    <Input id="notify-title" name="title" maxLength={120} required minLength={3} placeholder="Short title" />
                  </Field>
                  <Field label="Message" htmlFor="notify-body">
                    <Textarea id="notify-body" name="body" maxLength={1000} required minLength={3} placeholder="Message to the member" className="min-h-[80px]" />
                  </Field>
                  <SubmitButton className="w-full" size="sm" pendingLabel="Sending…">Send notification</SubmitButton>
                </form>
              </CardBody>
            </Card>
          ) : null}

          {canMembership && user.membership_status !== "ACTIVE" ? (
            <Card>
              <CardHeader title="Manual membership activation" description="Records a simulated payment with a reason." actions={<BadgeCheck className="h-4 w-4 text-muted" />} />
              <CardBody>
                <form action={recordManualActivationAction} className="space-y-3">
                  <input type="hidden" name="userId" value={user.id} />
                  <Field label="Reason" htmlFor="activation-reason" hint="At least 8 characters. Stored in the audit log.">
                    <Textarea id="activation-reason" name="reason" required minLength={8} maxLength={500} placeholder="Why is manual activation appropriate?" className="min-h-[70px]" />
                  </Field>
                  <SubmitButton className="w-full" size="sm" variant="secondary" confirm="Activate this membership without a member-initiated payment?">
                    Record manual activation
                  </SubmitButton>
                </form>
              </CardBody>
            </Card>
          ) : null}

          {canBundles ? (
            <Card>
              <CardHeader title="Bundle access" description="Restricted bundles require explicit grants." actions={<Boxes className="h-4 w-4 text-muted" />} />
              <CardBody className="space-y-2">
                {bundles.length === 0 ? (
                  <p className="text-[12px] text-muted">No active bundles configured.</p>
                ) : (
                  bundles.map((bundle) => {
                    const has = grantedSet.has(bundle.id);
                    return (
                      <div key={bundle.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-medium text-ink">{bundle.name}</p>
                          <p className="text-[10.5px] text-muted">{statusLabel(bundle.eligibility)}</p>
                        </div>
                        <form action={grantBundleAction}>
                          <input type="hidden" name="userId" value={user.id} />
                          <input type="hidden" name="bundleId" value={bundle.id} />
                          <input type="hidden" name="action" value={has ? "REVOKE" : "GRANT"} />
                          <SubmitButton size="sm" variant={has ? "ghost" : "soft"} pendingLabel="…">
                            {has ? "Revoke" : "Grant"}
                          </SubmitButton>
                        </form>
                      </div>
                    );
                  })
                )}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Internal notes" description="Visible to staff only." actions={<MessageSquare className="h-4 w-4 text-muted" />} />
            <CardBody className="space-y-3">
              <form action={addAdminNoteAction} className="space-y-2">
                <input type="hidden" name="userId" value={user.id} />
                <Textarea name="body" placeholder="Add context for other staff…" maxLength={2000} required minLength={3} className="min-h-[70px]" />
                <SubmitButton size="sm" variant="secondary" className="w-full" pendingLabel="Saving…">Save note</SubmitButton>
              </form>
              <div className="space-y-2">
                {notes.length === 0 ? (
                  <p className="text-[11.5px] text-muted">No internal notes yet.</p>
                ) : (
                  notes.map((note) => (
                    <div key={note.id} className="rounded-xl bg-surface px-3 py-2">
                      <p className="text-[11.5px] leading-relaxed text-ink">{note.body}</p>
                      <p className="mt-1 text-[10px] text-muted">{note.author_name} · {relativeTime(note.created_at)}</p>
                    </div>
                  ))
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Referrals" description="Members this account invited." actions={<Users2 className="h-4 w-4 text-muted" />} />
            {referrals.length === 0 ? (
              <EmptyState icon={<Users2 className="h-5 w-5" />} title="No referrals" />
            ) : (
              <div className="divide-y divide-line/70">
                {referrals.map((referral) => (
                  <div key={referral.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-medium text-navy">{referral.referred_name}</p>
                      <p className="font-mono text-[10px] text-muted">{referral.referred_member_id}</p>
                    </div>
                    <div className="text-right">
                      <Badge tone={STATUS_TONE[referral.status] ?? "neutral"}>{statusLabel(referral.status)}</Badge>
                      {referral.status === "REWARDED" ? (
                        <p className="mt-0.5 text-[10.5px] text-success">{formatMoney(referral.reward_cents, settings.currency)}</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Membership payments" actions={<CreditCard className="h-4 w-4 text-muted" />} />
            {payments.length === 0 ? (
              <EmptyState icon={<CreditCard className="h-5 w-5" />} title="No payments" />
            ) : (
              <TableWrap>
                <Table className="min-w-[420px]">
                  <thead><tr><Th>Reference</Th><Th>Amount</Th><Th>Status</Th></tr></thead>
                  <tbody>
                    {payments.map((payment) => (
                      <Tr key={payment.id}>
                        <Td className="font-mono text-[11px]">{payment.reference}</Td>
                        <Td>{formatMoney(payment.amount_cents, payment.currency)}</Td>
                        <Td><Badge tone={STATUS_TONE[payment.status] ?? "neutral"}>{statusLabel(payment.status)}</Badge></Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>

          <Card>
            <CardHeader title="Support tickets" actions={<LifeBuoy className="h-4 w-4 text-muted" />} />
            {tickets.length === 0 ? (
              <EmptyState icon={<LifeBuoy className="h-5 w-5" />} title="No tickets" />
            ) : (
              <div className="divide-y divide-line/70">
                {tickets.map((ticket) => (
                  <Link key={ticket.id} href={`/admin/support/${ticket.id}`} className="block px-5 py-2.5 transition hover:bg-[#fafcff]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-[12px] font-medium text-navy">{ticket.subject}</p>
                      <Badge tone={STATUS_TONE[ticket.status] ?? "neutral"}>{statusLabel(ticket.status)}</Badge>
                    </div>
                    <p className="font-mono text-[10px] text-muted">{ticket.reference} · {relativeTime(ticket.updated_at)}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-2xl border border-line bg-[#fafcff] p-4 text-[11.5px] leading-relaxed text-muted">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        Member records contain personal data. Access is limited by role and every sensitive action is recorded in the
        append-only audit log with the acting administrator, reason and timestamp.
      </div>
    </div>
  );
}
