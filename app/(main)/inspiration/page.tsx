"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import {
  getInspirationItems,
  INSPIRATION_CATEGORIES,
  type InspirationCategory,
  type InspirationItem,
} from "@/lib/firestore/inspiration";
import { Button, Card } from "@/components/ui";



const CATEGORY_COLOR: Record<InspirationCategory, string> = {
  podcast: "bg-purple-100 text-purple-700",
  article: "bg-blue-100 text-blue-700",
  video: "bg-red-100 text-red-700",
  "education-news": "bg-amber-100 text-amber-700",
  "teacher-story": "bg-emerald-100 text-emerald-700",
};

function categoryLabel(cat: InspirationCategory): string {
  return INSPIRATION_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function categoryIcon(cat: InspirationCategory): string {
  return INSPIRATION_CATEGORIES.find((c) => c.value === cat)?.icon ?? "📌";
}

// --- Featured card (large, hero-style) ---

function FeaturedCard({ item }: { item: InspirationItem }) {
  const thumb = item.thumbnailStorageURL || item.thumbnailURL;
  return (
    <a
      href={item.sourceURL}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow">
        <div className="flex flex-col sm:flex-row gap-0">
          {/* Thumbnail / colour swatch */}
          <div
            className="h-48 sm:h-auto sm:w-64 shrink-0 flex items-center justify-center text-6xl"
            style={{ background: "var(--color-secondary-50, #f3f4f6))" }}
          >
            {thumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumb}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <span role="img" aria-label={categoryLabel(item.category)}>
                {categoryIcon(item.category)}
              </span>
            )}
          </div>

          <div className="p-6 flex flex-col justify-between gap-4">
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${CATEGORY_COLOR[item.category]}`}
              >
                {categoryLabel(item.category)}
              </span>
              <h2 className="text-xl font-bold text-foreground group-hover:underline leading-snug">
                {item.title}
              </h2>
              <p className="mt-2 text-sm text-muted line-clamp-3">
                {item.description}
              </p>
            </div>
            <p className="text-xs text-muted font-medium">by {item.creator}</p>
          </div>
        </div>
      </Card>
    </a>
  );
}

// --- Regular grid card ---

function InspirationCard({ item }: { item: InspirationItem }) {
  const thumb = item.thumbnailStorageURL || item.thumbnailURL;
  return (
    <a
      href={item.sourceURL}
      target="_blank"
      rel="noopener noreferrer"
      className="block group h-full"
    >
      <Card className="h-full flex flex-col overflow-hidden hover:shadow-md transition-shadow">
        {/* Thumbnail */}
        <div
          className="h-36 flex items-center justify-center text-4xl shrink-0"
          style={{ background: "var(--color-secondary-50, #f3f4f6)" }}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <span role="img" aria-label={categoryLabel(item.category)}>
              {categoryIcon(item.category)}
            </span>
          )}
        </div>

        <div className="p-4 flex flex-col flex-1 gap-2">
          <span
            className={`inline-block self-start px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLOR[item.category]}`}
          >
            {categoryLabel(item.category)}
          </span>
          <h3 className="text-sm font-semibold text-foreground group-hover:underline leading-snug line-clamp-2">
            {item.title}
          </h3>
          <p className="text-xs text-muted line-clamp-3 flex-1">
            {item.description}
          </p>
          <p className="text-xs text-muted font-medium mt-auto pt-2 border-t border-border">
            {item.creator}
          </p>
        </div>
      </Card>
    </a>
  );
}

// --- Main page ---

export default function InspirationPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<InspirationCategory | "all">("all");
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<DocumentSnapshot | null>(null);

  const fetchItems = useCallback(
    async (reset: boolean) => {
      if (reset) {
        cursorRef.current = null;
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const filters = activeCategory !== "all" ? { category: activeCategory } : {};
        const { items: fetched, cursor } = await getInspirationItems(
          filters,
          12,
          reset ? null : cursorRef.current
        );
        cursorRef.current = cursor;
        setHasMore(cursor !== null);
        setItems((prev) => (reset ? fetched : [...prev, ...fetched]));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeCategory]
  );

  useEffect(() => {
    fetchItems(true);
  }, [fetchItems]);

  const featured = items[0] ?? null;
  const rest = items.slice(1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inspiration Hub</h1>
          <p className="mt-1 text-sm text-muted">
            Curated podcasts, articles, videos, and stories to inspire your teaching.
          </p>
        </div>
        {user ? (
          <Link href="/inspiration/new">
            <Button variant="primary">+ Submit Content</Button>
          </Link>
        ) : (
          <Button variant="outline" onClick={() => router.push("/auth/login?redirect=/inspiration/new")}>
            Sign In to Submit
          </Button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap" role="tablist">
        <button
          role="tab"
          aria-selected={activeCategory === "all"}
          onClick={() => setActiveCategory("all")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            activeCategory === "all"
              ? "bg-primary text-white"
              : "bg-secondary-100 text-foreground hover:bg-secondary-200"
          }`}
        >
          All
        </button>
        {INSPIRATION_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            role="tab"
            aria-selected={activeCategory === cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.value
                ? "bg-primary text-white"
                : "bg-secondary-100 text-foreground hover:bg-secondary-200"
            }`}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="py-16 text-center text-muted text-sm">Loading content…</div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <div className="py-16 text-center">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-foreground font-medium">No content found</p>
          <p className="text-sm text-muted mt-1">
            {activeCategory !== "all"
              ? "No items in this category yet."
              : "Be the first to submit inspiring content!"}
          </p>
        </div>
      )}

      {/* Magazine layout */}
      {!loading && items.length > 0 && (
        <div className="space-y-6">
          {featured && <FeaturedCard item={featured} />}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((item) => (
                <InspirationCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => fetchItems(false)} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}
