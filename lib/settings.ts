import { query } from "./db";

export type Settings = {
  platform_name: string;
  platform_tagline: string;
  contact_email: string;
  support_email: string;
  support_phone: string;
  currency: string;
  min_withdrawal_cents: number;
  max_withdrawal_cents: number;
  referral_reward_cents: number;
  referral_enabled: boolean;
  registration_open: boolean;
  maintenance_mode: boolean;
  default_reward_cents: number;
  default_required_watch_seconds: number;
  announcement_banner: string;
  audit_retention_days: number;
};

export const DEFAULT_SETTINGS: Settings = {
  platform_name: "Umar Baig",
  platform_tagline: "Private advertising, membership & rewards platform",
  contact_email: "hello@umarbaig.demo",
  support_email: "support@umarbaig.demo",
  support_phone: "+1 (555) 010-2026",
  currency: "USD",
  min_withdrawal_cents: 500,
  max_withdrawal_cents: 500000,
  referral_reward_cents: 500,
  referral_enabled: true,
  registration_open: true,
  maintenance_mode: false,
  default_reward_cents: 150,
  default_required_watch_seconds: 10,
  announcement_banner: "",
  audit_retention_days: 365,
};

let cache: { at: number; value: Settings } | null = null;

export async function getSettings(force = false): Promise<Settings> {
  if (!force && cache && Date.now() - cache.at < 10_000) return cache.value;
  try {
    const rows = await query<{ key: string; value: unknown }>("SELECT key, value FROM platform_settings");
    const merged = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const row of rows) {
      if (row.key in merged && row.value !== null && row.value !== undefined) {
        merged[row.key] = row.value;
      }
    }
    const value = merged as Settings;
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function invalidateSettingsCache() {
  cache = null;
}

export async function setSetting(key: keyof Settings, value: unknown, updatedBy?: string) {
  await query(
    `INSERT INTO platform_settings (key, value, updated_by, updated_at)
     VALUES ($1, $2::jsonb, $3, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), updatedBy ?? null],
  );
  invalidateSettingsCache();
}
