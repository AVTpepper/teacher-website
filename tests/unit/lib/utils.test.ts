import { describe, expect, it, vi } from "vitest";
import {
  getCollapsedPreview,
  makeSlug,
  normalizeMultilineText,
  parseMentions,
  parseSlug,
  timeAgo,
} from "@/lib/utils";

describe("utils", () => {
  it("creates and parses slugs deterministically", () => {
    const slug = makeSlug("Hello, VistaTeacher! 2026", "abc123");
    expect(slug).toBe("hello-vistateacher-2026--abc123");
    expect(parseSlug(slug)).toBe("abc123");
    expect(parseSlug("raw-id")).toBe("raw-id");
  });

  it("parses mentions with longest-name precedence", () => {
    const parts = parseMentions("Hi @Ann Marie and @Ann", [
      { uid: "u1", displayName: "Ann" },
      { uid: "u2", displayName: "Ann Marie" },
    ]);

    expect(parts).toHaveLength(5);
    expect(parts[1]).toEqual({ uid: "u2", displayName: "Ann Marie" });
    expect(parts[3]).toEqual({ uid: "u1", displayName: "Ann" });
  });

  it("normalizes multiline text and enforces limits", () => {
    const input = " line 1  \r\n\r\n\r\nline 2\t\r\nline 3 ";
    const normalized = normalizeMultilineText(input, {
      maxConsecutiveBlankLines: 1,
      maxLines: 3,
      maxLength: 100,
    });

    expect(normalized).toBe("line 1\n\nline 2");
  });

  it("returns truncated preview metadata", () => {
    const result = getCollapsedPreview("a\n".repeat(20), 10, 3);
    expect(result.truncated).toBe(true);
    expect(result.preview.length).toBeLessThanOrEqual(10);
  });

  it("formats relative time for recent and older timestamps", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);

    expect(timeAgo(null)).toBe("just now");
    expect(timeAgo({ seconds: 1_700_000_000 - 30 })).toBe("just now");
    expect(timeAgo({ seconds: 1_700_000_000 - 3600 })).toBe("1h ago");
  });
});
