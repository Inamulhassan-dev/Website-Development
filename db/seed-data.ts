import bcrypt from "bcryptjs";
import { newId, query, tx } from "../lib/db";
import { DEFAULT_SETTINGS } from "../lib/settings";
import { PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS, ROLES } from "../lib/constants";

const MEMBER_PASSWORD = "Demo#2026";
const STAFF_PASSWORD = "Admin#2026";
const YEAR = new Date().getFullYear();

const daysAgo = (days: number, hours = 0) => new Date(Date.now() - days * 86400000 - hours * 3600000);

const SAMPLE_VIDEOS = [
  "/demo-ads/ad-01.mp4",
  "/demo-ads/ad-02.mp4",
  "/demo-ads/ad-03.mp4",
  "/demo-ads/ad-04.mp4",
  "/demo-ads/ad-05.mp4",
  "/demo-ads/ad-06.mp4",
  "/demo-ads/ad-07.mp4",
  "/demo-ads/ad-08.mp4",
  "/demo-ads/ad-09.mp4",
  "/demo-ads/ad-10.mp4",
  "/demo-ads/ad-11.mp4",
  "/demo-ads/ad-12.mp4",
];

type SeedMember = {
  key: string;
  name: string;
  email: string;
  mobile: string;
  status: "ACTIVE" | "PENDING_ACTIVATION" | "SUSPENDED" | "BLOCKED";
  membership: "ACTIVE" | "PENDING";
  joinedDaysAgo: number;
  referrer?: string;
};

const members: SeedMember[] = [
  { key: "m01", name: "Ayesha Khan", email: "ayesha.khan@umarbaig.demo", mobile: "+1 555 0101", status: "ACTIVE", membership: "ACTIVE", joinedDaysAgo: 64 },
  { key: "m02", name: "Daniel Whitfield", email: "daniel.whitfield@umarbaig.demo", mobile: "+1 555 0102", status: "ACTIVE", membership: "ACTIVE", joinedDaysAgo: 58, referrer: "m01" },
  { key: "m03", name: "Sofia Martinez", email: "sofia.martinez@umarbaig.demo", mobile: "+1 555 0103", status: "ACTIVE", membership: "ACTIVE", joinedDaysAgo: 51 },
  { key: "m04", name: "Omar Farooq", email: "omar.farooq@umarbaig.demo", mobile: "+1 555 0104", status: "ACTIVE", membership: "ACTIVE", joinedDaysAgo: 44, referrer: "m01" },
  { key: "m05", name: "Grace Adeyemi", email: "grace.adeyemi@umarbaig.demo", mobile: "+1 555 0105", status: "ACTIVE", membership: "ACTIVE", joinedDaysAgo: 38, referrer: "m01" },
  { key: "m06", name: "Leo Tanaka", email: "leo.tanaka@umarbaig.demo", mobile: "+1 555 0106", status: "ACTIVE", membership: "ACTIVE", joinedDaysAgo: 30, referrer: "m03" },
  { key: "m07", name: "Hannah Brooks", email: "hannah.brooks@umarbaig.demo", mobile: "+1 555 0107", status: "ACTIVE", membership: "ACTIVE", joinedDaysAgo: 26 },
  { key: "m08", name: "Marcus Reed", email: "marcus.reed@umarbaig.demo", mobile: "+1 555 0108", status: "SUSPENDED", membership: "ACTIVE", joinedDaysAgo: 22 },
  { key: "m09", name: "Priya Nair", email: "priya.nair@umarbaig.demo", mobile: "+1 555 0109", status: "PENDING_ACTIVATION", membership: "PENDING", joinedDaysAgo: 6 },
  { key: "m10", name: "Ethan Cole", email: "ethan.cole@umarbaig.demo", mobile: "+1 555 0110", status: "ACTIVE", membership: "ACTIVE", joinedDaysAgo: 3 },
];

const staff = [
  { key: "super", name: "Umar Baig", email: "superadmin@umarbaig.demo", role: "SUPER_ADMIN" as const },
  { key: "fin", name: "Nadia Rahman", email: "finance@umarbaig.demo", role: "FINANCE_ADMIN" as const },
  { key: "sup", name: "Chris Palmer", email: "support@umarbaig.demo", role: "SUPPORT_ADMIN" as const },
  { key: "mod", name: "Ivan Petrov", email: "moderator@umarbaig.demo", role: "MODERATOR" as const },
];

