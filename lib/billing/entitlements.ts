import type { ConnectionQuotaSummary } from "@/lib/network/types";
import type { MessageQuotaSummary } from "@/lib/messages/types";
import type { UserProfile } from "@/lib/firestore/users";
import {
  FREE_MONTHLY_CONNECTION_REQUEST_LIMIT,
  FREE_MONTHLY_MESSAGE_LIMIT,
} from "@/lib/billing/config";

export type BillingPlanId = "free" | "plus";

export type BillingSubscriptionStatus =
  | "none"
  | "active"
  | "trialing"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "canceled"
  | "unpaid"
  | "expired"
  | "unknown";

export interface BillingEntitlements {
  plan: BillingPlanId;
  subscriptionStatus: BillingSubscriptionStatus;
  plusAccessActive: boolean;
  billingManagementAvailable: boolean;
  connectionRequestLimit: number | null;
  messageLimit: number | null;
  advancedSearchAccess: boolean;
  advancedFilterAccess: boolean;
  expandedRecommendationAccess: boolean;
  profileInsightsAccess: boolean;
  enhancedProfileAccess: boolean;
  contactInformationRequests: boolean;
  paymentProblem: boolean;
  cancellationPending: boolean;
  renewalDate: string | null;
  cancellationDate: string | null;
  currentPeriodEnd: string | null;
  source: "subscription" | "legacy-tier" | "none";
}

export interface BillingLimitsInput {
  entitlements: BillingEntitlements;
  connectionQuota?: ConnectionQuotaSummary | null;
  messageQuota?: MessageQuotaSummary | null;
}

export interface BillingSummaryInput {
  entitlements: BillingEntitlements;
  connectionQuota?: ConnectionQuotaSummary | null;
  messageQuota?: MessageQuotaSummary | null;
}

type BillingProfile = Pick<
  UserProfile,
  | "tier"
  | "stripeCustomerId"
  | "stripeSubscriptionId"
  | "stripeSubscriptionStatus"
  | "stripeCurrentPeriodEnd"
  | "stripeCancelAt"
  | "stripeCancelAtPeriodEnd"
  | "stripeCanceledAt"
  | "billingStatus"
> | null;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") {
    const millis = value > 1_000_000_000_000 ? value : value * 1000;
    return new Date(millis);
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as { seconds?: unknown; nanoseconds?: unknown; toDate?: unknown };
    if (typeof record.toDate === "function") {
      try {
        return (record.toDate as () => Date)();
      } catch {
        return null;
      }
    }
    if (typeof record.seconds === "number") {
      return new Date(record.seconds * 1000);
    }
  }
  return null;
}

