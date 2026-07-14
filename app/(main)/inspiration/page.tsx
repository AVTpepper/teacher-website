"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import {
  getInspirationItems,
  updateInspirationItem,
  deleteInspirationItem,
  INSPIRATION_CATEGORIES,
  type InspirationCategory,
  type InspirationItem,
} from "@/lib/firestore/inspiration";
import { Button, Card, ConfirmDialog, IPNotice, Input, Modal, Select } from "@/components/ui";



const CATEGORY_COLOR: Record<InspirationCategory, string> = {
  podcast: "bg-info-50 text-info-700",
  article: "bg-secondary-100 text-secondary-800",
  video: "bg-error-50 text-error-700",
  "education-news": "bg-warning-50 text-warning-700",
  "teacher-story": "bg-success-50 text-success-700",
  general: "bg-primary-50 text-primary-800",
  other: "bg-secondary-200 text-secondary-900",
};

function categoryLabel(cat: InspirationCategory): string {
  return INSPIRATION_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function categoryIcon(cat: InspirationCategory): string {
  return INSPIRATION_CATEGORIES.find((c) => c.value === cat)?.icon ?? "📌";
}

function sourceHost(url: string): string {
  if (!url) return "External source";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "External source";
  }
}

function cleanDisplayText(value: string | null | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (/^[\W_]+$/.test(trimmed)) return "";
  return trimmed;
}

// --- Featured card (large, hero-style) ---

interface CardProps {
  item: InspirationItem;
  currentUserId?: string | null;
  isPinned?: boolean;
  onOpen: (item: InspirationItem) => void;
  onPin: (item: InspirationItem) => void;
  onCreatorClick: (creator: string) => void;
  onSourceClick: (source: string) => void;
  onEdit: (item: InspirationItem) => void;
  onDelete: (item: InspirationItem) => void;
}

function FeaturedCard({
  item,
  currentUserId,
  isPinned = false,
  onOpen,
  onPin,
  onCreatorClick,
  onSourceClick,
  onEdit,
  onDelete,
}: CardProps) {
  const thumb = item.thumbnailStorageURL || item.thumbnailURL;
  const isOwner = currentUserId != null && item.submittedBy === currentUserId;
  const source = sourceHost(item.sourceURL || "");
  const displayTitle = cleanDisplayText(item.title) || "Untitled inspiration";
  const displayDescription = cleanDisplayText(item.description) || "No description provided.";
  const displayCreator = cleanDisplayText(item.creator) || "Community";
  return (
    <div
      className="relative group h-full cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className="absolute top-3 right-3 z-10 flex gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPin(item);
          }}
          aria-label={isPinned ? "Unpin featured inspiration" : "Pin as featured inspiration"}
          className={`flex items-center justify-center w-7 h-7 rounded-full bg-surface/90 border transition-colors ${
            isPinned
              ? "border-warning-300 text-warning-700 hover:bg-warning-50"
              : "border-border text-muted hover:text-foreground hover:bg-surface"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill={isPinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 3.75v5.25l-5.25 3-5.25-3V3.75M3.75 15h16.5" />
          </svg>
        </button>
      {isOwner && (
        <>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(item); }}
            aria-label="Edit inspiration post"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-surface/90 border border-border text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item); }}
            aria-label="Delete inspiration post"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-surface/90 border border-border text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </>
      )}
      </div>
      <div className="block group">
        <Card className="overflow-hidden border-primary-200 hover:shadow-lg transition-shadow">
          <div className="flex flex-col sm:flex-row gap-0">
            {/* Thumbnail / colour swatch */}
            <div
              className="h-48 sm:h-auto sm:w-64 shrink-0 flex items-center justify-center text-6xl"
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

            <div className="p-6 flex flex-col justify-between gap-4">
              <div>
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mb-3 ${CATEGORY_COLOR[item.category]}`}
                >
                  {categoryLabel(item.category)}
                </span>
                <h2 className="text-xl font-bold text-foreground group-hover:underline leading-snug">
                  {displayTitle}
                </h2>
                <p className="mt-2 text-sm text-muted line-clamp-3">
                  {displayDescription}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted font-medium">
                <button
                  type="button"
                  className="hover:text-primary-900"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (displayCreator !== "Community") onCreatorClick(displayCreator);
                  }}
                >
                  by {displayCreator}
                </button>
                <span className="text-border">•</span>
                <button
                  type="button"
                  className="hover:text-primary-900"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSourceClick(source);
                  }}
                >
                  {source}
                </button>
                <span className="text-border">•</span>
                <span className="inline-flex items-center gap-1 text-primary-800">
                  View details
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H18m0 0v4.5M18 6l-7.5 7.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 10.5V18h7.5" />
                  </svg>
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

