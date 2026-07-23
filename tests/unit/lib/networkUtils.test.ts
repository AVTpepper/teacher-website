import { describe, expect, it } from "vitest";
import {
  buildParticipantKey,
  canonicalParticipantIds,
  evaluateConnectionQuota,
  getUtcMonthKey,
  isValidTransition,
  normalizeConnectionReason,
  normalizeTier,
  validateIntroMessage,
} from "@/lib/network/utils";

describe("network utils", () => {
  it("builds a stable participant key regardless of id order", () => {
    const keyA = buildParticipantKey("user-b", "user-a");
    const keyB = buildParticipantKey("user-a", "user-b");
    expect(keyA).toBe(keyB);
  });

  it("returns sorted canonical participant ids", () => {
    expect(canonicalParticipantIds("z", "a")).toEqual(["a", "z"]);
  });

  it("throws for identical participant ids", () => {
    expect(() => canonicalParticipantIds("same", "same")).toThrow();
  });

  it("throws for empty participant ids", () => {
    expect(() => buildParticipantKey("", "x")).toThrow();
    expect(() => buildParticipantKey("x", "   ")).toThrow();
  });

  it("creates UTC month key", () => {
    const date = new Date("2026-07-15T23:11:10.000Z");
    expect(getUtcMonthKey(date)).toBe("2026-07");
  });

  it("normalizes valid and invalid reasons", () => {
    expect(normalizeConnectionReason("network")).toBe("network");
    expect(normalizeConnectionReason("  collaborate  ")).toBe("collaborate");
    expect(normalizeConnectionReason("invalid")).toBeUndefined();
    expect(normalizeConnectionReason(12)).toBeUndefined();
  });

  it("validates intro message", () => {
    expect(validateIntroMessage("  Hello there  ")).toEqual({ value: "Hello there" });
    expect(validateIntroMessage("<script>alert(1)</script>").error).toBeDefined();
    expect(validateIntroMessage(" ")).toEqual({ value: undefined });
  });

  it("validates connection transitions", () => {
    expect(isValidTransition("pending", "accepted")).toBe(true);
    expect(isValidTransition("pending", "declined")).toBe(true);
    expect(isValidTransition("pending", "removed")).toBe(false);
    expect(isValidTransition("accepted", "removed")).toBe(true);
    expect(isValidTransition("declined", "pending")).toBe(false);
  });

  it("evaluates free quota correctly", () => {
    expect(evaluateConnectionQuota({ used: 3, isUnlimited: false, limit: 5 })).toEqual({
      limit: 5,
      used: 3,
      remaining: 2,
      canSend: true,
    });
  });

  it("evaluates unlimited quota correctly", () => {
    expect(evaluateConnectionQuota({ used: 1000, isUnlimited: true })).toEqual({
      limit: null,
      used: 0,
      remaining: null,
      canSend: true,
    });
  });

  it("normalizes legacy or missing tier to free", () => {
    expect(normalizeTier(undefined)).toBe("free");
    expect(normalizeTier("enterprise")).toBe("free");
    expect(normalizeTier("plus")).toBe("plus");
  });
});
