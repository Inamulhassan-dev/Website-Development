import { getAdminApi } from "@/lib/auth";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REPORTS: Record<string, { sql: string; filename: string }> = {
  users: {
    filename: "members",
    sql: `SELECT u.member_id AS "Member ID", u.full_name AS "Full name", u.email AS "Email",
                 u.mobile AS "Mobile", u.role AS "Role", u.account_status AS "Account status",
                 COALESCE(m.status,'PENDING') AS "Membership status",
                 to_char(u.created_at,'YYYY-MM-DD HH24:MI') AS "Registered",
                 to_char(u.last_login_at,'YYYY-MM-DD HH24:MI') AS "Last login"
            FROM users u LEFT JOIN memberships m ON m.user_id = u.id ORDER BY u.created_at`,
  },
  memberships: {
    filename: "membership-payments",
    sql: `SELECT p.reference AS "Reference", u.member_id AS "Member ID", u.full_name AS "Member",
                 p.amount_cents / 100.0 AS "Amount", p.currency AS "Currency", p.method AS "Method",
                 p.status AS "Status", to_char(p.created_at,'YYYY-MM-DD HH24:MI') AS "Created",
                 to_char(p.paid_at,'YYYY-MM-DD HH24:MI') AS "Paid"
            FROM membership_payments p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC`,
  },
  campaigns: {
    filename: "campaigns",
    sql: `SELECT c.code AS "Campaign ID", c.name AS "Campaign", c.advertiser_name AS "Advertiser",
                 c.status AS "Status", c.start_date AS "Start", c.end_date AS "End",
                 c.total_ad_allocation AS "Ad allocation",
                 (SELECT count(*) FROM advertisements a WHERE a.campaign_id = c.id) AS "Ads"
            FROM campaigns c ORDER BY c.created_at DESC`,
  },
  advertisements: {
    filename: "advertisements",
    sql: `SELECT a.code AS "Ad ID", a.title AS "Title", c.name AS "Campaign", a.status AS "Status",
                 a.duration_seconds AS "Duration (s)", a.required_watch_seconds AS "Required (s)",
                 a.reward_cents / 100.0 AS "Reward",
                 (SELECT count(*) FROM ad_sessions s WHERE s.advertisement_id = a.id AND s.status='COMPLETED') AS "Completions"
            FROM advertisements a JOIN campaigns c ON c.id = a.campaign_id ORDER BY a.created_at DESC`,
  },
  sessions: {
    filename: "ad-sessions",
    sql: `SELECT s.id AS "Session", u.member_id AS "Member ID", a.title AS "Advertisement",
                 s.status AS "Status", s.watched_seconds AS "Watched (s)", s.required_seconds AS "Required (s)",
                 s.reward_cents / 100.0 AS "Reward", s.risk_score AS "Risk score",
                 to_char(s.started_at,'YYYY-MM-DD HH24:MI') AS "Started",
                 to_char(s.completed_at,'YYYY-MM-DD HH24:MI') AS "Completed"
            FROM ad_sessions s JOIN users u ON u.id = s.user_id JOIN advertisements a ON a.id = s.advertisement_id
            ORDER BY s.started_at DESC`,
  },
  transactions: {
    filename: "wallet-transactions",
    sql: `SELECT t.reference AS "Transaction", u.member_id AS "Member ID", t.type AS "Type",
                 t.direction AS "Direction", t.amount_cents / 100.0 AS "Amount", t.status AS "Status",
                 t.description AS "Description", t.balance_after_cents / 100.0 AS "Balance after",
                 to_char(t.created_at,'YYYY-MM-DD HH24:MI') AS "Created"
            FROM wallet_transactions t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC`,
  },
  withdrawals: {
    filename: "withdrawals",
    sql: `SELECT w.reference AS "Reference", u.member_id AS "Member ID", w.amount_cents / 100.0 AS "Amount",
                 w.method AS "Method", w.status AS "Status", w.destination_masked AS "Destination",
                 w.decision_reason AS "Decision reason", to_char(w.created_at,'YYYY-MM-DD HH24:MI') AS "Requested",
                 to_char(w.decided_at,'YYYY-MM-DD HH24:MI') AS "Decided"
            FROM withdrawal_requests w JOIN users u ON u.id = w.user_id ORDER BY w.created_at DESC`,
  },
  referrals: {
    filename: "referrals",
    sql: `SELECT r.code AS "Code", ref.member_id AS "Referrer ID", ref.full_name AS "Referrer",
                 mem.member_id AS "Referred ID", mem.full_name AS "Referred", r.status AS "Status",
                 r.reward_cents / 100.0 AS "Reward", to_char(r.created_at,'YYYY-MM-DD HH24:MI') AS "Created",
                 to_char(r.qualified_at,'YYYY-MM-DD HH24:MI') AS "Qualified"
            FROM referrals r JOIN users ref ON ref.id = r.referrer_id JOIN users mem ON mem.id = r.referred_id
            ORDER BY r.created_at DESC`,
  },
  support: {
    filename: "support-tickets",
    sql: `SELECT t.reference AS "Reference", u.member_id AS "Member ID", t.category AS "Category",
                 t.subject AS "Subject", t.status AS "Status", t.priority AS "Priority",
                 to_char(t.created_at,'YYYY-MM-DD HH24:MI') AS "Created",
                 to_char(t.updated_at,'YYYY-MM-DD HH24:MI') AS "Updated"
            FROM support_tickets t JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC`,
  },
  audit: {
    filename: "audit-log",
    sql: `SELECT id AS "Event ID", actor_label AS "Actor", action AS "Action", target_type AS "Target type",
                 target_id AS "Target", COALESCE(reason,'') AS "Reason",
                 to_char(created_at,'YYYY-MM-DD HH24:MI:SS') AS "Timestamp"
            FROM audit_logs ORDER BY created_at DESC LIMIT 5000`,
  },
};

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function GET(request: Request) {
  const auth = await getAdminApi("reports.export");
  if ("error" in auth) return new Response("Forbidden", { status: auth.error === "forbidden" ? 403 : 401 });
  const type = new URL(request.url).searchParams.get("type") ?? "";
  const report = REPORTS[type];
  if (!report) return new Response("Unknown report", { status: 400 });

  const rows = await query<Record<string, unknown>>(report.sql);
  const headers = rows.length ? Object.keys(rows[0]) : ["No data"];
  const lines = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((h) => csvCell(row[h])).join(","))];
  await audit({
    actor: auth.user,
    action: "report.exported",
    targetType: "report",
    targetId: type,
    metadata: { rows: rows.length },
  });
  return new Response(`\uFEFF${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.filename}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
