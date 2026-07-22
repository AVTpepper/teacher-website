import { type Firestore } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---------------------------------------------------------------------------
// Firestore guard
// ---------------------------------------------------------------------------

export function requireDb(): Firestore {
  if (!db) throw new Error("Firestore is not initialized");
  return db;
}

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

export function timeAgo(timestamp: { seconds: number } | null): string {
  if (!timestamp) return "just now";
  const seconds = Math.floor(Date.now() / 1000 - timestamp.seconds);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(timestamp.seconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Mention rendering — converts @Name tokens into styled links
// ---------------------------------------------------------------------------

export interface MentionRef {
  uid: string;
  displayName: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits `content` on @mention tokens and returns an array of plain strings
 * and `{ uid, displayName }` objects. Consumers render each element as a link
 * or plain text accordingly.
 */
export function parseMentions(
  content: string,
  mentionedUsers?: MentionRef[]
): Array<string | MentionRef> {
  if (!mentionedUsers?.length) return [content];
  const sorted = [...mentionedUsers].sort(
    (a, b) => b.displayName.length - a.displayName.length
  );
  const pattern = sorted
    .map((u) => `@${escapeRegex(u.displayName)}`)
    .join("|");
  const regex = new RegExp(`(${pattern})`, "g");
  const segments = content.split(regex);
  return segments.map((seg) => {
    const match = sorted.find((u) => seg === `@${u.displayName}`);
    return match ?? seg;
  });
}

// ---------------------------------------------------------------------------
// URL slug helpers
// ---------------------------------------------------------------------------

export function makeSlug(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug}--${id}`;
}

export function parseSlug(slug: string): string {
  const idx = slug.lastIndexOf("--");
  return idx !== -1 ? slug.slice(idx + 2) : slug;
}

// ---------------------------------------------------------------------------
// Sort comparators
// ---------------------------------------------------------------------------

export function byCreatedAtDesc(
  a: { createdAt?: { seconds: number } | null },
  b: { createdAt?: { seconds: number } | null }
): number {
  return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
}

export function byUpdatedAtDesc(
  a: { updatedAt?: { seconds: number } | null },
  b: { updatedAt?: { seconds: number } | null }
): number {
  return (b.updatedAt?.seconds ?? 0) - (a.updatedAt?.seconds ?? 0);
}

// ---------------------------------------------------------------------------
// Multiline content helpers
// ---------------------------------------------------------------------------

export interface NormalizeMultilineOptions {
  maxLength?: number;
  maxLines?: number;
  maxConsecutiveBlankLines?: number;
}

/**
 * Normalizes user-authored multiline text to avoid excessive whitespace spam.
 */
export function normalizeMultilineText(
  input: string,
  options: NormalizeMultilineOptions = {}
): string {
  const {
    maxLength,
    maxLines,
    maxConsecutiveBlankLines = 2,
  } = options;

  const normalizedNewlines = input.replace(/\r\n?/g, "\n");
  const lines = normalizedNewlines.split("\n").map((line) => line.replace(/[ \t]+$/g, ""));

  const constrainedLines: string[] = [];
  let blankRun = 0;

  for (const line of lines) {
    const isBlank = line.trim().length === 0;
    if (isBlank) {
      blankRun += 1;
      if (blankRun > maxConsecutiveBlankLines) {
        continue;
      }
      constrainedLines.push("");
      continue;
    }

    blankRun = 0;
    constrainedLines.push(line);
  }

  let output = constrainedLines.join("\n").trim();

  if (typeof maxLines === "number" && maxLines > 0) {
    output = output.split("\n").slice(0, maxLines).join("\n");
  }

  if (typeof maxLength === "number" && maxLength > 0) {
    output = output.slice(0, maxLength);
  }

  return output.trim();
}

export function getCollapsedPreview(
  input: string,
  maxChars = 360,
  maxLines = 8
): { preview: string; truncated: boolean } {
  const normalized = normalizeMultilineText(input, {
    maxConsecutiveBlankLines: 2,
  });

  const lines = normalized.split("\n");
  const lineLimited = lines.slice(0, maxLines).join("\n");
  const lineTruncated = lines.length > maxLines;
  const charTruncated = lineLimited.length > maxChars;

  if (!lineTruncated && !charTruncated) {
    return { preview: normalized, truncated: false };
  }

  return {
    preview: lineLimited.slice(0, maxChars).trimEnd(),
    truncated: true,
  };
}
