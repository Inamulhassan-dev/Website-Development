export const ROLES = [
  "SUPER_ADMIN",
  "FINANCE_ADMIN",
  "SUPPORT_ADMIN",
  "MODERATOR",
] as const;

export type StaffRole = (typeof ROLES)[number];
export type UserRole = StaffRole | "MEMBER";

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin",
  FINANCE_ADMIN: "Finance Admin",
  SUPPORT_ADMIN: "Support Admin",
  MODERATOR: "Moderator",
  MEMBER: "Member",
};

export const PERMISSIONS = {
  "dashboard.view": "View admin dashboard",
  "users.view": "View members",
  "users.manage": "Manage member accounts",
  "memberships.view": "View memberships & payments",
  "memberships.manage": "Manage membership plan",
  "campaigns.view": "View campaigns",
  "campaigns.manage": "Create & edit campaigns",
  "ads.view": "View advertisements",
  "ads.manage": "Upload & edit advertisements",
  "bundles.view": "View bundles",
  "bundles.manage": "Create & edit bundles",
  "sessions.view": "View ad sessions",
  "moderation.manage": "Review flagged activity",
  "wallet.view": "View wallet ledger",
  "wallet.adjust": "Adjust demo wallet balances",
  "transactions.view": "View transactions",
  "withdrawals.view": "View withdrawal requests",
  "withdrawals.review": "Approve / reject withdrawals",
  "referrals.view": "View referrals",
  "referrals.manage": "Configure referral programme",
  "support.view": "View support tickets",
  "support.manage": "Reply & update tickets",
  "support.notes": "Write internal notes",
  "users.notify": "Send member notifications",
  "staff.manage": "Manage staff accounts & roles",
  "roles.view": "View permission matrix",
  "audit.view": "View audit logs",
  "reports.view": "View reports",
  "reports.export": "Export reports (CSV)",
  "settings.manage": "Manage platform settings",
} as const;

export type Permission = keyof typeof PERMISSIONS;

const ALL = Object.keys(PERMISSIONS) as Permission[];

export const ROLE_PERMISSIONS: Record<StaffRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  FINANCE_ADMIN: [
    "dashboard.view",
    "users.view",
    "memberships.view",
    "wallet.view",
    "transactions.view",
    "withdrawals.view",
    "withdrawals.review",
    "referrals.view",
    "reports.view",
    "reports.export",
    "audit.view",
  ],
  SUPPORT_ADMIN: [
    "dashboard.view",
    "users.view",
    "memberships.view",
    "support.view",
    "support.manage",
    "support.notes",
    "users.notify",
  ],
  MODERATOR: [
    "dashboard.view",
    "users.view",
    "campaigns.view",
    "ads.view",
    "bundles.view",
    "sessions.view",
    "moderation.manage",
    "reports.view",
  ],
};

export function permissionsForRole(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as StaffRole] ?? [];
}

export function roleHasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  return permissionsForRole(role).includes(permission);
}

export function isStaffRole(role: string | undefined): role is StaffRole {
  return !!role && (ROLES as readonly string[]).includes(role);
}

export type AccountStatus =
  | "PENDING_ACTIVATION"
  | "ACTIVE"
  | "SUSPENDED"
  | "BLOCKED"
  | "DEACTIVATED";

export const ACCOUNT_STATUS_LABELS: Record<AccountStatus, string> = {
  PENDING_ACTIVATION: "Pending activation",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  BLOCKED: "Blocked",
  DEACTIVATED: "Deactivated",
};

export const CAMPAIGN_STATUSES = [
  "DRAFT",
  "SCHEDULED",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;

export const AD_STATUSES = ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"] as const;

export const WITHDRAWAL_STATUSES = [
  "PENDING",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
  "COMPLETED",
] as const;

export const TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_FOR_MEMBER",
  "RESOLVED",
  "CLOSED",
] as const;

export const TXN_TYPE_LABELS: Record<string, string> = {
  AD_REWARD: "Demo ad reward",
  REFERRAL_REWARD: "Demo referral reward",
  MEMBERSHIP_PAYMENT: "Membership fee",
  WITHDRAWAL_REQUEST: "Withdrawal request",
  WITHDRAWAL_REJECTION: "Withdrawal released",
  ADMIN_ADJUSTMENT: "Admin adjustment",
  REVERSAL: "Reversal",
};

export const STATUS_TONE: Record<string, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  ACTIVE: "success",
  COMPLETED: "success",
  SUCCESS: "success",
  APPROVED: "success",
  REWARDED: "success",
  QUALIFIED: "brand",
  RESOLVED: "success",
  PENDING: "warning",
  PENDING_ACTIVATION: "warning",
  UNDER_REVIEW: "warning",
  WAITING_FOR_MEMBER: "warning",
  SCHEDULED: "brand",
  IN_PROGRESS: "brand",
  OPEN: "brand",
  STARTED: "brand",
  DRAFT: "neutral",
  PAUSED: "warning",
  SUSPENDED: "danger",
  BLOCKED: "danger",
  REJECTED: "danger",
  FAILED: "danger",
  FLAGGED: "danger",
  INVALIDATED: "danger",
  EXPIRED: "neutral",
  ARCHIVED: "neutral",
  CLOSED: "neutral",
  CANCELLED: "neutral",
  DEACTIVATED: "neutral",
  INACTIVE: "neutral",
};

export function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
