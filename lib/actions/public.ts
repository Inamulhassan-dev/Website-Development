"use server";

import { z } from "zod";
import { newId, query } from "@/lib/db";
import { clientMeta } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { done, fail, formString } from "./helpers";

const schema = z.object({
  name: z.string().min(2, "Enter your name.").max(120),
  email: z.string().email("Enter a valid email address.").max(200),
  subject: z.string().min(3, "Enter a subject.").max(180),
  message: z.string().min(10, "Write a message of at least 10 characters.").max(5000),
});

export async function contactAction(formData: FormData) {
  const meta = await clientMeta();
  const limited = rateLimit(`contact:${meta.ip}`, 5, 30 * 60 * 1000);
  if (!limited.ok) fail("/contact", "Too many messages sent. Please try again later.");

  const parsed = schema.safeParse({
    name: formString(formData, "name", 120),
    email: formString(formData, "email", 200).toLowerCase(),
    subject: formString(formData, "subject", 180),
    message: formString(formData, "message", 5000),
  });
  if (!parsed.success) fail("/contact", parsed.error.issues[0]?.message ?? "Please check your message.");

  const id = newId("cnt");
  await query(
    `INSERT INTO contact_messages (id, name, email, subject, message) VALUES ($1,$2,$3,$4,$5)`,
    [id, parsed.data.name, parsed.data.email, parsed.data.subject, parsed.data.message],
  );
  const staff = await query<{ id: string }>(
    `SELECT id FROM users WHERE role IN ('SUPPORT_ADMIN','SUPER_ADMIN') AND account_status = 'ACTIVE'`,
  );
  await notifyMany(staff.map((s) => s.id), {
    type: "CONTACT",
    title: "New website message",
    body: `${parsed.data.name} (${parsed.data.email}): ${parsed.data.subject}`,
    link: "/admin/support",
  });
  await audit({ actorLabel: parsed.data.email, action: "contact.message_received", targetType: "contact_message", targetId: id, ip: meta.ip });
  done("/contact", "Thank you — your message has been received. This is a demo inbox; we do not send real emails.");
}