const campaigns = [
  { id: "cmp_seed_01", code: "CMP-2026-01001", name: "Evergreen Home Collection", advertiser: "Northwind Living", status: "ACTIVE", start: -40, end: 40, alloc: 5000, reward: 180, description: "Premium home and lifestyle placements for the founding member audience." },
  { id: "cmp_seed_02", code: "CMP-2026-01002", name: "Future Mobility Launch", advertiser: "Vela Motors", status: "ACTIVE", start: -25, end: 55, alloc: 3500, reward: 220, description: "Awareness campaign for a fictional electric vehicle range." },
  { id: "cmp_seed_03", code: "CMP-2026-01003", name: "Peak Performance Series", advertiser: "Atlas Athletics", status: "ACTIVE", start: -18, end: 30, alloc: 2200, reward: 150, description: "Short-form sports and training creatives for demonstration." },
  { id: "cmp_seed_04", code: "CMP-2026-01004", name: "Winter Travel Showcase", advertiser: "Meridian Escapes", status: "PAUSED", start: -10, end: 70, alloc: 1800, reward: 200, description: "Paused while creative assets are refreshed." },
  { id: "cmp_seed_05", code: "CMP-2026-01005", name: "Q3 Brand Teaser", advertiser: "Lumen Studio", status: "SCHEDULED", start: 14, end: 90, alloc: 900, reward: 120, description: "Scheduled campaign that has not started yet." },
];

const ads = [
  { id: "adv_seed_01", code: "ADV-2026-02001", title: "A calmer morning at home", desc: "A 15-second lifestyle placement for fictional home brand Northwind Living.", advertiser: "Northwind Living", campaign: "cmp_seed_01", reward: 180, duration: 15, required: 10, status: "ACTIVE", start: -40, end: 40 },
  { id: "adv_seed_02", code: "ADV-2026-02002", title: "Designed for everyday ease", desc: "Product story for Northwind Living's fictional collection.", advertiser: "Northwind Living", campaign: "cmp_seed_01", reward: 160, duration: 15, required: 10, status: "ACTIVE", start: -40, end: 40 },
  { id: "adv_seed_03", code: "ADV-2026-02003", title: "Spaces that breathe", desc: "A short interior film used for demonstration purposes.", advertiser: "Northwind Living", campaign: "cmp_seed_01", reward: 200, duration: 15, required: 10, status: "ACTIVE", start: -40, end: 40 },
  { id: "adv_seed_04", code: "ADV-2026-02004", title: "The road ahead, electrified", desc: "Vela Motors concept reveal. Fictional automotive creative.", advertiser: "Vela Motors", campaign: "cmp_seed_02", reward: 240, duration: 15, required: 12, status: "ACTIVE", start: -25, end: 55 },
  { id: "adv_seed_05", code: "ADV-2026-02005", title: "Charge less, go further", desc: "A second Vela Motors demonstration placement.", advertiser: "Vela Motors", campaign: "cmp_seed_02", reward: 260, duration: 15, required: 12, status: "ACTIVE", start: -25, end: 55 },
  { id: "adv_seed_06", code: "ADV-2026-02006", title: "Built for the long run", desc: "Atlas Athletics training film. Fictional sports creative.", advertiser: "Atlas Athletics", campaign: "cmp_seed_03", reward: 150, duration: 15, required: 10, status: "ACTIVE", start: -18, end: 30 },
  { id: "adv_seed_07", code: "ADV-2026-02007", title: "Every rep counts", desc: "Short performance creative for the Peak Performance series.", advertiser: "Atlas Athletics", campaign: "cmp_seed_03", reward: 170, duration: 15, required: 10, status: "ACTIVE", start: -18, end: 30 },
  { id: "adv_seed_08", code: "ADV-2026-02008", title: "Weekend, reimagined", desc: "Meridian Escapes travel teaser. Paused campaign creative.", advertiser: "Meridian Escapes", campaign: "cmp_seed_04", reward: 210, duration: 15, required: 12, status: "ACTIVE", start: -10, end: 70 },
  { id: "adv_seed_09", code: "ADV-2026-02009", title: "A short break, properly taken", desc: "Second travel creative for Meridian Escapes.", advertiser: "Meridian Escapes", campaign: "cmp_seed_04", reward: 230, duration: 15, required: 12, status: "PAUSED", start: -10, end: 70 },
  { id: "adv_seed_10", code: "ADV-2026-02010", title: "Notes from the studio", desc: "Behind-the-scenes teaser for a fictional design studio.", advertiser: "Lumen Studio", campaign: "cmp_seed_05", reward: 120, duration: 15, required: 10, status: "DRAFT", start: 14, end: 90 },
  { id: "adv_seed_11", code: "ADV-2026-02011", title: "Gold collection preview", desc: "Restricted-access creative for eligible Gold bundle members.", advertiser: "Northwind Living", campaign: "cmp_seed_01", reward: 300, duration: 15, required: 12, status: "ACTIVE", start: -40, end: 40 },
  { id: "adv_seed_12", code: "ADV-2026-02012", title: "Platinum first look", desc: "Platinum-only demonstration creative.", advertiser: "Vela Motors", campaign: "cmp_seed_02", reward: 350, duration: 15, required: 12, status: "ACTIVE", start: -25, end: 55 },
];

