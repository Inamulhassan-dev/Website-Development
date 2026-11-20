"use server";

import { z } from "zod";
import { newId, nextSequence, one, query, tx } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notifications";
import { getSettings, setSetting, type Settings } from "@/lib/settings";
import { creditWallet, adminAdjustment } from "@/lib/services/wallet";
import { decideWithdrawal } from "@/lib/services/withdrawals";
import { qualifyReferral } from "@/lib/services/referrals";
import { rateLimit } from "@/lib/rate-limit";
import { requireAdminAction } from "./admin-guard";
import { done, fail, formBool, formDate, formInt, formMoneyToCents, formString, friendlyDbError } from "./helpers";
import { isStaffRole, ROLES, type StaffRole } from "@/lib/constants";

const back = (path: string, err: unknown, fallback: string): never =>
  fail(fallback, err instanceof Error ? err.message : "The action could not be completed.");

/* --------------------------------- Users -------------------------------- */

export async function updateUserStatusAction(formData: FormData) {
  const admin = await requireAdminAction("users.manage");
  const userId = formString(formData, "userId", 80);
  const status = formString(formData, "status", 30);
  const reason = formString(formData, "reason", 500);
  if (!["ACTIVE", "SUSPENDED", "BLOCKED", "DEACTIVATED", "PENDING_ACTIVATION"].includes(status)) {
    fail(`/admin/users/${userId}`, "Invalid account status.");
  }
  if (userId === admin.id) fail(`/admin/users/${userId}`, "You cannot change your own account status.");
  const target = await one<{ id: string; role: string; full_name: string }>(`SELECT id, role, full_name FROM users WHERE id = $1`, [userId]);
  if (!target) fail("/admin/users", "Member not found.");
  if (["SUSPENDED", "BLOCKED", "DEACTIVATED"].includes(status) && reason.length < 4) {
    fail(`/admin/users/${userId}`, "A reason is required for this status change.");
  }
  if (target.role === "SUPER_ADMIN") {
    const supers = await one<{ count: number }>(
      `SELECT count(*)::int AS count FROM users WHERE role = 'SUPER_ADMIN' AND account_status = 'ACTIVE'`,
    );
    if (Number(supers?.count ?? 0) <= 1 && status !== "ACTIVE") {
      fail(`/admin/users/${userId}`, "At least one active Super Admin must remain.");
    }
  }
  await tx(async (client) => {
    await client.query(
      `UPDATE users SET account_status = $2, status_reason = $3, updated_at = now(),
              suspended_at = CASE WHEN $2 IN ('SUSPENDED','BLOCKED') THEN now() ELSE suspended_at END
        WHERE id = $1`,
      [userId, status, reason || null],
    );
    if (["SUSPENDED", "BLOCKED", "DEACTIVATED"].includes(status)) {
      await client.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    }
    await notify(
      {
        userId,
        type: "ACCOUNT",
        title: `Account status: ${status.replaceAll("_", " ").toLowerCase()}`,
        body: reason ? `An administrator updated your account. Reason: ${reason}` : "An administrator updated your account status.",
        link: "/dashboard",
      },
      client,
    );
  });
  await audit({ actor: admin, action: `user.status.${status.toLowerCase()}`, targetType: "user", targetId: userId, reason });
  done(`/admin/users/${userId}`, `Account status updated to ${status.replaceAll("_", " ").toLowerCase()}.`);
}

export async function addAdminNoteAction(formData: FormData) {
  const admin = await requireAdminAction("users.view");
  const userId = formString(formData, "userId", 80);
  const body = formString(formData, "body", 2000);
  if (body.length < 3) fail(`/admin/users/${userId}`, "Write a note first.");
  await query(`INSERT INTO admin_notes (id, subject_user_id, author_id, body) VALUES ($1,$2,$3,$4)`, [
    newId("note"),
    userId,
    admin.id,
    body,
  ]);
  await audit({ actor: admin, action: "user.note_added", targetType: "user", targetId: userId });
  done(`/admin/users/${userId}`, "Internal note saved.");
}

export async function adjustWalletAction(formData: FormData) {
  const admin = await requireAdminAction("wallet.adjust");
  const userId = formString(formData, "userId", 80);
  const amountCents = formMoneyToCents(formData, "amount");
  const direction = formString(formData, "direction", 10) === "DEBIT" ? "DEBIT" : "CREDIT";
  const reason = formString(formData, "reason", 300);
  if (amountCents <= 0) fail(`/admin/users/${userId}`, "Enter a valid adjustment amount.");
  if (reason.length < 5) fail(`/admin/users/${userId}`, "A clear reason is required for ledger adjustments.");
  try {
    const result = await adminAdjustment({ userId, amountCents, direction, reason, adminId: admin.id });
    await notify({
      userId,
      type: "WALLET",
      title: "Demo wallet adjusted",
      body: `An administrator ${direction === "CREDIT" ? "credited" : "debited"} your demo wallet. Reason: ${reason}`,
      link: "/dashboard/transactions",
    });
    await audit({
      actor: admin,
      action: `wallet.adjustment.${direction.toLowerCase()}`,
      targetType: "user",
      targetId: userId,
      reason,
      metadata: { amountCents, reference: result.reference },
    });
    done(`/admin/users/${userId}`, "Ledger adjustment recorded.");
  } catch (err) {
    back(`/admin/users/${userId}`, err, `/admin/users/${userId}`);
  }
}