// --- Regular grid card ---

function InspirationCard({
  item,
  currentUserId,
  isPinned = false,
  onOpen,
  onPin,
  onCreatorClick,
  onSourceClick,
  onEdit,
  onDelete,
}: CardProps) {
  const thumb = item.thumbnailStorageURL || item.thumbnailURL;
  const isOwner = currentUserId != null && item.submittedBy === currentUserId;
  const source = sourceHost(item.sourceURL || "");
  const displayTitle = cleanDisplayText(item.title) || "Untitled inspiration";
  const displayDescription = cleanDisplayText(item.description) || "No description provided.";
  const displayCreator = cleanDisplayText(item.creator) || "Community";
  return (
    <div
      className="relative group h-full cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className="absolute top-2 right-2 z-10 flex gap-1">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPin(item);
          }}
          aria-label={isPinned ? "Unpin featured inspiration" : "Pin as featured inspiration"}
          className={`flex items-center justify-center w-7 h-7 rounded-full bg-surface/90 border transition-colors ${
            isPinned
              ? "border-warning-300 text-warning-700 hover:bg-warning-50"
              : "border-border text-muted hover:text-foreground hover:bg-surface"
          }`}
        >
          <svg className="h-3.5 w-3.5" fill={isPinned ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 3.75v5.25l-5.25 3-5.25-3V3.75M3.75 15h16.5" />
          </svg>
        </button>
      {isOwner && (
        <>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(item); }}
            aria-label="Edit inspiration post"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-surface/90 border border-border text-muted hover:text-foreground hover:bg-surface transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item); }}
            aria-label="Delete inspiration post"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-surface/90 border border-border text-muted hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </>
      )}
      </div>
      <div className="block group h-full">
      <Card className="h-full flex flex-col overflow-hidden border-border hover:shadow-md transition-shadow">
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
            {displayTitle}
          </h3>
          <p className="text-xs text-muted line-clamp-3 flex-1">
            {displayDescription}
          </p>
          <div className="mt-auto pt-2 border-t border-border text-xs text-muted font-medium space-y-1">
            <button
              type="button"
              className="hover:text-primary-900"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (displayCreator !== "Community") onCreatorClick(displayCreator);
              }}
            >
              {displayCreator}
            </button>
            {(item.sourceURL || item.videoURL) && (
              <button
                type="button"
                className="truncate hover:text-primary-900"
                onClick={(e) => {
                  e.preventDefault();
                    e.stopPropagation();
                  onSourceClick(source);
                }}
              >
                {source}
              </button>
            )}
          </div>
        </div>
      </Card>
      </div>
    </div>
  );
}

// --- Main page ---