const bundles = [
  { id: "bnd_seed_01", code: "BND-2026-0001", name: "Starter Bundle", count: 5, eligibility: "ALL_MEMBERS", order: 1, adIds: ["adv_seed_01", "adv_seed_02", "adv_seed_03", "adv_seed_04", "adv_seed_05"] },
  { id: "bnd_seed_02", code: "BND-2026-0002", name: "Basic Bundle", count: 10, eligibility: "ALL_MEMBERS", order: 2, adIds: ["adv_seed_01", "adv_seed_02", "adv_seed_03", "adv_seed_04", "adv_seed_05", "adv_seed_06", "adv_seed_07"] },
  { id: "bnd_seed_03", code: "BND-2026-0003", name: "Standard Bundle", count: 15, eligibility: "ALL_MEMBERS", order: 3, adIds: ["adv_seed_01", "adv_seed_02", "adv_seed_03", "adv_seed_04", "adv_seed_05", "adv_seed_06", "adv_seed_07", "adv_seed_08"] },
  { id: "bnd_seed_04", code: "BND-2026-0004", name: "Premium Bundle", count: 20, eligibility: "ALL_MEMBERS", order: 4, adIds: ["adv_seed_01", "adv_seed_02", "adv_seed_03", "adv_seed_04", "adv_seed_05", "adv_seed_06", "adv_seed_07"] },
  { id: "bnd_seed_05", code: "BND-2026-0005", name: "Gold Bundle", count: 25, eligibility: "RESTRICTED", order: 5, adIds: ["adv_seed_11"] },
  { id: "bnd_seed_06", code: "BND-2026-0006", name: "Platinum Bundle", count: 30, eligibility: "RESTRICTED", order: 6, adIds: ["adv_seed_12"] },
];

const completedSessions: Array<{ member: string; ad: string; days: number }> = [
  { member: "m01", ad: "adv_seed_01", days: 21 },
  { member: "m01", ad: "adv_seed_02", days: 14 },
  { member: "m01", ad: "adv_seed_03", days: 7 },
  { member: "m01", ad: "adv_seed_04", days: 23 },
  { member: "m01", ad: "adv_seed_05", days: 22 },
  { member: "m01", ad: "adv_seed_11", days: 20 },
  { member: "m01", ad: "adv_seed_12", days: 19 },
  { member: "m02", ad: "adv_seed_01", days: 18 },
  { member: "m02", ad: "adv_seed_04", days: 9 },
  { member: "m03", ad: "adv_seed_02", days: 16 },
  { member: "m03", ad: "adv_seed_05", days: 5 },
  { member: "m03", ad: "adv_seed_01", days: 17 },
  { member: "m03", ad: "adv_seed_03", days: 15 },
  { member: "m04", ad: "adv_seed_01", days: 12 },
  { member: "m04", ad: "adv_seed_02", days: 11 },
  { member: "m04", ad: "adv_seed_03", days: 10 },
  { member: "m05", ad: "adv_seed_03", days: 8 },
  { member: "m06", ad: "adv_seed_02", days: 4 },
];

const adById = new Map(ads.map((ad) => [ad.id, ad]));
const userId = (key: string) => `usr_seed_${key}`;
const memberById = new Map(members.map((m) => [m.key, m]));

