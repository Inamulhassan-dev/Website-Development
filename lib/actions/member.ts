"use server";

import { z } from "zod";
import { newId, one, query, tx } from "@/lib/db";
import { getCurrentUser, hashPassword, hashToken, requireMember, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { notify, notifyMany } from "@/lib/notifications";
import { startMembershipPayment, simulateMembershipPayment } from "@/lib/services/membership";
import { requestWithdrawal, type WithdrawalMethod } from "@/lib/services/withdrawals";
import { reference } from "@/lib/services/wallet";
import { releaseWithdrawalHold } from "@/lib/services/wallet";
import { rateLimit } from "@/lib/rate-limit";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { fail, formInt, formMoneyToCents, formString, friendlyDbError, done } from "./helpers";

const redirectTo = (path: string, error: unknown): never =>
  fail(path, error instanceof Error ? error.message : "Something went wrong.");

export async function updateProfileAction(formData: FormData) {
  const user = await requireMember("/dashboard/profile");
  const fullName = formString(formData, "fullName", 120);
  const mobile = formString(formData, "mobile", 24);
  if (fullName.length < 3) fail("/dashboard/profile", "Enter your full name.");
  if (!/^\+?[0-9][0-9\s\-()]{6,22}$/.test(mobile)) fail("/dashboard/profile", "Enter a valid mobile number.");
  await query(`UPDATE users SET full_name = $2, mobile = $3, updated_at = now() WHERE id = $1`, [user.id, fullName, mobile]);
  await audit({ actor: user, action: "profile.updated", targetType: "user", targetId: user.id });
  done("/dashboard/profile", "Profile updated.");
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireMember("/dashboard/security");
  const current = String(formData.get("currentPassword") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirmPassword") ?? "");
  if (next.length < 8 || !/[A-Z]/.test(next) || !/[a-z]/.test(next) || !/[0-9]/.test(next)) {
    fail("/dashboard/security", "New password must be 8+ characters with upper case, lower case and a number.");
  }
  if (next !== confirm) fail("/dashboard/security", "New passwords do not match.");
  const row = await one<{ password_hash: string }>(`SELECT password_hash FROM users WHERE id = $1`, [user.id]);
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    fail("/dashboard/security", "Your current password is incorrect.");
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value ?? "";
  await tx(async (client) => {
    await client.query(`UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1`, [
      user.id,
      await hashPassword(next),
    ]);
    await client.query(`UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND token_hash <> $2 AND revoked_at IS NULL`, [
      user.id,
      hashToken(token),
    ]);
  });
  await notify({
    userId: user.id,
    type: "SECURITY",
    title: "Password changed",
    body: "Your password was updated and other sessions were signed out.",
    link: "/dashboard/security",
  });
  await audit({ actor: user, action: "auth.password_changed", targetType: "user", targetId: user.id });
  done("/dashboard/security", "Password updated. Other sessions were signed out.");
}

export async function createPaymentAction(formData: FormData) {
  const user = await requireMember("/dashboard/membership");
  const method = formString(formData, "method", 30) || "DEMO_CARD";
  try {
    const payment = await startMembershipPayment(user.id, method);
    done(`/dashboard/membership?payment=${payment.id}`, "DEMO payment created. Choose an outcome below.");
  } catch (err) {
    redirectTo("/dashboard/membership", err);
  }
}

export async function simulatePaymentAction(formData: FormData) {
  const user = await requireMember("/dashboard/membership");
  const paymentId = formString(formData, "paymentId", 80);
  const outcome = formString(formData, "outcome", 20) === "FAILED" ? "FAILED" : "SUCCESS";
  try {
    const result = await simulateMembershipPayment({
      paymentId,
      userId: user.id,
      outcome,
      actorLabel: user.email,
    });
    if (result.success) {
      done("/dashboard", "MEMBERSHIP ACTIVE — your DEMO payment was successful.");
    }
    fail(`/dashboard/membership?payment=${paymentId}`, "DEMO payment failed. You can retry with a new payment.");
  } catch (err) {
    redirectTo("/dashboard/membership", err);
  }
}

export async function requestWithdrawalAction(formData: FormData) {
  const user = await requireMember("/dashboard/withdrawals");
  const limited = rateLimit(`withdrawal:${user.id}`, 4, 60 * 60 * 1000);
  if (!limited.ok) fail("/dashboard/withdrawals", "Too many withdrawal attempts. Please try again later.");
  const amountCents = formMoneyToCents(formData, "amount");
  const methodRaw = formString(formData, "method", 30);
  const method = (["BANK_TRANSFER", "OTHER", "CRYPTO"].includes(methodRaw) ? methodRaw : "BANK_TRANSFER") as WithdrawalMethod;
  try {
    const result = await requestWithdrawal({
      userId: user.id,
      amountCents,
      method,
      destination: formString(formData, "destination", 80),
      note: formString(formData, "note", 500),
    });
    await audit({ actor: user, action: "withdrawal.requested", targetType: "withdrawal", targetId: result.id, metadata: { amountCents, simulated: true } });
    done("/dashboard/withdrawals", `DEMO withdrawal ${result.reference} submitted for review.`);
  } catch (err) {
    redirectTo("/dashboard/withdrawals", err);
  }
}

export async function cancelWithdrawalAction(formData: FormData) {
  const user = await requireMember("/dashboard/withdrawals");
  const id = formString(formData, "withdrawalId", 80);
  const row = await one<{ id: string; amount_cents: number; status: string }>(
    `SELECT id, amount_cents, status FROM withdrawal_requests WHERE id = $1 AND user_id = $2`,
    [id, user.id],
  );
  if (!row) fail("/dashboard/withdrawals", "Withdrawal request not found.");
  if (!["PENDING", "UNDER_REVIEW"].includes(row.status)) fail("/dashboard/withdrawals", "This request can no longer be cancelled.");
  await tx(async (client) => {
    await client.query(`UPDATE withdrawal_requests SET status = 'CANCELLED', decided_at = now(), decision_reason = $2 WHERE id = $1`, [
      row.id,
      "Cancelled by member",
    ]);
    await releaseWithdrawalHold(client, {
      userId: user.id,
      amountCents: row.amount_cents,
      withdrawalId: row.id,
      adminId: user.id,
      reason: "Cancelled by member",
    });
  });
  await audit({ actor: user, action: "withdrawal.cancelled", targetType: "withdrawal", targetId: row.id });
  done("/dashboard/withdrawals", "Withdrawal cancelled and demo balance released.");
}

export async function createTicketAction(formData: FormData) {
  const user = await requireMember("/dashboard/support");
  const subject = formString(formData, "subject", 160);
  const message = formString(formData, "message", 4000);
  const category = formString(formData, "category", 40) || "General";
  if (subject.length < 4) fail("/dashboard/support", "Add a subject for your ticket.");
  if (message.length < 10) fail("/dashboard/support", "Describe your issue in at least 10 characters.");
  const ref = await reference("SUP");
  const id = newId("tkt");
  await tx(async (client) => {
    await client.query(
      `INSERT INTO support_tickets (id, reference, user_id, category, subject, status)
       VALUES ($1,$2,$3,$4,$5,'OPEN')`,
      [id, ref, user.id, category, subject],
    );
    await client.query(
      `INSERT INTO support_messages (id, ticket_id, author_id, body, is_internal) VALUES ($1,$2,$3,$4,FALSE)`,
      [newId("msg"), id, user.id, message],
    );
    const staff = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('SUPPORT_ADMIN','SUPER_ADMIN') AND account_status = 'ACTIVE'`,
    );
    await notify(
      {
        userId: user.id,
        type: "SUPPORT",
        title: "Support ticket created",
        body: `Ticket ${ref} was created. Our team will respond soon.`,
        link: `/dashboard/support/${id}`,
      },
      client,
    );
    for (const row of staff.rows) {
      await notify(
        {
          userId: row.id,
          type: "SUPPORT",
          title: "New support ticket",
          body: `${user.fullName} opened ${ref}: ${subject}`,
          link: `/admin/support/${id}`,
        },
        client,
      );
    }
  });
  await audit({ actor: user, action: "support.ticket_created", targetType: "ticket", targetId: id, metadata: { reference: ref } });
  done(`/dashboard/support/${id}`, "Support ticket created.");
}

export async function replyTicketAction(formData: FormData) {
  const user = await requireMember("/dashboard/support");
  const ticketId = formString(formData, "ticketId", 80);
  const body = formString(formData, "body", 4000);
  if (body.length < 2) fail(`/dashboard/support/${ticketId}`, "Write a reply first.");
  const ticket = await one<{ id: string; status: string }>(`SELECT id, status FROM support_tickets WHERE id = $1 AND user_id = $2`, [
    ticketId,
    user.id,
  ]);
  if (!ticket) fail("/dashboard/support", "Ticket not found.");
  if (ticket.status === "CLOSED") fail(`/dashboard/support/${ticketId}`, "This ticket is closed. Create a new ticket instead.");
  await tx(async (client) => {
    await client.query(`INSERT INTO support_messages (id, ticket_id, author_id, body) VALUES ($1,$2,$3,$4)`, [
      newId("msg"),
      ticket.id,
      user.id,
      body,
    ]);
    await client.query(`UPDATE support_tickets SET status = 'OPEN', updated_at = now() WHERE id = $1`, [ticket.id]);
    const staff = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('SUPPORT_ADMIN','SUPER_ADMIN') AND account_status = 'ACTIVE'`,
    );
    for (const row of staff.rows) {
      await notify(
        {
          userId: row.id,
          type: "SUPPORT",
          title: "Member replied to a ticket",
          body: `${user.fullName} replied on a support ticket.`,
          link: `/admin/support/${ticket.id}`,
        },
        client,
      );
    }
  });
  done(`/dashboard/support/${ticketId}`, "Reply sent.");
}

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireMember("/dashboard/notifications");
  const id = formString(formData, "notificationId", 80);
  await query(`UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`, [id, user.id]);
  done("/dashboard/notifications", "Notification marked as read.");
}

export async function markAllNotificationsReadAction() {
  const user = await requireMember("/dashboard/notifications");
  await query(`UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`, [user.id]);
  done("/dashboard/notifications", "All notifications marked as read.");
}

export async function updateNotificationPrefsAction() {
  const user = await requireMember("/dashboard/notifications");
  await audit({ actor: user, action: "profile.notification_preferences_updated", targetType: "user", targetId: user.id });
  done("/dashboard/notifications", "Notification preferences saved (demo).");
}