function toIso(value: unknown): string | null {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

export function normalizeBillingSubscriptionStatus(
  value: unknown,
): BillingSubscriptionStatus {
  const status = typeof value === "string" ? value : "";

  switch (status) {
    case "active":
    case "trialing":
    case "past_due":
    case "incomplete":
    case "incomplete_expired":
    case "canceled":
    case "unpaid":
    case "expired":
      return status;
    case "":
      return "none";
    default:
      return "unknown";
  }
}

function isActiveUntilPeriodEnd(
  status: BillingSubscriptionStatus,
  currentPeriodEnd: Date | null,
  cancelAtPeriodEnd: boolean,
  now: Date,
): boolean {
  if (!currentPeriodEnd) return false;
  if (currentPeriodEnd.getTime() <= now.getTime()) return false;

  if (status === "canceled") {
    return cancelAtPeriodEnd;
  }

  return status === "past_due";
}

export function getUserEntitlements(profile: BillingProfile, now: Date = new Date()): BillingEntitlements {
  const subscriptionStatus = normalizeBillingSubscriptionStatus(
    profile?.stripeSubscriptionStatus ?? profile?.billingStatus,
  );
  const currentPeriodEnd = toDate(profile?.stripeCurrentPeriodEnd);
  const cancelAt = toDate(profile?.stripeCancelAt);
  const canceledAt = toDate(profile?.stripeCanceledAt);
  const legacyPlus = profile?.tier === "plus";

  const cancellationPending = Boolean(profile?.stripeCancelAtPeriodEnd) && Boolean(currentPeriodEnd) && currentPeriodEnd!.getTime() > now.getTime();
  const activeByStatus =
    subscriptionStatus === "active" ||
    subscriptionStatus === "trialing" ||
    isActiveUntilPeriodEnd(subscriptionStatus, currentPeriodEnd, Boolean(profile?.stripeCancelAtPeriodEnd), now);

  const plusAccessActive = activeByStatus || (legacyPlus && subscriptionStatus === "none");

  const source: BillingEntitlements["source"] = profile
    ? profile.stripeSubscriptionId || profile.stripeCustomerId
      ? "subscription"
      : legacyPlus
        ? "legacy-tier"
        : "none"
    : "none";

  const paymentProblem = subscriptionStatus === "past_due" || subscriptionStatus === "unpaid";

  return {
    plan: plusAccessActive ? "plus" : "free",
    subscriptionStatus,
    plusAccessActive,
    billingManagementAvailable: Boolean(profile?.stripeCustomerId),
    connectionRequestLimit: plusAccessActive ? null : FREE_MONTHLY_CONNECTION_REQUEST_LIMIT,
    messageLimit: plusAccessActive ? null : FREE_MONTHLY_MESSAGE_LIMIT,
    advancedSearchAccess: plusAccessActive,
    advancedFilterAccess: plusAccessActive,
    expandedRecommendationAccess: plusAccessActive,
    profileInsightsAccess: false,
    enhancedProfileAccess: plusAccessActive,
    contactInformationRequests: false,
    paymentProblem,
    cancellationPending,
    renewalDate: toIso(currentPeriodEnd ?? cancelAt),
    cancellationDate: toIso(canceledAt ?? cancelAt),
    currentPeriodEnd: toIso(currentPeriodEnd),
    source,
  };
}

export function isPlusUser(entitlements: BillingEntitlements | BillingProfile): boolean {
  if (entitlements && typeof entitlements === "object" && "plusAccessActive" in entitlements) {
    return Boolean((entitlements as BillingEntitlements).plusAccessActive);
  }

  return getUserEntitlements(entitlements as BillingProfile).plusAccessActive;
}

export function canSendConnectionRequest(
  entitlements: BillingEntitlements,
  connectionQuota: ConnectionQuotaSummary | null,
): boolean {
  if (entitlements.plusAccessActive) return true;
  if (!connectionQuota) return false;
  return connectionQuota.canSend;
}

export function canSendMessage(
  entitlements: BillingEntitlements,
  messageQuota: MessageQuotaSummary | null,
): boolean {
  if (entitlements.plusAccessActive) return true;
  if (!messageQuota) return false;
  return messageQuota.canSend;
}

export function canUseAdvancedDiscovery(entitlements: BillingEntitlements): boolean {
  return entitlements.advancedSearchAccess || entitlements.advancedFilterAccess;
}

export function canUseProfileInsights(entitlements: BillingEntitlements): boolean {
  return entitlements.profileInsightsAccess;
}

export function canRequestContactInformation(entitlements: BillingEntitlements): boolean {
  return entitlements.contactInformationRequests;
}

export function getUsageSummary(input: BillingSummaryInput): string {
  const { entitlements, connectionQuota, messageQuota } = input;

  if (entitlements.plusAccessActive) {
    return "Plus access active";
  }

  const parts: string[] = [];
  if (connectionQuota && typeof connectionQuota.remaining === "number") {
    parts.push(
      connectionQuota.remaining === 0
        ? "0 connection requests remaining"
        : `${connectionQuota.remaining} connection request${connectionQuota.remaining === 1 ? "" : "s"} remaining`,
    );
  }

  if (messageQuota && typeof messageQuota.remaining === "number") {
    parts.push(
      messageQuota.remaining === 0
        ? "0 messages remaining"
        : `${messageQuota.remaining} message${messageQuota.remaining === 1 ? "" : "s"} remaining`,
    );
  }

  if (parts.length === 0) {
    return "Usage data unavailable";
  }

  return parts.length === 1 ? parts[0] : `${parts[0]} and ${parts[1]}`;
}