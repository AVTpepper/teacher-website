import { describe, expect, it } from "vitest";
import {
  buildActivationTasks,
  buildAttentionItems,
  classifyDashboardSectionOrder,
  classifyDashboardVariant,
  formatUsageSummary,
  getFirstName,
  resolveModuleState,
} from "@/lib/dashboard";

describe("dashboard helpers", () => {
  it("classifies dashboard variants deterministically", () => {
    expect(
      classifyDashboardVariant({
        profile: { minimumComplete: false, percentage: 20, missingRecommended: [] },
        counts: { connections: 0, incomingRequests: 0, sentRequests: 0, unreadConversations: 0, followers: 0, following: 0 },
      }),
    ).toBe("new-user");

    expect(
      classifyDashboardVariant({
        profile: { minimumComplete: true, percentage: 78, missingRecommended: [] },
        counts: { connections: 1, incomingRequests: 0, sentRequests: 0, unreadConversations: 0, followers: 0, following: 1 },
      }),
    ).toBe("developing-network");

    expect(
      classifyDashboardVariant({
        profile: { minimumComplete: true, percentage: 90, missingRecommended: [] },
        counts: { connections: 3, incomingRequests: 1, sentRequests: 0, unreadConversations: 2, followers: 4, following: 5 },
      }),
    ).toBe("established-user");
  });

  it("builds attention items in priority order", () => {
    const items = buildAttentionItems({
      profile: { minimumComplete: false, percentage: 45, missingRecommended: ["Curriculum"] },
      counts: { connections: 0, incomingRequests: 2, sentRequests: 0, unreadConversations: 3, followers: 0, following: 0 },
      connectionQuota: { periodKey: "2026-07", isUnlimited: false, limit: 5, used: 4, remaining: 1, canSend: true },
      messageQuota: { periodKey: "2026-07", isUnlimited: false, limit: 10, used: 10, remaining: 0, canSend: false },
    });

    expect(items.map((item) => item.id)).toEqual([
      "connection-requests",
      "unread-messages",
      "incomplete-profile",
      "connection-usage",
      "message-usage",
    ]);
  });

  it("builds activation tasks from real counters", () => {
    const tasks = buildActivationTasks({
      profile: { minimumComplete: true, percentage: 86, missingRecommended: [] },
      counts: { connections: 1, incomingRequests: 0, sentRequests: 1, unreadConversations: 0, followers: 0, following: 1 },
      hasRecommendations: true,
      hasCommunities: false,
    });

    expect(tasks.find((task) => task.id === "profile")?.completed).toBe(true);
    expect(tasks.find((task) => task.id === "follow")?.completed).toBe(true);
    expect(tasks.find((task) => task.id === "community")?.completed).toBe(false);
  });

  it("returns the expected section order for each dashboard state", () => {
    expect(classifyDashboardSectionOrder("new-user")[0]).toBe("attention");
    expect(classifyDashboardSectionOrder("established-user")).toContain("network-activity");
  });

  it("formats usage summaries for free and plus tiers", () => {
    expect(
      formatUsageSummary({
        tier: "free",
        connectionQuota: { periodKey: "2026-07", isUnlimited: false, limit: 5, used: 4, remaining: 1, canSend: true },
        messageQuota: { periodKey: "2026-07", isUnlimited: false, limit: 10, used: 10, remaining: 0, canSend: false },
      }),
    ).toContain("connection request");

    expect(formatUsageSummary({ tier: "plus", connectionQuota: null, messageQuota: null })).toBe("Plus access active");
  });

  it("resolves module states", () => {
    expect(resolveModuleState({ loading: true, error: false, items: 0 })).toBe("loading");
    expect(resolveModuleState({ loading: false, error: true, items: 0 })).toBe("error");
    expect(resolveModuleState({ loading: false, error: false, items: 0 })).toBe("empty");
    expect(resolveModuleState({ loading: false, error: false, items: 2 })).toBe("content");
  });

  it("extracts the first name safely", () => {
    expect(getFirstName("Alex Rivera")).toBe("Alex");
    expect(getFirstName("")).toBe("there");
  });
});