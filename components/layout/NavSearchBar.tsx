"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { resourceSlug, type Resource } from "@/lib/firestore/resources";
import { jobSlug, type Job } from "@/lib/firestore/jobs";
import { threadSlug, type ForumThread } from "@/lib/firestore/forums";
import { type Lesson } from "@/lib/firestore/lessons";
import { type UserProfile } from "@/lib/firestore/users";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SuggestionItem {
  key: string;
  icon: string;
  title: string;
  /** Human-readable path shown in small muted text */
  pathLabel: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Firestore helpers (prefix range - same strategy as search page)
// ---------------------------------------------------------------------------

async function prefixCol<T>(
  col: string,
  field: string,
  term: string,
  max: number
): Promise<T[]> {
  if (!db) return [];
  const lower = term.toLowerCase();
  const q = query(
    collection(db, col),
    where(field, ">=", lower),
    where(field, "<=", lower + "\uf8ff"),
    orderBy(field),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

async function prefixGroup<T>(
  group: string,
  field: string,
  term: string,
  max: number
): Promise<T[]> {
  if (!db) return [];
  const lower = term.toLowerCase();
  const q = query(
    collectionGroup(db, group),
    where(field, ">=", lower),
    where(field, "<=", lower + "\uf8ff"),
    orderBy(field),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

async function scanColByTitle<T extends { id: string; title: string }>(
  col: string,
  term: string,
  max: number,
  excludeIds = new Set<string>()
): Promise<T[]> {
  if (!db || max <= 0) return [];
  const lower = term.toLowerCase();
  const snap = await getDocs(collection(db, col));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as T))
    .filter((item) => !excludeIds.has(item.id) && item.title.toLowerCase().includes(lower))
    .slice(0, max);
}

// ---------------------------------------------------------------------------
// Build suggestion list from raw results
// ---------------------------------------------------------------------------

const MAX_PER_TYPE = 3;

async function fetchSuggestions(term: string): Promise<SuggestionItem[]> {
  const [educators, resources, threads, lessons, jobs] = await Promise.all([
    prefixCol<UserProfile>("users", "displayNameLower", term, MAX_PER_TYPE),
    prefixCol<Resource>("resources", "titleLower", term, MAX_PER_TYPE),
    prefixGroup<ForumThread>("threads", "title", term, MAX_PER_TYPE),
    prefixCol<Lesson>("lessons", "titleLower", term, MAX_PER_TYPE),
    prefixCol<Job>("jobs", "title", term, MAX_PER_TYPE),
  ]);

  const [resourceFallback, lessonFallback] = await Promise.all([
    scanColByTitle<Resource>(
      "resources",
      term,
      MAX_PER_TYPE - resources.length,
      new Set(resources.map((r) => r.id))
    ),
    scanColByTitle<Lesson>(
      "lessons",
      term,
      MAX_PER_TYPE - lessons.length,
      new Set(lessons.map((l) => l.id))
    ),
  ]);

  const mergedResources = [...resources, ...resourceFallback];
  const mergedLessons = [...lessons, ...lessonFallback];

  const items: SuggestionItem[] = [];

  educators.forEach((u) => {
    items.push({
      key: `edu-${u.uid}`,
      icon: "👩‍🏫",
      title: u.displayName,
      pathLabel: `/discover / ${u.displayName}`,
      href: `/educators/${u.uid}`,
    });
  });

  mergedResources.forEach((r) => {
    items.push({
      key: `res-${r.id}`,
      icon: "📂",
      title: r.title,
      pathLabel: `/resources / ${r.title}`,
      href: `/resources/${resourceSlug(r.title, r.id)}`,
    });
  });

  threads.forEach((t) => {
    items.push({
      key: `thr-${t.id}`,
      icon: "💬",
      title: t.title,
      pathLabel: `/communities / ${t.title}`,
      href: `/forums/${threadSlug(t.title, t.id)}`,
    });
  });

  mergedLessons.forEach((l) => {
    items.push({
      key: `les-${l.id}`,
      icon: "📝",
      title: l.title,
      pathLabel: `/lesson-builder / ${l.title}`,
      href: `/lesson-builder/${l.id}`,
    });
  });

  jobs.forEach((j) => {
    items.push({
      key: `job-${j.id}`,
      icon: "💼",
      title: j.title,
      pathLabel: `/jobs / ${j.title}`,
      href: `/jobs/${jobSlug(j.title, j.id)}`,
    });
  });

  return items;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NavSearchBarProps {
  /** Called when user presses Enter or clicks "See all results" - navigate to /search */
  onNavigate?: () => void;
  placeholder?: string;
}

export default function NavSearchBar({
  onNavigate,
  placeholder = "Search educators, resources, communities...",
}: NavSearchBarProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);

  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    const trimmed = value.trim();
    if (!trimmed) {
      setLoading(false);
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const items = await fetchSuggestions(trimmed);
        setSuggestions(items);
        setOpen(items.length > 0);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value]);

  const commitSearch = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setValue("");
    setSuggestions([]);
    setOpen(false);
    onNavigate?.();
  }, [value, router, onNavigate]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!open || suggestions.length === 0) {
      if (e.key === "Enter") commitSearch();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        router.push(suggestions[activeIndex].href);
        setValue("");
        setSuggestions([]);
        setOpen(false);
        onNavigate?.();
      } else {
        commitSearch();
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const node = activeItemRef.current;
    if (node && typeof node.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const showSeeAll = value.trim().length > 0;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className="relative">
        {loading ? (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center">
            <span className="h-3.5 w-3.5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
          </span>
        ) : (
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        )}
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          className="w-full rounded-lg border border-border bg-white pl-10 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-ring hover:border-border-strong"
        />
      </div>

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl border border-border bg-surface shadow-xl overflow-hidden"
        >
          <ul className="max-h-95 overflow-y-auto [scrollbar-width:thin]">
            {suggestions.map((item, idx) => (
              <li key={item.key} role="option" aria-selected={idx === activeIndex}>
                <Link
                  href={item.href}
                  ref={idx === activeIndex ? activeItemRef : undefined}
                  onClick={() => {
                    setValue("");
                    setSuggestions([]);
                    setOpen(false);
                    onNavigate?.();
                  }}
                  className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                    idx === activeIndex
                      ? "bg-primary-50 text-primary-900"
                      : "hover:bg-surface-hover"
                  }`}
                >
                  <span className="text-base shrink-0">{item.icon}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate leading-tight">
                      {item.title}
                    </p>
                    <p className="text-xs text-muted truncate leading-tight mt-0.5">
                      {item.pathLabel}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* See all results footer */}
          {showSeeAll && (
            <div className="border-t border-border">
              <button
                type="button"
                onClick={commitSearch}
                className="w-full px-4 py-2.5 text-left text-sm text-primary-900 font-medium hover:bg-surface-hover transition-colors flex items-center gap-2 cursor-pointer"
              >
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                See all results for &ldquo;{value.trim()}&rdquo;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