export async function grantBundleAction(formData: FormData) {
  const admin = await requireAdminAction("bundles.manage");
  const userId = formString(formData, "userId", 80);
  const bundleId = formString(formData, "bundleId", 80);
  const action = formString(formData, "action", 20);
  if (action === "REVOKE") {
    await query(`DELETE FROM member_bundles WHERE user_id = $1 AND bundle_id = $2`, [userId, bundleId]);
    await audit({ actor: admin, action: "bundle.access_revoked", targetType: "user", targetId: userId, metadata: { bundleId } });
    done(`/admin/users/${userId}`, "Bundle access revoked.");
  }
  await query(
    `INSERT INTO member_bundles (user_id, bundle_id, granted_by) VALUES ($1,$2,$3)
     ON CONFLICT (user_id, bundle_id) DO NOTHING`,
    [userId, bundleId, admin.id],
  );
  await audit({ actor: admin, action: "bundle.access_granted", targetType: "user", targetId: userId, metadata: { bundleId } });
  done(`/admin/users/${userId}`, "Bundle access granted.");
}

export async function sendMemberNotificationAction(formData: FormData) {
  const admin = await requireAdminAction("users.notify");
  const userId = formString(formData, "userId", 80);
  const title = formString(formData, "title", 120);
  const body = formString(formData, "body", 1000);
  if (title.length < 3 || body.length < 3) fail(`/admin/users/${userId}`, "Add a title and message.");
  await notify({ userId, type: "ANNOUNCEMENT", title, body, link: "/dashboard/notifications" });
  await audit({ actor: admin, action: "notification.sent", targetType: "user", targetId: userId, metadata: { title } });
  done(`/admin/users/${userId}`, "Notification sent.");
}

/* ------------------------------ Membership ------------------------------ */

export async function updateMembershipPlanAction(formData: FormData) {
  const admin = await requireAdminAction("memberships.manage");
  const id = formString(formData, "planId", 80);
  const name = formString(formData, "name", 120);
  const description = formString(formData, "description", 1000);
  const priceCents = formMoneyToCents(formData, "price");
  const benefits = formString(formData, "benefits", 2000)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);
  const requirements = formString(formData, "requirements", 1000);
  const isActive = formBool(formData, "isActive");
  if (name.length < 3) fail("/admin/settings", "Membership name is too short.");
  if (priceCents < 0 || priceCents > 100000000) fail("/admin/settings", "Enter a valid membership fee.");
  await query(
    `UPDATE membership_plans SET name = $2, description = $3, price_cents = $4, benefits = $5::jsonb,
            activation_requirements = $6, is_active = $7, updated_at = now() WHERE id = $1`,
    [id, name, description, priceCents, JSON.stringify(benefits), requirements, isActive],
  );
  await audit({
    actor: admin,
    action: "membership.plan_updated",
    targetType: "membership_plan",
    targetId: id,
    metadata: { priceCents, isActive },
  });
  done("/admin/settings", "Membership settings updated.");
}

export async function recordManualActivationAction(formData: FormData) {
  const admin = await requireAdminAction("memberships.manage");
  const userId = formString(formData, "userId", 80);
  const reason = formString(formData, "reason", 500);
  if (reason.length < 8) fail("/admin/memberships", "A detailed reason is required for a manual activation.");
  const plan = await one<{ id: string; price_cents: number; currency: string }>(
    `SELECT id, price_cents, currency FROM membership_plans WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1`,
  );
  const user = await one<{ id: string; full_name: string; account_status: string }>(`SELECT id, full_name, account_status FROM users WHERE id = $1`, [userId]);
  if (!plan || !user) fail("/admin/memberships", "Member or membership plan not found.");
  if (user.account_status === "BLOCKED") fail("/admin/memberships", "Blocked accounts cannot be activated.");
  const payRef = await (await import("@/lib/services/wallet")).reference("PAY");
  await tx(async (client) => {
    await client.query(
      `INSERT INTO membership_payments (id, reference, user_id, plan_id, amount_cents, currency, method, status, paid_at, failure_reason)
       VALUES ($1,$2,$3,$4,$5,$6,'ADMIN_RECORDED','SUCCESS', now(), $7)`,
      [newId("pay"), payRef, userId, plan.id, plan.price_cents, plan.currency, `Manual activation by ${admin.email}: ${reason}`],
    );
    await client.query(
      `INSERT INTO memberships (id, user_id, plan_id, status, activated_at) VALUES ($1,$2,$3,'ACTIVE', now())
       ON CONFLICT (user_id) DO UPDATE SET status = 'ACTIVE', activated_at = now(), updated_at = now()`,
      [newId("mem"), userId, plan.id],
    );
    await client.query(
      `UPDATE users SET account_status = 'ACTIVE', activated_at = COALESCE(activated_at, now()), updated_at = now() WHERE id = $1`,
      [userId],
    );
    await notify(
      {
        userId,
        type: "MEMBERSHIP",
        title: "Membership activated (administrative)",
        body: `An administrator activated your membership. Reference ${payRef}. Reason: ${reason}`,
        link: "/dashboard/membership",
      },
      client,
    );
  });
  await qualifyReferral(userId).catch(() => undefined);
  await audit({
    actor: admin,
    action: "membership.manual_activation",
    targetType: "user",
    targetId: userId,
    reason,
    metadata: { reference: payRef, simulated: true },
  });
  done("/admin/memberships", `Membership activated for ${user.full_name}. Recorded with reference ${payRef}.`);
}

