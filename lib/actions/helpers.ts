import { redirect } from "next/navigation";

export function appendParam(path: string, key: string, value: string) {
  const [base, query] = path.split("?");
  const params = new URLSearchParams(query ?? "");
  params.set(key, value);
  return `${base}?${params.toString()}`;
}

export function fail(path: string, message: string): never {
  redirect(appendParam(path, "error", message));
}

export function done(path: string, message: string): never {
  redirect(appendParam(path, "toast", message));
}

export function formString(formData: FormData, key: string, max = 5000) {
  return String(formData.get(key) ?? "").trim().slice(0, max);
}

export function formInt(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "").replace(/[^\d.-]/g, "");
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value) : 0;
}

export function formMoneyToCents(formData: FormData, key: string) {
  const raw = String(formData.get(key) ?? "0").replace(/,/g, "").trim();
  const value = Number(raw);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}

export function formBool(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "");
  return value === "on" || value === "true" || value === "1";
}

export function formDate(formData: FormData, key: string) {
  const value = formString(formData, key, 20);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
}

export function safeNextPath(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  return raw;
}

export function friendlyDbError(err: unknown) {
  const message = err instanceof Error ? err.message : "Something went wrong.";
  if (message.includes("one_completed_session_per_ad")) return "This advertisement has already been completed.";
  if (message.includes("users_email_lower_idx") || message.includes("users_email_key")) return "An account with this email already exists.";
  if (message.includes("referrals_referred_id_key") || message.includes("referrals_referred_id")) return "Referral attribution already recorded for this account.";
  return message;
}