export default function InspirationPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<InspirationCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "creator">("newest");
  const [freshness, setFreshness] = useState<"all" | "today" | "week" | "month">("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [creatorFilter, setCreatorFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [pinnedFeaturedId, setPinnedFeaturedId] = useState<string | null>(null);
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const cursorRef = useRef<DocumentSnapshot | null>(null);

  // Edit state
  const [editingItem, setEditingItem] = useState<InspirationItem | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete state
  const [deletingItem, setDeletingItem] = useState<InspirationItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const isSearchMode = debouncedSearchQuery.trim().length > 0;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const raw = window.localStorage.getItem("inspiration:pinned-featured");
    if (raw) setPinnedFeaturedId(raw);
  }, []);

  useEffect(() => {
    if (pinnedFeaturedId) {
      window.localStorage.setItem("inspiration:pinned-featured", pinnedFeaturedId);
    } else {
      window.localStorage.removeItem("inspiration:pinned-featured");
    }
  }, [pinnedFeaturedId]);

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

  const fetchAllForSearch = useCallback(async () => {
    setLoading(true);
    setLoadingMore(false);
    cursorRef.current = null;

    try {
      const filters = activeCategory !== "all" ? { category: activeCategory } : {};
      const allItems: InspirationItem[] = [];
      let cursor: DocumentSnapshot | null = null;
      let hasNext = true;

      while (hasNext) {
        const { items: fetched, cursor: nextCursor } = await getInspirationItems(
          filters,
          24,
          cursor
        );

        allItems.push(...fetched);
        cursor = nextCursor;
        hasNext = Boolean(nextCursor);
      }

      setItems(allItems);
      setHasMore(false);
    } catch (err) {
      console.error(err);
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeCategory]);

  useEffect(() => {
    if (isSearchMode) {
      fetchAllForSearch();
      return;
    }
    fetchItems(true);
  }, [fetchItems, fetchAllForSearch, isSearchMode]);

  function handleEditOpen(item: InspirationItem) {
    setEditingItem(item);
    setEditTitle(item.title);
    setEditDescription(item.description);
  }

  async function handleEditSave() {
    if (!editingItem || editSaving) return;
    setEditSaving(true);
    try {
      await updateInspirationItem(editingItem.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === editingItem.id
            ? { ...i, title: editTitle.trim(), description: editDescription.trim() }
            : i
        )
      );
      setEditingItem(null);
    } catch {
      // ignore — user can retry
    } finally {
      setEditSaving(false);
    }
  }

  function handleDeleteOpen(item: InspirationItem) {
    setDeletingItem(item);
  }

  async function handleDeleteConfirm() {
    if (!deletingItem || deleteLoading) return;
    setDeleteLoading(true);
    try {
      await deleteInspirationItem(deletingItem.id);
      setItems((prev) => prev.filter((i) => i.id !== deletingItem.id));
      setDeletingItem(null);
    } catch {
      // ignore — user can retry
    } finally {
      setDeleteLoading(false);
    }
  }

  const normalizedQuery = debouncedSearchQuery.trim().toLowerCase();
  const nowSeconds = Date.now() / 1000;

  const filteredItems = items
    .filter((item) => {
      const creatorValue = cleanDisplayText(item.creator);
      const titleValue = cleanDisplayText(item.title);
      const descriptionValue = cleanDisplayText(item.description);

      if (mineOnly && user?.uid) {
        if (item.submittedBy !== user.uid) return false;
      }

      if (creatorFilter && creatorValue !== creatorFilter) {
        return false;
      }

      if (sourceFilter && sourceHost(item.sourceURL || "") !== sourceFilter) {
        return false;
      }

      if (freshness !== "all") {
        const createdAtSeconds = item.createdAt?.seconds ?? 0;
        const maxAge =
          freshness === "today"
            ? 60 * 60 * 24
            : freshness === "week"
              ? 60 * 60 * 24 * 7
              : 60 * 60 * 24 * 30;
        if (nowSeconds - createdAtSeconds > maxAge) {
          return false;
        }
      }

      if (!normalizedQuery) return true;

      return (
        titleValue.toLowerCase().includes(normalizedQuery) ||
        descriptionValue.toLowerCase().includes(normalizedQuery) ||
        creatorValue.toLowerCase().includes(normalizedQuery)
      );
    })
    .sort((a, b) => {
      const creatorA = cleanDisplayText(a.creator);
      const creatorB = cleanDisplayText(b.creator);

      if (sortBy === "oldest") {
        return (a.createdAt?.seconds ?? 0) - (b.createdAt?.seconds ?? 0);
      }
      if (sortBy === "creator") {
        return creatorA.localeCompare(creatorB);
      }
      return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
    });

  const pinnedFeatured = pinnedFeaturedId
    ? filteredItems.find((item) => item.id === pinnedFeaturedId) ?? null
    : null;

  const featured = pinnedFeatured ?? filteredItems[0] ?? null;
  const rest = featured
    ? filteredItems.filter((item) => item.id !== featured.id)
    : filteredItems;

  const loadedCount = items.length;
  const visibleCount = filteredItems.length;

  const activeQuickFilters = useMemo(() => {
    const filters: string[] = [];
    if (creatorFilter) filters.push(`Creator: ${creatorFilter}`);
    if (sourceFilter) filters.push(`Source: ${sourceFilter}`);
    if (freshness !== "all") filters.push(`Freshness: ${freshness}`);
    if (mineOnly) filters.push("My submissions");
    return filters;
  }, [creatorFilter, sourceFilter, freshness, mineOnly]);

  function handlePin(item: InspirationItem) {
    setPinnedFeaturedId((prev) => (prev === item.id ? null : item.id));
  }

  function handleOpen(item: InspirationItem) {
    router.push(`/inspiration/${item.id}`);
  }

  return (
    <div className="flex-1 min-w-0 space-y-6">
      <div className="rounded-2xl border border-border bg-surface/75 p-4 shadow-sm backdrop-blur-sm sm:p-6">
        <div className="space-y-4">
        {/* Header */}
        <div className="-mx-4 -mt-4 flex flex-col gap-3 border-b border-primary-700 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 shadow-md sm:-mx-6 sm:-mt-6 rounded-t-2xl sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Discover</p>
            <h1 className="text-2xl font-bold">Inspiration Hub</h1>
            <p className="mt-1 text-sm text-primary-100/90">
              Curated podcasts, articles, videos, and stories to inspire your teaching.
            </p>
          </div>
          {user ? (
            <Link href="/inspiration/new">
              <Button variant="secondary">+ Submit Content</Button>
            </Link>
          ) : (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => router.push("/auth/signup?redirect=/inspiration/new")}>Create Account</Button>
              <Button variant="outline" onClick={() => router.push("/auth/login?redirect=/inspiration/new")}>Sign In</Button>
            </div>
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
                ? "bg-primary-900 text-white"
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
                  ? "bg-primary-900 text-white"
                  : "bg-secondary-100 text-foreground hover:bg-secondary-200"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* Discovery controls */}
        <Card className="border-primary-200 bg-secondary-50/70">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <Input
                placeholder="Search title, description, or creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
              />
              <Select
                label="Sort"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "creator")}
                options={[
                  { value: "newest", label: "Newest" },
                  { value: "oldest", label: "Oldest" },
                  { value: "creator", label: "Creator (A-Z)" },
                ]}
              />
              <Select
                label="Freshness"
                value={freshness}
                onChange={(e) => setFreshness(e.target.value as "all" | "today" | "week" | "month")}
                options={[
                  { value: "all", label: "All time" },
                  { value: "today", label: "Last 24 hours" },
                  { value: "week", label: "Last 7 days" },
                  { value: "month", label: "Last 30 days" },
                ]}
              />
              <div className="flex items-end">
                <Button
                  variant={mineOnly ? "secondary" : "outline"}
                  className="w-full"
                  disabled={!user}
                  onClick={() => setMineOnly((prev) => !prev)}
                >
                  {mineOnly ? "Showing My Submissions" : "Show My Submissions"}
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
              <span>
                Showing {visibleCount} of {loadedCount} loaded items
              </span>
              {(searchQuery || mineOnly || sortBy !== "newest") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setSortBy("newest");
                    setFreshness("all");
                    setMineOnly(false);
                    setCreatorFilter("");
                    setSourceFilter("");
                  }}
                  className="text-primary-800 hover:text-primary-900 font-medium"
                >
                  Reset filters
                </button>
              )}
            </div>
            {activeQuickFilters.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeQuickFilters.map((filter) => (
                  <span key={filter} className="inline-flex items-center rounded-full bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-800">
                    {filter}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
      </div>

      <div className="space-y-6 pb-8">
        {/* Loading state */}
        {loading && (
          <div className="py-16 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredItems.length === 0 && (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-foreground font-medium">No inspiration matches your current view</p>
            <p className="text-sm text-muted mt-1">
              {searchQuery || mineOnly || creatorFilter || sourceFilter || freshness !== "all"
                ? "Try a different keyword or turn off some filters."
                : activeCategory !== "all"
                  ? "No items in this category yet."
                  : "Be the first to submit inspiring content!"}
            </p>
            {!user && (
              <div className="mt-4 flex justify-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => router.push("/auth/signup?redirect=/inspiration/new")}>Create Account</Button>
                <Button variant="outline" size="sm" onClick={() => router.push("/auth/login?redirect=/inspiration/new")}>Sign In</Button>
              </div>
            )}
          </div>
        )}

        {/* Magazine layout */}
        {!loading && filteredItems.length > 0 && (
          <div className="space-y-6">
            {featured && (
              <FeaturedCard
                item={featured}
                currentUserId={user?.uid ?? null}
                isPinned={pinnedFeaturedId === featured.id}
                onOpen={handleOpen}
                onPin={handlePin}
                onCreatorClick={setCreatorFilter}
                onSourceClick={setSourceFilter}
                onEdit={handleEditOpen}
                onDelete={handleDeleteOpen}
              />
            )}
            {rest.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {rest.map((item) => (
                  <InspirationCard
                    key={item.id}
                    item={item}
                    currentUserId={user?.uid ?? null}
                    isPinned={pinnedFeaturedId === item.id}
                    onOpen={handleOpen}
                    onPin={handlePin}
                    onCreatorClick={setCreatorFilter}
                    onSourceClick={setSourceFilter}
                    onEdit={handleEditOpen}
                    onDelete={handleDeleteOpen}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Load more */}
        {!isSearchMode && hasMore && (
          <div className="flex flex-col items-center gap-2 pt-2">
            <Button variant="outline" onClick={() => fetchItems(false)} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load More"}
            </Button>
            <p className="text-xs text-muted">Load more to expand search coverage and discover older posts.</p>
          </div>
        )}

        {/* IP Notice */}
        <IPNotice />
      </div>

      {/* Edit modal */}
      <Modal
        open={editingItem !== null}
        onClose={() => setEditingItem(null)}
        title="Edit inspiration post"
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-foreground mb-1">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label htmlFor="edit-description" className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              id="edit-description"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditingItem(null)} disabled={editSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!editTitle.trim() || editSaving}
              isLoading={editSaving}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={deletingItem !== null}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete inspiration post"
        description="This will permanently remove this post from the feed. This cannot be undone."
        confirmLabel="Delete"
        isLoading={deleteLoading}
      />
    </div>
  );
}