/* ------------------------------- Campaigns ------------------------------ */

const campaignSchema = z.object({
  name: z.string().min(3).max(140),
  advertiser: z.string().min(2).max(140),
  description: z.string().max(3000),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalAllocation: z.number().int().min(0).max(1000000),
  rewardCents: z.number().int().min(0).max(1000000),
  terms: z.string().max(4000),
});

export async function createCampaignAction(formData: FormData) {
  const admin = await requireAdminAction("campaigns.manage");
  const parsed = campaignSchema.safeParse({
    name: formString(formData, "name", 140),
    advertiser: formString(formData, "advertiser", 140),
    description: formString(formData, "description", 3000),
    startDate: formDate(formData, "startDate"),
    endDate: formDate(formData, "endDate"),
    totalAllocation: formInt(formData, "totalAllocation"),
    rewardCents: formMoneyToCents(formData, "reward"),
    terms: formString(formData, "terms", 4000),
  });
  if (!parsed.success) fail("/admin/campaigns", parsed.error.issues[0]?.message ?? "Check the campaign details.");
  if (parsed.data.endDate < parsed.data.startDate) fail("/admin/campaigns", "End date must be after the start date.");
  const seq = await nextSequence("invoice_seq");
  const code = `CMP-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
  const id = newId("cmp");
  await query(
    `INSERT INTO campaigns (id, code, name, description, advertiser_name, start_date, end_date, status,
       total_ad_allocation, default_reward_cents, terms, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'DRAFT',$8,$9,$10,$11)`,
    [id, code, parsed.data.name, parsed.data.description, parsed.data.advertiser, parsed.data.startDate,
      parsed.data.endDate, parsed.data.totalAllocation, parsed.data.rewardCents, parsed.data.terms, admin.id],
  );
  await audit({ actor: admin, action: "campaign.created", targetType: "campaign", targetId: id, metadata: { code } });
  done(`/admin/campaigns/${id}`, `Campaign ${code} created as draft.`);
}

export async function updateCampaignAction(formData: FormData) {
  const admin = await requireAdminAction("campaigns.manage");
  const id = formString(formData, "campaignId", 80);
  const parsed = campaignSchema.safeParse({
    name: formString(formData, "name", 140),
    advertiser: formString(formData, "advertiser", 140),
    description: formString(formData, "description", 3000),
    startDate: formDate(formData, "startDate"),
    endDate: formDate(formData, "endDate"),
    totalAllocation: formInt(formData, "totalAllocation"),
    rewardCents: formMoneyToCents(formData, "reward"),
    terms: formString(formData, "terms", 4000),
  });
  if (!parsed.success) fail(`/admin/campaigns/${id}`, parsed.error.issues[0]?.message ?? "Check the campaign details.");
  if (parsed.data.endDate < parsed.data.startDate) fail(`/admin/campaigns/${id}`, "End date must be after the start date.");
  await query(
    `UPDATE campaigns SET name = $2, description = $3, advertiser_name = $4, start_date = $5, end_date = $6,
            total_ad_allocation = $7, default_reward_cents = $8, terms = $9, updated_at = now() WHERE id = $1`,
    [id, parsed.data.name, parsed.data.description, parsed.data.advertiser, parsed.data.startDate, parsed.data.endDate,
      parsed.data.totalAllocation, parsed.data.rewardCents, parsed.data.terms],
  );
  await audit({ actor: admin, action: "campaign.updated", targetType: "campaign", targetId: id });
  done(`/admin/campaigns/${id}`, "Campaign updated.");
}

export async function setCampaignStatusAction(formData: FormData) {
  const admin = await requireAdminAction("campaigns.manage");
  const id = formString(formData, "campaignId", 80);
  const status = formString(formData, "status", 20);
  if (!["DRAFT", "SCHEDULED", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"].includes(status)) {
    fail(`/admin/campaigns/${id}`, "Invalid campaign status.");
  }
  const row = await one<{ status: string; name: string }>(`SELECT status, name FROM campaigns WHERE id = $1`, [id]);
  if (!row) fail("/admin/campaigns", "Campaign not found.");
  if (row.status === "ARCHIVED" && status !== "ARCHIVED") {
    fail(`/admin/campaigns/${id}`, "Archived campaigns are read-only and cannot be reactivated.");
  }
  await query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
  await audit({ actor: admin, action: `campaign.${status.toLowerCase()}`, targetType: "campaign", targetId: id });
  done(`/admin/campaigns/${id}`, `Campaign marked ${status.toLowerCase()}.`);
}

/* ----------------------------- Advertisements --------------------------- */

const adSchema = z.object({
  title: z.string().min(3).max(160),
  advertiser: z.string().min(2).max(140),
  description: z.string().max(3000),
  campaignId: z.string().min(1),
  videoUrl: z.string().min(4).max(1000),
  thumbnailUrl: z.string().max(1000),
  durationSeconds: z.number().int().min(3).max(3600),
  rewardCents: z.number().int().min(0).max(100000),
  requiredWatchSeconds: z.number().int().min(3).max(3600),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  displayOrder: z.number().int().min(0).max(1000),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]),
});

function readAdForm(formData: FormData) {
  return {
    title: formString(formData, "title", 160),
    advertiser: formString(formData, "advertiser", 140),
    description: formString(formData, "description", 3000),
    campaignId: formString(formData, "campaignId", 80),
    videoUrl: formString(formData, "videoUrl", 1000),
    thumbnailUrl: formString(formData, "thumbnailUrl", 1000),
    durationSeconds: formInt(formData, "durationSeconds"),
    rewardCents: formMoneyToCents(formData, "reward"),
    requiredWatchSeconds: formInt(formData, "requiredWatchSeconds"),
    startDate: formDate(formData, "startDate"),
    endDate: formDate(formData, "endDate"),
    displayOrder: formInt(formData, "displayOrder"),
    status: formString(formData, "status", 20) as "DRAFT" | "ACTIVE" | "PAUSED",
  };
}

function validateAd(data: z.infer<typeof adSchema>) {
  if (data.endDate < data.startDate) throw new Error("End date must be after the start date.");
  if (data.requiredWatchSeconds > data.durationSeconds) throw new Error("Required watch time cannot exceed the video duration.");
  if (!/^(https?:\/\/|\/api\/media\/)/.test(data.videoUrl)) throw new Error("Video URL must be an https URL or an uploaded media path.");
  if (data.thumbnailUrl && !/^(https?:\/\/|\/api\/media\/)/.test(data.thumbnailUrl)) throw new Error("Thumbnail URL is invalid.");
}

export async function createAdvertisementAction(formData: FormData) {
  const admin = await requireAdminAction("ads.manage");
  const parsed = adSchema.safeParse(readAdForm(formData));
  if (!parsed.success) fail("/admin/advertisements/new", parsed.error.issues[0]?.message ?? "Check the advertisement details.");
  try {
    validateAd(parsed.data);
  } catch (err) {
    back("", err, "/admin/advertisements/new");
  }
  const campaign = await one<{ status: string; name: string }>(`SELECT status, name FROM campaigns WHERE id = $1`, [parsed.data.campaignId]);
  if (!campaign) fail("/admin/advertisements/new", "Select a valid campaign.");
  if (campaign.status === "ARCHIVED") fail("/admin/advertisements/new", "Archived campaigns cannot receive new advertisements.");
  const seq = await nextSequence("invoice_seq");
  const code = `ADV-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
  const id = newId("adv");
  await tx(async (client) => {
    await client.query(
      `INSERT INTO advertisements (id, code, title, description, advertiser_name, campaign_id, video_url, thumbnail_url,
         duration_seconds, reward_cents, required_watch_seconds, start_date, end_date, status, display_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [id, code, parsed.data.title, parsed.data.description, parsed.data.advertiser, parsed.data.campaignId,
        parsed.data.videoUrl, parsed.data.thumbnailUrl || null, parsed.data.durationSeconds, parsed.data.rewardCents,
        parsed.data.requiredWatchSeconds, parsed.data.startDate, parsed.data.endDate, parsed.data.status, parsed.data.displayOrder],
    );
    const bundles = formData.getAll("bundleIds").map(String).filter(Boolean);
    for (const bundleId of bundles) {
      await client.query(
        `INSERT INTO bundle_advertisements (bundle_id, advertisement_id, display_order) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [bundleId, id, parsed.data.displayOrder],
      );
    }
  });
  await audit({ actor: admin, action: "advertisement.created", targetType: "advertisement", targetId: id, metadata: { code } });
  done("/admin/advertisements", `Advertisement ${code} created.`);
}

