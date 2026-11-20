-- Umar Baig Platform - initial schema (PostgreSQL / PGlite compatible)
-- All monetary values are stored as integer minor units (cents). Never floats.

CREATE TABLE IF NOT EXISTS users (
  id                    TEXT PRIMARY KEY,
  member_id             TEXT NOT NULL UNIQUE,
  full_name             TEXT NOT NULL,
  email                 TEXT NOT NULL,
  mobile                TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  role                  TEXT NOT NULL DEFAULT 'MEMBER'
                        CHECK (role IN ('MEMBER','SUPER_ADMIN','FINANCE_ADMIN','SUPPORT_ADMIN','MODERATOR')),
  account_status        TEXT NOT NULL DEFAULT 'PENDING_ACTIVATION'
                        CHECK (account_status IN ('PENDING_ACTIVATION','ACTIVE','SUSPENDED','BLOCKED','DEACTIVATED')),
  referral_code         TEXT NOT NULL UNIQUE,
  referred_by_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
  last_login_at         TIMESTAMPTZ,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  status_reason         TEXT,
  activated_at          TIMESTAMPTZ,
  suspended_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (account_status);
CREATE INDEX IF NOT EXISTS users_referrer_idx ON users (referred_by_id);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip          TEXT,
  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          TEXT PRIMARY KEY,
  token_hash  TEXT NOT NULL UNIQUE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reset_user_idx ON password_reset_tokens (user_id);

CREATE TABLE IF NOT EXISTS membership_plans (
  id                     TEXT PRIMARY KEY,
  name                   TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  price_cents            INTEGER NOT NULL CHECK (price_cents >= 0),
  currency               TEXT NOT NULL DEFAULT 'USD',
  benefits               JSONB NOT NULL DEFAULT '[]'::jsonb,
  activation_requirements TEXT NOT NULL DEFAULT '',
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS memberships (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_id      TEXT NOT NULL REFERENCES membership_plans(id),
  status       TEXT NOT NULL DEFAULT 'PENDING'
               CHECK (status IN ('PENDING','ACTIVE','EXPIRED','CANCELLED')),
  activated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS membership_payments (
  id             TEXT PRIMARY KEY,
  reference      TEXT NOT NULL UNIQUE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id        TEXT NOT NULL REFERENCES membership_plans(id),
  amount_cents   INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency       TEXT NOT NULL DEFAULT 'USD',
  method         TEXT NOT NULL DEFAULT 'DEMO_CARD',
  status         TEXT NOT NULL DEFAULT 'PENDING'
                 CHECK (status IN ('PENDING','SUCCESS','FAILED','REFUNDED')),
  failure_reason TEXT,
  paid_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_user_idx ON membership_payments (user_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON membership_payments (status);

CREATE TABLE IF NOT EXISTS campaigns (
  id                   TEXT PRIMARY KEY,
  code                 TEXT NOT NULL UNIQUE,
  name                 TEXT NOT NULL,
  description          TEXT NOT NULL DEFAULT '',
  advertiser_name      TEXT NOT NULL,
  start_date           DATE NOT NULL,
  end_date             DATE NOT NULL,
  status               TEXT NOT NULL DEFAULT 'DRAFT'
                       CHECK (status IN ('DRAFT','SCHEDULED','ACTIVE','PAUSED','COMPLETED','ARCHIVED')),
  total_ad_allocation  INTEGER NOT NULL DEFAULT 0,
  default_reward_cents INTEGER NOT NULL DEFAULT 0,
  terms                TEXT NOT NULL DEFAULT '',
  created_by           TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status);

CREATE TABLE IF NOT EXISTS bundles (
  id            TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  ad_count      INTEGER NOT NULL DEFAULT 10,
  eligibility   TEXT NOT NULL DEFAULT 'ALL_MEMBERS'
                CHECK (eligibility IN ('ALL_MEMBERS','RESTRICTED')),
  status        TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS advertisements (
  id                     TEXT PRIMARY KEY,
  code                   TEXT NOT NULL UNIQUE,
  title                  TEXT NOT NULL,
  description            TEXT NOT NULL DEFAULT '',
  advertiser_name        TEXT NOT NULL,
  campaign_id            TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  video_url              TEXT NOT NULL,
  thumbnail_url          TEXT,
  duration_seconds       INTEGER NOT NULL CHECK (duration_seconds > 0),
  reward_cents           INTEGER NOT NULL CHECK (reward_cents >= 0),
  required_watch_seconds INTEGER NOT NULL CHECK (required_watch_seconds > 0),
  start_date             DATE NOT NULL,
  end_date               DATE NOT NULL,
  status                 TEXT NOT NULL DEFAULT 'DRAFT'
                         CHECK (status IN ('DRAFT','ACTIVE','PAUSED','ARCHIVED')),
  display_order          INTEGER NOT NULL DEFAULT 0,
  media_id               TEXT,
  archived_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ads_campaign_idx ON advertisements (campaign_id);
CREATE INDEX IF NOT EXISTS ads_status_idx ON advertisements (status);

CREATE TABLE IF NOT EXISTS bundle_advertisements (
  bundle_id        TEXT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  advertisement_id TEXT NOT NULL REFERENCES advertisements(id) ON DELETE CASCADE,
  display_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bundle_id, advertisement_id)
);

CREATE TABLE IF NOT EXISTS member_bundles (
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bundle_id TEXT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  granted_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bundle_id)
);

CREATE TABLE IF NOT EXISTS ad_sessions (
  id                     TEXT PRIMARY KEY,
  user_id                TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  advertisement_id       TEXT NOT NULL REFERENCES advertisements(id) ON DELETE RESTRICT,
  campaign_id            TEXT NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  bundle_id              TEXT REFERENCES bundles(id) ON DELETE SET NULL,
  status                 TEXT NOT NULL DEFAULT 'STARTED'
                         CHECK (status IN ('STARTED','IN_PROGRESS','PAUSED','COMPLETED','EXPIRED','INVALIDATED','FLAGGED')),
  started_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at             TIMESTAMPTZ NOT NULL,
  watched_seconds        INTEGER NOT NULL DEFAULT 0,
  required_seconds       INTEGER NOT NULL,
  reward_cents           INTEGER NOT NULL,
  completed_at           TIMESTAMPTZ,
  risk_score             INTEGER NOT NULL DEFAULT 0,
  flag_reason            TEXT,
  invalid_reason         TEXT,
  ip                     TEXT,
  user_agent             TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_ad_user_idx ON ad_sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_ad_status_idx ON ad_sessions (status);
CREATE INDEX IF NOT EXISTS sessions_ad_advert_idx ON ad_sessions (advertisement_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_completed_session_per_ad
  ON ad_sessions (user_id, advertisement_id) WHERE status = 'COMPLETED';

CREATE TABLE IF NOT EXISTS ad_session_events (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES ad_sessions(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ad_events_session_idx ON ad_session_events (session_id);

CREATE TABLE IF NOT EXISTS wallets (
  id                    TEXT PRIMARY KEY,
  user_id               TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  available_cents       INTEGER NOT NULL DEFAULT 0 CHECK (available_cents >= 0),
  pending_cents         INTEGER NOT NULL DEFAULT 0 CHECK (pending_cents >= 0),
  lifetime_credit_cents INTEGER NOT NULL DEFAULT 0,
  lifetime_debit_cents  INTEGER NOT NULL DEFAULT 0,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                 TEXT PRIMARY KEY,
  reference          TEXT NOT NULL UNIQUE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type               TEXT NOT NULL CHECK (type IN (
                       'AD_REWARD','REFERRAL_REWARD','MEMBERSHIP_PAYMENT','WITHDRAWAL_REQUEST',
                       'WITHDRAWAL_REJECTION','ADMIN_ADJUSTMENT','REVERSAL')),
  direction          TEXT NOT NULL CHECK (direction IN ('CREDIT','DEBIT')),
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  status             TEXT NOT NULL DEFAULT 'COMPLETED'
                     CHECK (status IN ('PENDING','COMPLETED','FAILED','REVERSED')),
  description        TEXT NOT NULL,
  balance_after_cents INTEGER NOT NULL DEFAULT 0,
  related_type       TEXT,
  related_id         TEXT,
  idempotency_key    TEXT UNIQUE,
  created_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS txn_user_idx ON wallet_transactions (user_id);
CREATE INDEX IF NOT EXISTS txn_type_idx ON wallet_transactions (type);
CREATE INDEX IF NOT EXISTS txn_created_idx ON wallet_transactions (created_at);

CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id                 TEXT PRIMARY KEY,
  reference          TEXT NOT NULL UNIQUE,
  user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents       INTEGER NOT NULL CHECK (amount_cents > 0),
  method             TEXT NOT NULL CHECK (method IN ('BANK_TRANSFER','OTHER','CRYPTO')),
  destination_masked TEXT NOT NULL,
  note               TEXT,
  status             TEXT NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED','COMPLETED')),
  decided_by         TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision_reason    TEXT,
  decided_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS withdrawals_user_idx ON withdrawal_requests (user_id);
CREATE INDEX IF NOT EXISTS withdrawals_status_idx ON withdrawal_requests (status);

CREATE TABLE IF NOT EXISTS referrals (
  id           TEXT PRIMARY KEY,
  referrer_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_id  TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'PENDING'
               CHECK (status IN ('PENDING','QUALIFIED','REWARDED','REJECTED')),
  reward_cents INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  qualified_at TIMESTAMPTZ,
  CONSTRAINT no_self_referral CHECK (referrer_id <> referred_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_id);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id             TEXT PRIMARY KEY,
  referral_id    TEXT NOT NULL UNIQUE REFERENCES referrals(id) ON DELETE CASCADE,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents   INTEGER NOT NULL,
  transaction_id TEXT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'SYSTEM',
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS support_tickets (
  id          TEXT PRIMARY KEY,
  reference   TEXT NOT NULL UNIQUE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,
  subject     TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'OPEN'
              CHECK (status IN ('OPEN','IN_PROGRESS','WAITING_FOR_MEMBER','RESOLVED','CLOSED')),
  priority    TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tickets_user_idx ON support_tickets (user_id);
CREATE INDEX IF NOT EXISTS tickets_status_idx ON support_tickets (status);

CREATE TABLE IF NOT EXISTS support_messages (
  id          TEXT PRIMARY KEY,
  ticket_id   TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_ticket_idx ON support_messages (ticket_id, created_at);

CREATE TABLE IF NOT EXISTS admin_notes (
  id              TEXT PRIMARY KEY,
  subject_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          TEXT PRIMARY KEY,
  actor_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT,
  reason      TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip          TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_actor_idx ON audit_logs (actor_id);

CREATE TABLE IF NOT EXISTS platform_settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS uploaded_media (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    INTEGER NOT NULL,
  storage_key   TEXT NOT NULL,
  url           TEXT NOT NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('VIDEO','IMAGE')),
  uploaded_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL,
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','READ','CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roles (
  key         TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS permissions (
  key         TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  module      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_key       TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_key, permission_key)
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  id         TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Gap-free display identifiers. Sequences are atomic, so concurrent
-- registrations can never receive the same Member ID.
CREATE SEQUENCE IF NOT EXISTS member_id_seq START 1;
CREATE SEQUENCE IF NOT EXISTS referral_code_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_seq START 1000;
