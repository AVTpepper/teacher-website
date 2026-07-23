import { describe, expect, it } from "vitest";
import {
  buildMessagePreview,
  evaluateMessageQuota,
  normalizeIdempotencyKey,
  normalizeMessageBody,
} from "@/lib/messages/utils";

describe("message utils", () => {
  it("normalizes valid message body", () => {
    const result = normalizeMessageBody("  Hello\nworld  ");
    expect(result.error).toBeUndefined();
    expect(result.value).toBe("Hello\nworld");
  });

  it("rejects empty message body", () => {
    const result = normalizeMessageBody("   ");
    expect(result.error).toBeDefined();
  });

  it("rejects message body with markup-like symbols", () => {
    const result = normalizeMessageBody("<script>alert(1)</script>");
    expect(result.error).toBeDefined();
  });

  it("accepts valid idempotency key", () => {
    const result = normalizeIdempotencyKey("abc12345_def");
    expect(result.error).toBeUndefined();
    expect(result.value).toBe("abc12345_def");
  });

  it("rejects idempotency key with invalid characters", () => {
    const result = normalizeIdempotencyKey("abc 123");
    expect(result.error).toBeDefined();
  });

  it("builds shortened preview", () => {
    const longBody = "a".repeat(140);
    const preview = buildMessagePreview(longBody);
    expect(preview.length).toBe(120);
    expect(preview.endsWith("...")).toBe(true);
  });

  it("calculates quota for free tier", () => {
    const summary = evaluateMessageQuota({ used: 7, isUnlimited: false, limit: 10 });
    expect(summary.limit).toBe(10);
    expect(summary.remaining).toBe(3);
    expect(summary.canSend).toBe(true);
  });

  it("calculates quota for unlimited tier", () => {
    const summary = evaluateMessageQuota({ used: 100, isUnlimited: true });
    expect(summary.limit).toBeNull();
    expect(summary.remaining).toBeNull();
    expect(summary.canSend).toBe(true);
  });
});