export async function updateAdvertisementAction(formData: FormData) {
  const admin = await requireAdminAction("ads.manage");
  const id = formString(formData, "advertisementId", 80);
  const parsed = adSchema.safeParse(readAdForm(formData));
  if (!parsed.success) fail(`/admin/advertisements/${id}`, parsed.error.issues[0]?.message ?? "Check the advertisement details.");
  try {
    validateAd(parsed.data);
  } catch (err) {
    back("", err, `/admin/advertisements/${id}`);
  }
  await tx(async (client) => {
    await client.query(
      `UPDATE advertisements SET title = $2, description = $3, advertiser_name = $4, campaign_id = $5, video_url = $6,
              thumbnail_url = $7, duration_seconds = $8, reward_cents = $9, required_watch_seconds = $10,
              start_date = $11, end_date = $12, status = $13, display_order = $14, updated_at = now()
        WHERE id = $1`,
      [id, parsed.data.title, parsed.data.description, parsed.data.advertiser, parsed.data.campaignId,
        parsed.data.videoUrl, parsed.data.thumbnailUrl || null, parsed.data.durationSeconds, parsed.data.rewardCents,
        parsed.data.requiredWatchSeconds, parsed.data.startDate, parsed.data.endDate, parsed.data.status, parsed.data.displayOrder],
    );
    const bundles = formData.getAll("bundleIds").map(String).filter(Boolean);
    await client.query(`DELETE FROM bundle_advertisements WHERE advertisement_id = $1`, [id]);
    for (const bundleId of bundles) {
      await client.query(
        `INSERT INTO bundle_advertisements (bundle_id, advertisement_id, display_order) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [bundleId, id, parsed.data.displayOrder],
      );
    }
  });
  await audit({ actor: admin, action: "advertisement.updated", targetType: "advertisement", targetId: id });
  done(`/admin/advertisements/${id}`, "Advertisement updated.");
}

export async function setAdvertisementStatusAction(formData: FormData) {
  const admin = await requireAdminAction("ads.manage");
  const id = formString(formData, "advertisementId", 80);
  const status = formString(formData, "status", 20);
  if (!["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"].includes(status)) fail("/admin/advertisements", "Invalid advertisement status.");
  const row = await one<{ status: string }>(`SELECT status FROM advertisements WHERE id = $1`, [id]);
  if (!row) fail("/admin/advertisements", "Advertisement not found.");
  if (row.status === "ARCHIVED" && status !== "ARCHIVED") {
    fail("/admin/advertisements", "Archived advertisements cannot be reactivated.");
  }
  await query(
    `UPDATE advertisements SET status = $2, archived_at = CASE WHEN $2 = 'ARCHIVED' THEN now() ELSE archived_at END, updated_at = now()
      WHERE id = $1`,
    [id, status],
  );
  await audit({ actor: admin, action: `advertisement.${status.toLowerCase()}`, targetType: "advertisement", targetId: id });
  done("/admin/advertisements", `Advertisement marked ${status.toLowerCase()}.`);
}

export async function deleteAdvertisementAction(formData: FormData) {
  const admin = await requireAdminAction("ads.manage");
  const id = formString(formData, "advertisementId", 80);
  const used = await one<{ count: number }>(`SELECT count(*)::int AS count FROM ad_sessions WHERE advertisement_id = $1`, [id]);
  if (Number(used?.count ?? 0) > 0) {
    fail("/admin/advertisements", "This advertisement has viewing history and cannot be deleted. Archive it instead.");
  }
  await tx(async (client) => {
    await client.query(`DELETE FROM bundle_advertisements WHERE advertisement_id = $1`, [id]);
    await client.query(`DELETE FROM advertisements WHERE id = $1`, [id]);
  });
  await audit({ actor: admin, action: "advertisement.deleted", targetType: "advertisement", targetId: id });
  done("/admin/advertisements", "Advertisement deleted.");
}

/* -------------------------------- Bundles ------------------------------- */

export async function saveBundleAction(formData: FormData) {
  const admin = await requireAdminAction("bundles.manage");
  let id = formString(formData, "bundleId", 80);
  const name = formString(formData, "name", 120);
  const description = formString(formData, "description", 500);
  const adCount = formInt(formData, "adCount");
  const status = formString(formData, "status", 20) === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const eligibility = formString(formData, "eligibility", 30) === "RESTRICTED" ? "RESTRICTED" : "ALL_MEMBERS";
  const displayOrder = formInt(formData, "displayOrder");
  if (name.length < 2) fail("/admin/bundles", "Bundle name is required.");
  if (adCount < 1 || adCount > 500) fail("/admin/bundles", "Advertisement count must be between 1 and 500.");
  const adIds = formData.getAll("adIds").map(String).filter(Boolean);
  await tx(async (client) => {
    if (id) {
      await client.query(
        `UPDATE bundles SET name = $2, description = $3, ad_count = $4, status = $5, eligibility = $6,
                display_order = $7, updated_at = now() WHERE id = $1`,
        [id, name, description, adCount, status, eligibility, displayOrder],
      );
      await client.query(`DELETE FROM bundle_advertisements WHERE bundle_id = $1`, [id]);
    } else {
      const seq = await nextSequence("invoice_seq");
      const bundleId = newId("bnd");
      await client.query(
        `INSERT INTO bundles (id, code, name, description, ad_count, status, eligibility, display_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [bundleId, `BND-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`, name, description, adCount, status, eligibility, displayOrder],
      );
      id = bundleId;
    }
    let order = 1;
    for (const adId of adIds) {
      await client.query(
        `INSERT INTO bundle_advertisements (bundle_id, advertisement_id, display_order) VALUES ($1,$2,$3)
         ON CONFLICT DO NOTHING`,
        [id, adId, order++],
      );
    }
  });
  await audit({ actor: admin, action: "bundle.saved", targetType: "bundle", targetId: id, metadata: { name, adCount } });
  done("/admin/bundles", "Bundle saved.");
}

/* ------------------------------ Withdrawals ----------------------------- */

export async function decideWithdrawalAction(formData: FormData) {
  const admin = await requireAdminAction("withdrawals.review");
  const withdrawalId = formString(formData, "withdrawalId", 80);
  const decision = formString(formData, "decision", 20) === "APPROVE" ? "APPROVE" : "REJECT";
  const reason = formString(formData, "reason", 500);
  if (decision === "REJECT" && reason.length < 4) fail("/admin/withdrawals", "A rejection reason is required.");
  try {
    await decideWithdrawal({ withdrawalId, adminId: admin.id, adminLabel: admin.email, decision, reason });
    done("/admin/withdrawals", decision === "APPROVE" ? "Demo withdrawal approved." : "Demo withdrawal rejected and balance released.");
  } catch (err) {
    back("", err, "/admin/withdrawals");
  }
}

/* -------------------------------- Support ------------------------------- */

export async function adminReplyTicketAction(formData: FormData) {
  const admin = await requireAdminAction("support.manage");
  const ticketId = formString(formData, "ticketId", 80);
  const body = formString(formData, "body", 4000);
  const internal = formBool(formData, "internal");
  const status = formString(formData, "status", 30);
  if (body.length < 2) fail(`/admin/support/${ticketId}`, "Write a reply first.");
  const ticket = await one<{ id: string; user_id: string; reference: string }>(
    `SELECT id, user_id, reference FROM support_tickets WHERE id = $1`,
    [ticketId],
  );
  if (!ticket) fail("/admin/support", "Ticket not found.");
  await tx(async (client) => {
    await client.query(`INSERT INTO support_messages (id, ticket_id, author_id, body, is_internal) VALUES ($1,$2,$3,$4,$5)`, [
      newId("msg"),
      ticketId,
      admin.id,
      body,
      internal,
    ]);
    if (status && ["OPEN", "IN_PROGRESS", "WAITING_FOR_MEMBER", "RESOLVED", "CLOSED"].includes(status)) {
      await client.query(`UPDATE support_tickets SET status = $2, updated_at = now(), closed_at = CASE WHEN $2 = 'CLOSED' THEN now() ELSE closed_at END WHERE id = $1`, [
        ticketId,
        status,
      ]);
    } else {
      await client.query(`UPDATE support_tickets SET updated_at = now() WHERE id = $1`, [ticketId]);
    }
    if (!internal) {
      await notify(
        {
          userId: ticket.user_id,
          type: "SUPPORT",
          title: `Support update · ${ticket.reference}`,
          body: body.slice(0, 240),
          link: `/dashboard/support/${ticketId}`,
        },
        client,
      );
    }
  });
  await audit({ actor: admin, action: internal ? "support.internal_note" : "support.reply_sent", targetType: "ticket", targetId: ticketId });
  done(`/admin/support/${ticketId}`, internal ? "Internal note saved (not visible to member)." : "Reply sent to member.");
}

export async function assignTicketAction(formData: FormData) {
  const admin = await requireAdminAction("support.manage");
  const ticketId = formString(formData, "ticketId", 80);
  const assignee = formString(formData, "assignedTo", 80);
  if (assignee) {
    const staff = await one<{ id: string; role: string }>(`SELECT id, role FROM users WHERE id = $1`, [assignee]);
    if (!staff || !isStaffRole(staff.role)) fail(`/admin/support/${ticketId}`, "Select a valid staff member.");
  }
  await query(`UPDATE support_tickets SET assigned_to = $2, updated_at = now() WHERE id = $1`, [ticketId, assignee || null]);
  await audit({ actor: admin, action: "support.ticket_assigned", targetType: "ticket", targetId: ticketId, metadata: { assignee } });
  done(`/admin/support/${ticketId}`, "Ticket assignment updated.");
}

/* ------------------------------- Moderation ----------------------------- */

export async function resolveFlaggedSessionAction(formData: FormData) {
  const admin = await requireAdminAction("moderation.manage");
  const sessionId = formString(formData, "sessionId", 80);
  const action = formString(formData, "resolution", 20);
  const note = formString(formData, "note", 500);
  if (!["CONFIRM", "DISMISS"].includes(action)) fail("/admin/moderation", "Select a resolution.");
  if (note.length < 4) fail("/admin/moderation", "Add a moderation note.");
  const session = await one<{ id: string; status: string; flag_reason: string | null }>(
    `SELECT id, status, flag_reason FROM ad_sessions WHERE id = $1`,
    [sessionId],
  );
  if (!session) fail("/admin/moderation", "Session not found.");
  if (!["FLAGGED", "INVALIDATED", "EXPIRED"].includes(session.status)) {
    fail("/admin/moderation", "Only flagged or invalid sessions need moderation.");
  }
  await query(
    `UPDATE ad_sessions SET status = $2, flag_reason = $3 WHERE id = $1`,
    [sessionId, action === "CONFIRM" ? "INVALIDATED" : "EXPIRED", `${session.flag_reason ?? "Flagged"} · Moderator: ${note}`],
  );
  await audit({
    actor: admin,
    action: action === "CONFIRM" ? "moderation.confirmed" : "moderation.dismissed",
    targetType: "ad_session",
    targetId: sessionId,
    reason: note,
  });
  done("/admin/moderation", action === "CONFIRM" ? "Session confirmed as invalid." : "Flag dismissed and session closed without reward.");
}

/* --------------------------------- Staff -------------------------------- */

export async function createStaffAction(formData: FormData) {
  const admin = await requireAdminAction("staff.manage");
  const fullName = formString(formData, "fullName", 120);
  const email = formString(formData, "email", 200).toLowerCase();
  const role = formString(formData, "role", 30) as StaffRole;
  const password = String(formData.get("password") ?? "");
  if (fullName.length < 3) fail("/admin/staff", "Enter the staff member's name.");
  if (!z.string().email().safeParse(email).success) fail("/admin/staff", "Enter a valid email address.");
  if (!ROLES.includes(role)) fail("/admin/staff", "Select a valid role.");
  if (password.length < 10 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    fail("/admin/staff", "Temporary password must be 10+ characters with upper case, lower case and a number.");
  }
  const exists = await one<{ id: string }>(`SELECT id FROM users WHERE lower(email) = lower($1)`, [email]);
  if (exists) fail("/admin/staff", "An account with this email already exists.");
  const seq = await nextSequence("member_id_seq");
  const refSeq = await nextSequence("referral_code_seq");
  const id = newId("usr");
  const memberId = `UB-${new Date().getFullYear()}-${String(seq).padStart(6, "0")}`;
  await tx(async (client) => {
    await client.query(
      `INSERT INTO users (id, member_id, full_name, email, mobile, password_hash, role, account_status, referral_code, activated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'ACTIVE',$8, now())`,
      [id, memberId, fullName, email, formString(formData, "mobile", 24) || "+1 555 0100", await hashPassword(password), role, `UBREF${String(refSeq).padStart(6, "0")}`],
    );
    await client.query(`INSERT INTO wallets (id, user_id) VALUES ($1,$2)`, [newId("wal"), id]);
  });
  await audit({ actor: admin, action: "staff.created", targetType: "user", targetId: id, metadata: { role, memberId } });
  done("/admin/staff", `Staff account created for ${fullName} (${role}).`);
}

export async function updateStaffRoleAction(formData: FormData) {
  const admin = await requireAdminAction("staff.manage");
  const userId = formString(formData, "userId", 80);
  const role = formString(formData, "role", 30) as StaffRole;
  if (!ROLES.includes(role)) fail("/admin/staff", "Select a valid role.");
  if (userId === admin.id) fail("/admin/staff", "You cannot change your own role.");
  const target = await one<{ role: string; account_status: string }>(`SELECT role, account_status FROM users WHERE id = $1`, [userId]);
  if (!target) fail("/admin/staff", "Staff account not found.");
  if (target.role === "SUPER_ADMIN" && role !== "SUPER_ADMIN") {
    const supers = await one<{ count: number }>(
      `SELECT count(*)::int AS count FROM users WHERE role = 'SUPER_ADMIN' AND account_status = 'ACTIVE'`,
    );
    if (Number(supers?.count ?? 0) <= 1) fail("/admin/staff", "At least one active Super Admin must remain.");
  }
  await query(`UPDATE users SET role = $2, updated_at = now() WHERE id = $1`, [userId, role]);
  await audit({ actor: admin, action: "staff.role_changed", targetType: "user", targetId: userId, metadata: { from: target.role, to: role } });
  done("/admin/staff", "Staff role updated.");
}

export async function setStaffStatusAction(formData: FormData) {
  const admin = await requireAdminAction("staff.manage");
  const userId = formString(formData, "userId", 80);
  const status = formString(formData, "status", 20);
  if (!["ACTIVE", "SUSPENDED", "BLOCKED"].includes(status)) fail("/admin/staff", "Invalid status.");
  if (userId === admin.id) fail("/admin/staff", "You cannot change your own status.");
  await tx(async (client) => {
    await client.query(`UPDATE users SET account_status = $2, updated_at = now() WHERE id = $1`, [userId, status]);
    if (status !== "ACTIVE") {
      await client.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
    }
  });
  await audit({ actor: admin, action: "staff.status_changed", targetType: "user", targetId: userId, metadata: { status } });
  done("/admin/staff", "Staff status updated.");
}

/* -------------------------------- Settings ------------------------------ */

export async function updateSettingsAction(formData: FormData) {
  const admin = await requireAdminAction("settings.manage");
  const current = await getSettings();
  const platformName = formString(formData, "platform_name", 80);
  const contactEmail = formString(formData, "contact_email", 200);
  const supportEmail = formString(formData, "support_email", 200);
  const minWithdrawal = formMoneyToCents(formData, "min_withdrawal");
  const maxWithdrawal = formMoneyToCents(formData, "max_withdrawal");
  const referralReward = formMoneyToCents(formData, "referral_reward");
  const defaultReward = formMoneyToCents(formData, "default_reward");
  const defaultWatch = formInt(formData, "default_required_watch_seconds");
  const currency = formString(formData, "currency", 3).toUpperCase();
  if (platformName.length < 2) fail("/admin/settings", "Platform name is required.");
  if (!z.string().email().safeParse(contactEmail).success || !z.string().email().safeParse(supportEmail).success) {
    fail("/admin/settings", "Enter valid contact and support email addresses.");
  }
  if (minWithdrawal <= 0 || maxWithdrawal <= minWithdrawal) fail("/admin/settings", "Maximum withdrawal must exceed the minimum.");
  if (referralReward < 0) fail("/admin/settings", "Referral reward cannot be negative.");
  if (defaultWatch < 3 || defaultWatch > 600) fail("/admin/settings", "Default watch duration must be between 3 and 600 seconds.");
  if (!/^[A-Z]{3}$/.test(currency)) fail("/admin/settings", "Currency must be a 3-letter ISO code.");

  const updates: Record<keyof Settings, unknown> = {
    platform_name: platformName,
    platform_tagline: formString(formData, "platform_tagline", 160) || current.platform_tagline,
    contact_email: contactEmail,
    support_email: supportEmail,
    support_phone: formString(formData, "support_phone", 40),
    currency,
    min_withdrawal_cents: minWithdrawal,
    max_withdrawal_cents: maxWithdrawal,
    referral_reward_cents: referralReward,
    referral_enabled: formBool(formData, "referral_enabled"),
    registration_open: formBool(formData, "registration_open"),
    maintenance_mode: formBool(formData, "maintenance_mode"),
    default_reward_cents: defaultReward,
    default_required_watch_seconds: defaultWatch,
    announcement_banner: formString(formData, "announcement_banner", 300),
    audit_retention_days: Math.max(90, formInt(formData, "audit_retention_days") || current.audit_retention_days),
  };
  for (const [key, value] of Object.entries(updates)) {
    await setSetting(key as keyof Settings, value, admin.id);
  }
  await audit({
    actor: admin,
    action: "settings.updated",
    targetType: "platform_settings",
    metadata: { keys: Object.keys(updates) },
  });
  done("/admin/settings", "Platform settings saved.");
}

export async function sendAnnouncementAction(formData: FormData) {
  const admin = await requireAdminAction("users.notify");
  const title = formString(formData, "title", 120);
  const body = formString(formData, "body", 1500);
  const audience = formString(formData, "audience", 30);
  if (title.length < 3 || body.length < 5) fail("/admin/dashboard", "Add an announcement title and message.");
  let where = "role = 'MEMBER' AND account_status = 'ACTIVE'";
  if (audience === "ALL_MEMBERS") where = "role = 'MEMBER'";
  if (audience === "STAFF") where = "role <> 'MEMBER' AND account_status = 'ACTIVE'";
  const recipients = await query<{ id: string }>(`SELECT id FROM users WHERE ${where}`);
  const limited = rateLimit(`announcement:${admin.id}`, 5, 10 * 60 * 1000);
  if (!limited.ok) fail("/admin/dashboard", "Too many announcements in a short period.");
  await notifyMany(recipients.map((r) => r.id), {
    type: "ANNOUNCEMENT",
    title,
    body,
    link: "/dashboard/notifications",
  });
  await audit({ actor: admin, action: "announcement.sent", targetType: "platform", metadata: { audience, recipients: recipients.length, title } });
  done("/admin/dashboard", `Announcement sent to ${recipients.length} account(s).`);
}

export async function rewardQualifiedReferralAction(formData: FormData) {
  const admin = await requireAdminAction("referrals.manage");
  const referralId = formString(formData, "referralId", 80);
  const row = await one<{ referred_id: string; status: string }>(`SELECT referred_id, status FROM referrals WHERE id = $1`, [referralId]);
  if (!row) fail("/admin/referrals", "Referral not found.");
  if (row.status !== "PENDING") fail("/admin/referrals", "Only pending referrals can be re-evaluated.");
  await qualifyReferral(row.referred_id);
  await audit({ actor: admin, action: "referral.reprocessed", targetType: "referral", targetId: referralId });
  done("/admin/referrals", "Referral eligibility re-evaluated.");
}

export async function toggleBundleStatusAction(formData: FormData) {
  const admin = await requireAdminAction("bundles.manage");
  const id = formString(formData, "bundleId", 80);
  const row = await one<{ status: string }>(`SELECT status FROM bundles WHERE id = $1`, [id]);
  if (!row) fail("/admin/bundles", "Bundle not found.");
  const next = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  await query(`UPDATE bundles SET status = $2, updated_at = now() WHERE id = $1`, [id, next]);
  await audit({ actor: admin, action: "bundle.status_changed", targetType: "bundle", targetId: id, metadata: { status: next } });
  done("/admin/bundles", `Bundle marked ${next.toLowerCase()}.`);
}

export async function assignTicketPriorityAction(formData: FormData) {
  const admin = await requireAdminAction("support.manage");
  const ticketId = formString(formData, "ticketId", 80);
  const priority = formString(formData, "priority", 20);
  if (!["LOW", "NORMAL", "HIGH", "URGENT"].includes(priority)) fail(`/admin/support/${ticketId}`, "Invalid priority.");
  await query(`UPDATE support_tickets SET priority = $2, updated_at = now() WHERE id = $1`, [ticketId, priority]);
  await audit({ actor: admin, action: "support.priority_changed", targetType: "ticket", targetId: ticketId, metadata: { priority } });
  done(`/admin/support/${ticketId}`, "Priority updated.");
}
