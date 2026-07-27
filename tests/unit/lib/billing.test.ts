import { describe, expect, it } from "vitest";
import {
  canRequestContactInformation,
  canSendConnectionRequest,
  canSendMessage,
  canUseAdvancedDiscovery,
  canUseProfileInsights,
  getUsageSummary,
  getUserEntitlements,
  isPlusUser,
  normalizeBillingSubscriptionStatus,
} from "@/lib/billing/entitlements";

describe("billing entitlements", () => {
  it("treats active subscriptions as plus", () => {
    const entitlements = getUserEntitlements({
      tier: "free",
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripeSubscriptionStatus: "active",
      stripeCurrentPeriodEnd: 1_900_000_000,
      stripeCancelAt: null,
      stripeCancelAtPeriodEnd: false,
      stripeCanceledAt: null,
      billingStatus: "active",
    } as never);

    expect(entitlements.plusAccessActive).toBe(true);
    expect(isPlusUser(entitlements)).toBe(true);
    expect(canSendConnectionRequest(entitlements, null)).toBe(true);
    expect(canSendMessage(entitlements, null)).toBe(true);
    expect(canUseAdvancedDiscovery(entitlements)).toBe(true);
  });

  it("keeps free accounts on monthly limits", () => {
    const entitlements = getUserEntitlements({
      tier: "free",
      stripeCustomerId: undefined,
      stripeSubscriptionId: undefined,
      stripeSubscriptionStatus: undefined,
      stripeCurrentPeriodEnd: null,
      stripeCancelAt: null,
      stripeCancelAtPeriodEnd: false,
      stripeCanceledAt: null,
      billingStatus: undefined,
    } as never);

    expect(entitlements.plusAccessActive).toBe(false);
    expect(entitlements.connectionRequestLimit).toBe(5);
    expect(entitlements.messageLimit).toBe(10);
    expect(canSendConnectionRequest(entitlements, { canSend: false } as never)).toBe(false);
    expect(canSendMessage(entitlements, { canSend: false } as never)).toBe(false);
    expect(canUseProfileInsights(entitlements)).toBe(false);
    expect(canRequestContactInformation(entitlements)).toBe(false);
  });

  it("formats usage summaries for both plan states", () => {
    const freeEntitlements = getUserEntitlements({ tier: "free" } as never);
    const plusEntitlements = getUserEntitlements({
      tier: "plus",
      stripeSubscriptionStatus: "active",
      stripeCurrentPeriodEnd: 1_900_000_000,
    } as never);

    expect(
      getUsageSummary({
        entitlements: freeEntitlements,
        connectionQuota: { remaining: 1 } as never,
        messageQuota: { remaining: 0 } as never,
      }),
    ).toContain("connection request");

    expect(getUsageSummary({ entitlements: plusEntitlements })).toBe("Plus access active");
  });

  it("normalizes billing subscription states", () => {
    expect(normalizeBillingSubscriptionStatus("past_due")).toBe("past_due");
    expect(normalizeBillingSubscriptionStatus(undefined)).toBe("none");
    expect(normalizeBillingSubscriptionStatus("unknown_status")).toBe("unknown");
  });
});