export async function seedDatabase() {
  console.log("[seed] starting demo seed (idempotent)");
  const memberHash = await bcrypt.hash(MEMBER_PASSWORD, 11);
  const staffHash = await bcrypt.hash(STAFF_PASSWORD, 11);

  /* Settings */
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await query(
      `INSERT INTO platform_settings (key, value) VALUES ($1,$2::jsonb) ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify(value)],
    );
  }

  /* Roles & permissions */
  for (const role of ROLES) {
    await query(`INSERT INTO roles (key, name, description) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING`, [
      role,
      ROLE_LABELS[role],
      role === "SUPER_ADMIN" ? "Full platform access" : role === "FINANCE_ADMIN" ? "Finance and withdrawal review" : role === "SUPPORT_ADMIN" ? "Member support" : "Advertising activity moderation",
    ]);
  }
  for (const [key, label] of Object.entries(PERMISSIONS)) {
    const module = key.split(".")[0];
    await query(`INSERT INTO permissions (key, label, module) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING`, [key, label, module]);
  }
  for (const role of ROLES) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      await query(
        `INSERT INTO role_permissions (role_key, permission_key) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
        [role, permission],
      );
    }
  }

  /* Membership plan */
  await query(
    `INSERT INTO membership_plans (id, name, description, price_cents, currency, benefits, activation_requirements, is_active)
     VALUES ($1,$2,$3,$4,'USD',$5::jsonb,$6,TRUE) ON CONFLICT (id) DO NOTHING`,
    [
      "plan_seed_founding",
      "Founding Membership",
      "One-time activation for the private demonstration platform. Unlocks the member dashboard, advertising campaigns, demo rewards and referral tools.",
      4900,
      JSON.stringify([
        "Access to eligible advertising bundles",
        "Demo reward credits for completed sessions",
        "Demo wallet with full transaction history",
        "Personal referral link and programme tracking",
        "Member support and account security tools",
      ]),
      "Complete the one-time DEMO membership payment or be activated by an administrator.",
    ],
  );

  /* Staff */
  for (const person of staff) {
    await query(
      `INSERT INTO users (id, member_id, full_name, email, mobile, password_hash, role, account_status, referral_code, activated_at, last_login_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE',$8, now() - interval '80 days', now() - interval '2 hours', now() - interval '90 days')
       ON CONFLICT (id) DO NOTHING`,
      [
        userId(person.key),
        `UB-${YEAR}-0009${staff.indexOf(person)}`,
        person.name,
        person.email,
        `+1 555 019${staff.indexOf(person)}`,
        staffHash,
        person.role,
        `UBREF0009${staff.indexOf(person)}`,
      ],
    );
    await query(`INSERT INTO wallets (id, user_id) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING`, [newId("wal"), userId(person.key)]);
  }

  /* Members */
  for (const [index, member] of members.entries()) {
    const id = userId(member.key);
    await query(
      `INSERT INTO users (id, member_id, full_name, email, mobile, password_hash, role, account_status, referral_code,
         referred_by_id, activated_at, suspended_at, last_login_at, status_reason, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,'MEMBER',$7,$8,$9,$10,$11,$12,$13,$14,$14)
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        `UB-${YEAR}-${String(index + 1).padStart(6, "0")}`,
        member.name,
        member.email,
        member.mobile,
        memberHash,
        member.status,
        `UBREF${String(index + 1).padStart(6, "0")}`,
        member.referrer ? userId(member.referrer) : null,
        member.membership === "ACTIVE" ? daysAgo(member.joinedDaysAgo - 1) : null,
        member.status === "SUSPENDED" ? daysAgo(2) : null,
        daysAgo(member.joinedDaysAgo - 2, 3),
        member.status === "SUSPENDED" ? "Repeated policy violations flagged by moderation (demo reason)" : null,
        daysAgo(member.joinedDaysAgo),
      ],
    );
    await query(
      `INSERT INTO memberships (id, user_id, plan_id, status, activated_at)
       VALUES ($1,$2,'plan_seed_founding',$3,$4)
       ON CONFLICT (user_id) DO NOTHING`,
      [`mem_seed_${member.key}`, id, member.membership, member.membership === "ACTIVE" ? daysAgo(member.joinedDaysAgo - 1) : null],
    );
    await query(`INSERT INTO wallets (id, user_id) VALUES ($1,$2) ON CONFLICT (user_id) DO NOTHING`, [newId("wal"), id]);

    if (member.membership === "ACTIVE") {
      await query(
        `INSERT INTO membership_payments (id, reference, user_id, plan_id, amount_cents, currency, method, status, paid_at, created_at)
         VALUES ($1,$2,$3,'plan_seed_founding',4900,'USD','DEMO_CARD','SUCCESS',$4,$4)
         ON CONFLICT (id) DO NOTHING`,
        [`pay_seed_${member.key}`, `PAY-${YEAR}-10${String(index + 1).padStart(3, "0")}`, id, daysAgo(member.joinedDaysAgo - 1)],
      );
    } else {
      await query(
        `INSERT INTO membership_payments (id, reference, user_id, plan_id, amount_cents, currency, method, status, created_at)
         VALUES ($1,$2,$3,'plan_seed_founding',4900,'USD','DEMO_CARD','PENDING',$4)
         ON CONFLICT (id) DO NOTHING`,
        [`pay_seed_${member.key}`, `PAY-${YEAR}-10${String(index + 1).padStart(3, "0")}`, id, daysAgo(member.joinedDaysAgo)],
      );
    }
  }
  // A historical failed demo payment for a realistic payment history.
  await query(
    `INSERT INTO membership_payments (id, reference, user_id, plan_id, amount_cents, currency, method, status, failure_reason, created_at)
     VALUES ('pay_seed_m02_failed','PAY-${YEAR}-10999',$1,'plan_seed_founding',4900,'USD','DEMO_CARD','FAILED','Simulated card decline (demo)', now() - interval '59 days')
     ON CONFLICT (id) DO NOTHING`,
    [userId("m02")],
  );

  /* Campaigns */
  for (const c of campaigns) {
    await query(
      `INSERT INTO campaigns (id, code, name, description, advertiser_name, start_date, end_date, status,
         total_ad_allocation, default_reward_cents, terms, created_at)
       VALUES ($1,$2,$3,$4,$5, CURRENT_DATE + $6::int, CURRENT_DATE + $7::int, $8,$9,$10,$11, now() - interval '42 days')
       ON CONFLICT (id) DO NOTHING`,
      [c.id, c.code, c.name, c.description, c.advertiser, c.start, c.end, c.status, c.alloc, c.reward,
        "Demonstration campaign terms. Creatives are sample assets and do not represent real advertising delivery."],
    );
  }

  /* Advertisements */
  for (const [index, ad] of ads.entries()) {
    await query(
      `INSERT INTO advertisements (id, code, title, description, advertiser_name, campaign_id, video_url,
         duration_seconds, reward_cents, required_watch_seconds, start_date, end_date, status, display_order, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, CURRENT_DATE + $11::int, CURRENT_DATE + $12::int, $13,$14, now() - interval '35 days')
       ON CONFLICT (id) DO NOTHING`,
      [ad.id, ad.code, ad.title, ad.desc, ad.advertiser, ad.campaign, SAMPLE_VIDEOS[index % SAMPLE_VIDEOS.length],
        15, ad.reward, 5, ad.start, ad.end, ad.status, index + 1],
    );
  }

  /* Bundles */
  for (const b of bundles) {
    await query(
      `INSERT INTO bundles (id, code, name, description, ad_count, status, eligibility, display_order, created_at)
       VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$7, now() - interval '40 days') ON CONFLICT (id) DO NOTHING`,
      [b.id, b.code, b.name, `${b.name} — demonstration advertising allocation for eligible members.`, b.count, b.eligibility, b.order],
    );
    for (const [i, adId] of b.adIds.entries()) {
      await query(
        `INSERT INTO bundle_advertisements (bundle_id, advertisement_id, display_order) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [b.id, adId, i + 1],
      );
    }
  }

  /* Restricted bundle access for two members */
  for (const [memberKey, bundleId] of [["m01", "bnd_seed_05"], ["m01", "bnd_seed_06"], ["m02", "bnd_seed_05"]] as const) {
    await query(
      `INSERT INTO member_bundles (user_id, bundle_id, granted_by) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [userId(memberKey), bundleId, userId("super")],
    );
  }

  /* Completed ad sessions + wallet credits */
  for (const [index, session] of completedSessions.entries()) {
    const ad = adById.get(session.ad)!;
    const sessionId = `ads_seed_${String(index + 1).padStart(2, "0")}`;
    const started = daysAgo(session.days, 2);
    const completed = new Date(started.getTime() + ad.required * 1000 + 5000);
    await query(
      `INSERT INTO ad_sessions (id, user_id, advertisement_id, campaign_id, status, started_at, last_activity_at,
         expires_at, watched_seconds, required_seconds, reward_cents, completed_at, ip, user_agent, created_at)
       VALUES ($1,$2,$3,$4,'COMPLETED',$5,$6,$7,$8,$8,$9,$6,'127.0.0.1','Demo seed', $5)
       ON CONFLICT (id) DO NOTHING`,
      [sessionId, userId(session.member), ad.id, ad.campaign, started, completed,
        new Date(started.getTime() + 3600000), ad.required, ad.reward],
    );
    await query(
      `INSERT INTO ad_session_events (id, session_id, type, payload, created_at)
       VALUES ($1,$2,'COMPLETED',$3::jsonb,$4) ON CONFLICT (id) DO NOTHING`,
      [`evt_seed_${String(index + 1).padStart(2, "0")}`, sessionId, JSON.stringify({ rewardCents: ad.reward, seeded: true }), completed],
    );
    await query(
      `INSERT INTO wallet_transactions (id, reference, user_id, type, direction, amount_cents, status, description,
         related_type, related_id, idempotency_key, created_at)
       VALUES ($1,$2,$3,'AD_REWARD','CREDIT',$4,'COMPLETED',$5,'ad_session',$6,$7,$8)
       ON CONFLICT (id) DO NOTHING`,
      [`txn_seed_ad_${String(index + 1).padStart(2, "0")}`, `TXN-${YEAR}-20${String(index + 1).padStart(3, "0")}`,
        userId(session.member), ad.reward, `Demo reward — ${ad.title}`, sessionId, `ad-session:${sessionId}`, completed],
    );
  }

  /* Flagged session and an in-progress session */
  await query(
    `INSERT INTO ad_sessions (id, user_id, advertisement_id, campaign_id, status, started_at, last_activity_at, expires_at,
       watched_seconds, required_seconds, reward_cents, risk_score, flag_reason, ip, user_agent, created_at)
     VALUES ('ads_seed_flagged','${userId("m07")}','adv_seed_01','cmp_seed_01','FLAGGED', now() - interval '2 days',
       now() - interval '2 days', now() - interval '2 days' + interval '1 hour', 4, 10, 180, 52,
       'Completion attempted before requirements were met (watched 4s / 10s, elapsed 5s)','127.0.0.1','Demo seed', now() - interval '2 days')
     ON CONFLICT (id) DO NOTHING`,
  );
  await query(
    `INSERT INTO ad_sessions (id, user_id, advertisement_id, campaign_id, status, started_at, last_activity_at, expires_at,
       watched_seconds, required_seconds, reward_cents, ip, user_agent, created_at)
     VALUES ('ads_seed_active','${userId("m05")}','adv_seed_06','cmp_seed_03','IN_PROGRESS', now() - interval '8 minutes',
       now() - interval '2 minutes', now() + interval '52 minutes', 3, 10, 150,'127.0.0.1','Demo seed', now() - interval '8 minutes')
     ON CONFLICT (id) DO NOTHING`,
  );

  /* Referrals */
  await query(
    `INSERT INTO referrals (id, referrer_id, referred_id, code, status, reward_cents, created_at, qualified_at)
     VALUES ('ref_seed_01',$1,$2,'UBREF000001','REWARDED',500, now() - interval '58 days', now() - interval '57 days')
     ON CONFLICT (id) DO NOTHING`,
    [userId("m01"), userId("m02")],
  );
  await query(
    `INSERT INTO referrals (id, referrer_id, referred_id, code, status, reward_cents, created_at, qualified_at)
     VALUES ('ref_seed_02',$1,$2,'UBREF000001','QUALIFIED',0, now() - interval '44 days', now() - interval '43 days')
     ON CONFLICT (id) DO NOTHING`,
    [userId("m01"), userId("m04")],
  );
  await query(
    `INSERT INTO referrals (id, referrer_id, referred_id, code, status, reward_cents, created_at)
     VALUES ('ref_seed_03',$1,$2,'UBREF000001','PENDING',0, now() - interval '38 days')
     ON CONFLICT (id) DO NOTHING`,
    [userId("m01"), userId("m05")],
  );
  await query(
    `INSERT INTO referrals (id, referrer_id, referred_id, code, status, reward_cents, created_at)
     VALUES ('ref_seed_04',$1,$2,'UBREF000003','PENDING',0, now() - interval '30 days')
     ON CONFLICT (id) DO NOTHING`,
    [userId("m03"), userId("m06")],
  );
  await query(
    `INSERT INTO wallet_transactions (id, reference, user_id, type, direction, amount_cents, status, description,
       related_type, related_id, idempotency_key, created_at)
     VALUES ('txn_seed_ref_01','TXN-${YEAR}-20050',$1,'REFERRAL_REWARD','CREDIT',500,'COMPLETED',
       'Demo referral reward — Daniel Whitfield activated membership','referral','ref_seed_01','referral:ref_seed_01', now() - interval '57 days')
     ON CONFLICT (id) DO NOTHING`,
    [userId("m01")],
  );
  await query(
    `INSERT INTO referral_rewards (id, referral_id, user_id, amount_cents, transaction_id, created_at)
     VALUES ('rrw_seed_01','ref_seed_01',$1,500,'txn_seed_ref_01', now() - interval '57 days') ON CONFLICT (referral_id) DO NOTHING`,
    [userId("m01")],
  );

  /* Withdrawals */
  const withdrawals = [
    { id: "wdr_seed_01", ref: `WD-${YEAR}-30001`, member: "m01", amount: 500, method: "BANK_TRANSFER", status: "PENDING", destination: "Demo account •••• 4821", days: 1, reason: null },
    { id: "wdr_seed_02", ref: `WD-${YEAR}-30002`, member: "m03", amount: 500, method: "BANK_TRANSFER", status: "APPROVED", destination: "Demo account •••• 7734", days: 9, reason: "Approved (simulated payout)" },
    { id: "wdr_seed_03", ref: `WD-${YEAR}-30003`, member: "m02", amount: 500, method: "OTHER", status: "REJECTED", destination: "Demo account •••• 2210", days: 12, reason: "Destination details incomplete (demo review)" },
    { id: "wdr_seed_04", ref: `WD-${YEAR}-30004`, member: "m04", amount: 300, method: "CRYPTO", status: "UNDER_REVIEW", destination: "Crypto — display only, no wallet connected", days: 2, reason: null },
  ];
  for (const [index, w] of withdrawals.entries()) {
    await query(
      `INSERT INTO withdrawal_requests (id, reference, user_id, amount_cents, method, destination_masked, status,
         decided_by, decision_reason, decided_at, created_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11)
       ON CONFLICT (id) DO NOTHING`,
      [w.id, w.ref, userId(w.member), w.amount, w.method, w.destination, w.status,
        w.status === "PENDING" || w.status === "UNDER_REVIEW" ? null : userId("fin"),
        w.reason, daysAgo(w.days),
        w.status === "APPROVED" ? daysAgo(w.days - 1) : null],
    );
    await query(
      `INSERT INTO wallet_transactions (id, reference, user_id, type, direction, amount_cents, status, description,
         related_type, related_id, idempotency_key, created_by, created_at)
       VALUES ($1,$2,$3,'WITHDRAWAL_REQUEST','DEBIT',$4,$5,$6,'withdrawal',$7,$8,$9,$10)
       ON CONFLICT (id) DO NOTHING`,
      [`txn_seed_wd_${index + 1}`, `TXN-${YEAR}-2006${index}`, userId(w.member), w.amount,
        w.status === "PENDING" || w.status === "UNDER_REVIEW" ? "PENDING" : "COMPLETED",
        `Withdrawal request ${w.ref} (demo)`, w.id, `withdrawal:${w.id}`,
        w.status === "PENDING" || w.status === "UNDER_REVIEW" ? null : userId("fin"), daysAgo(w.days)],
    );
    if (w.status === "REJECTED") {
      await query(
        `INSERT INTO wallet_transactions (id, reference, user_id, type, direction, amount_cents, status, description,
           related_type, related_id, idempotency_key, created_by, created_at)
         VALUES ($1,$2,$3,'WITHDRAWAL_REJECTION','CREDIT',$4,'COMPLETED',$5,'withdrawal',$6,$7,$8,$9)
         ON CONFLICT (id) DO NOTHING`,
        [`txn_seed_wdr_${index + 1}`, `TXN-${YEAR}-2007${index}`, userId(w.member), w.amount,
          `Withdrawal rejected — reserved demo balance released: ${w.reason}`, w.id, `withdrawal-release:${w.id}`,
          userId("fin"), daysAgo(w.days - 1)],
      );
    }
  }

  /* Notifications */
  const notifications = [
    { id: "ntf_seed_01", member: "m01", type: "WITHDRAWAL", title: "Withdrawal request submitted", body: "Your DEMO withdrawal request WD-30001 is pending finance review.", link: "/dashboard/withdrawals", days: 1, read: false },
    { id: "ntf_seed_02", member: "m01", type: "REWARD", title: "Demo reward credited", body: "You completed \"Spaces that breathe\". A demo reward was added to your wallet.", link: "/dashboard/wallet", days: 7, read: true },
    { id: "ntf_seed_03", member: "m02", type: "MEMBERSHIP", title: "Membership activated", body: "Your DEMO membership is active.", link: "/dashboard/membership", days: 57, read: true },
    { id: "ntf_seed_04", member: "m03", type: "WITHDRAWAL", title: "Withdrawal approved (demo)", body: "Your demo withdrawal WD-30002 was approved. No real funds were sent.", link: "/dashboard/withdrawals", days: 8, read: true },
    { id: "ntf_seed_05", member: "m05", type: "REFERRAL", title: "Referral pending", body: "Your invited member has registered. Rewards unlock after eligibility requirements are met.", link: "/dashboard/referrals", days: 38, read: true },
    { id: "ntf_seed_06", member: "m07", type: "SYSTEM", title: "Session flagged for review", body: "One of your viewing sessions is being reviewed by moderation. No reward was issued.", link: "/dashboard/ad-history", days: 2, read: false },
    { id: "ntf_seed_07", member: "m09", type: "MEMBERSHIP", title: "Complete your membership", body: "Activate your DEMO membership to unlock campaigns and rewards.", link: "/dashboard/membership", days: 6, read: false },
    { id: "ntf_seed_08", member: "m01", type: "CAMPAIGN", title: "New campaign available", body: "Future Mobility Launch is now live for eligible members.", link: "/dashboard/campaigns", days: 20, read: true },
  ];
  for (const n of notifications) {
    await query(
      `INSERT INTO notifications (id, user_id, type, title, body, link, read_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [n.id, userId(n.member), n.type, n.title, n.body, n.link, n.read ? daysAgo(n.days - 1) : null, daysAgo(n.days)],
    );
  }

  /* Support tickets */
  const tickets = [
    { id: "tkt_seed_01", ref: `SUP-${YEAR}-40001`, member: "m02", category: "Membership", subject: "Membership activation receipt", status: "IN_PROGRESS", priority: "NORMAL", days: 5, messages: [{ author: "m02", body: "Could you confirm my membership activation date for my records?", internal: false, days: 5 }, { author: "sup", body: "Your membership was activated on the date shown under My Membership. I have also attached the payment reference in your dashboard (demo).", internal: false, days: 4 }] },
    { id: "tkt_seed_02", ref: `SUP-${YEAR}-40002`, member: "m04", category: "Withdrawals", subject: "Withdrawal under review", status: "WAITING_FOR_MEMBER", priority: "HIGH", days: 2, messages: [{ author: "m04", body: "My demo withdrawal has been under review for a day. Is anything else needed?", internal: false, days: 2 }, { author: "sup", body: "Thanks for checking in. For this demonstration, crypto payouts are display-only. Please confirm whether you would prefer the bank transfer option.", internal: false, days: 1 }, { author: "sup", body: "Finance note: do not process crypto payouts; keep simulated.", internal: true, days: 1 }] },
    { id: "tkt_seed_03", ref: `SUP-${YEAR}-40003`, member: "m03", category: "Advertisements", subject: "Video paused when switching tabs", status: "RESOLVED", priority: "NORMAL", days: 9, messages: [{ author: "m03", body: "The advertisement paused when I switched tabs. Is that expected?", internal: false, days: 9 }, { author: "sup", body: "Yes. Sessions pause when the page is hidden so that completion time is measured on the server. You can resume from where you left off.", internal: false, days: 8 }] },
  ];
  for (const t of tickets) {
    await query(
      `INSERT INTO support_tickets (id, reference, user_id, category, subject, status, priority, assigned_to, created_at, updated_at, closed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.ref, userId(t.member), t.category, t.subject, t.status, t.priority, userId("sup"),
        daysAgo(t.days), daysAgo(t.days - 1), t.status === "RESOLVED" ? daysAgo(t.days - 1) : null],
    );
    for (const [i, m] of t.messages.entries()) {
      await query(
        `INSERT INTO support_messages (id, ticket_id, author_id, body, is_internal, created_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [`msg_seed_${t.id}_${i}`, t.id, userId(m.author), m.body, m.internal, daysAgo(m.days)],
      );
    }
  }

  /* Admin notes + contact message */
  await query(
    `INSERT INTO admin_notes (id, subject_user_id, author_id, body, created_at)
     VALUES ('note_seed_01',$1,$2,'Flagged viewing session reviewed. Member contacted; no prior flags on the account.', now() - interval '1 day')
     ON CONFLICT (id) DO NOTHING`,
    [userId("m07"), userId("mod")],
  );
  await query(
    `INSERT INTO contact_messages (id, name, email, subject, message, status, created_at)
     VALUES ('cnt_seed_01','Rebecca Long','rebecca.long@example.demo','Partnership enquiry','I would like to learn more about advertising placements on the platform. This is a demonstration enquiry.', 'NEW', now() - interval '3 days')
     ON CONFLICT (id) DO NOTHING`,
  );

  /* Audit trail */
  const audits = [
    { action: "membership.activated", target: "usr_seed_m01", label: "system:demo-payment", days: 63 },
    { action: "campaign.created", target: "cmp_seed_01", label: "superadmin@umarbaig.demo", days: 42 },
    { action: "advertisement.created", target: "adv_seed_01", label: "superadmin@umarbaig.demo", days: 35 },
    { action: "withdrawal.approved", target: "wdr_seed_02", label: "finance@umarbaig.demo", days: 8 },
    { action: "withdrawal.rejected", target: "wdr_seed_03", label: "finance@umarbaig.demo", days: 11 },
    { action: "moderation.confirmed", target: "ads_seed_flagged", label: "moderator@umarbaig.demo", days: 1 },
    { action: "settings.updated", target: "platform_settings", label: "superadmin@umarbaig.demo", days: 15 },
    { action: "staff.role_changed", target: "usr_seed_fin", label: "superadmin@umarbaig.demo", days: 30 },
  ];
  for (const [i, a] of audits.entries()) {
    await query(
      `INSERT INTO audit_logs (id, actor_label, action, target_type, target_id, metadata, created_at)
       VALUES ($1,$2,$3,'seed',$4,'{"seeded":true}'::jsonb,$5) ON CONFLICT (id) DO NOTHING`,
      [`aud_seed_${i + 1}`, a.label, a.action, a.target, daysAgo(a.days)],
    );
  }

  /* Recompute wallet projections from the immutable ledger */
  await query(`
    UPDATE wallets w SET
      available_cents = COALESCE((
        SELECT SUM(CASE WHEN t.direction = 'CREDIT' THEN t.amount_cents ELSE -t.amount_cents END)
          FROM wallet_transactions t WHERE t.user_id = w.user_id AND t.status <> 'REVERSED'), 0),
      pending_cents = COALESCE((
        SELECT SUM(t.amount_cents) FROM wallet_transactions t
         WHERE t.user_id = w.user_id AND t.type = 'WITHDRAWAL_REQUEST' AND t.status = 'PENDING'), 0),
      lifetime_credit_cents = COALESCE((
        SELECT SUM(t.amount_cents) FROM wallet_transactions t
         WHERE t.user_id = w.user_id AND t.direction = 'CREDIT'), 0),
      lifetime_debit_cents = COALESCE((
        SELECT SUM(t.amount_cents) FROM wallet_transactions t
         WHERE t.user_id = w.user_id AND t.direction = 'DEBIT' AND t.status <> 'REVERSED'), 0),
      updated_at = now()
  `);

  await query(`
    WITH running AS (
      SELECT id,
             SUM(CASE WHEN direction = 'CREDIT' THEN amount_cents ELSE -amount_cents END)
               OVER (PARTITION BY user_id ORDER BY created_at, id) AS balance
        FROM wallet_transactions WHERE status <> 'REVERSED'
    )
    UPDATE wallet_transactions t SET balance_after_cents = GREATEST(running.balance, 0)
      FROM running WHERE t.id = running.id
  `);

  /* Never move sequences backwards, even if the seed is rerun after new sign-ups */
  await query(`SELECT setval('member_id_seq', GREATEST((SELECT last_value FROM member_id_seq), 100))`);
  await query(`SELECT setval('referral_code_seq', GREATEST((SELECT last_value FROM referral_code_seq), 100))`);
  await query(`SELECT setval('invoice_seq', GREATEST((SELECT last_value FROM invoice_seq), 5000))`);

  const counts = await query<{ users: number; ads: number; sessions: number; withdrawals: number }>(
    `SELECT (SELECT count(*) FROM users)::int AS users,
            (SELECT count(*) FROM advertisements)::int AS ads,
            (SELECT count(*) FROM ad_sessions)::int AS sessions,
            (SELECT count(*) FROM withdrawal_requests)::int AS withdrawals`,
  );
  console.log(`[seed] complete — ${counts[0].users} users, ${counts[0].ads} advertisements, ${counts[0].sessions} sessions, ${counts[0].withdrawals} withdrawals`);
  return counts[0];
}

export const DEMO_CREDENTIALS = {
  member: { email: "ayesha.khan@umarbaig.demo", password: MEMBER_PASSWORD },
  superAdmin: { email: "superadmin@umarbaig.demo", password: STAFF_PASSWORD },
  financeAdmin: { email: "finance@umarbaig.demo", password: STAFF_PASSWORD },
  supportAdmin: { email: "support@umarbaig.demo", password: STAFF_PASSWORD },
  moderator: { email: "moderator@umarbaig.demo", password: STAFF_PASSWORD },
};
