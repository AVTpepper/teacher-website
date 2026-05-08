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
