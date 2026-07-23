"use client";

import { useState, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { getPosts, type Post } from "@/lib/firestore/posts";
import { getResources, type Resource } from "@/lib/firestore/resources";
import { getRecentPublicLessons, type Lesson } from "@/lib/firestore/lessons";
import { getInspirationItems, type InspirationItem } from "@/lib/firestore/inspiration";

interface SidebarContentsProps {
  onClose?: () => void;
}

function cleanDisplayText(value: string | null | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  if (/^[\W_]+$/.test(trimmed)) return "";
  return trimmed;
}

function SidebarContents({ onClose }: SidebarContentsProps) {
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loadedTrending, setLoadedTrending] = useState(false);

  const [latestResources, setLatestResources] = useState<Resource[]>([]);
  const [loadedResources, setLoadedResources] = useState(false);

  const [featuredLessons, setFeaturedLessons] = useState<Lesson[]>([]);
  const [loadedLessons, setLoadedLessons] = useState(false);

  const [inspirationItems, setInspirationItems] = useState<InspirationItem[]>([]);
  const [loadedInspiration, setLoadedInspiration] = useState(false);

  useEffect(() => {
    getPosts()
      .then((result) => {
        const discussions = result.posts
          .filter((p) => p.type === "discussion")
          .slice(0, 5);
        setTrendingPosts(
          discussions.length > 0 ? discussions : result.posts.slice(0, 5)
        );
      })
      .catch(() => {})
      .finally(() => setLoadedTrending(true));

    getResources({}, null)
      .then((result) => setLatestResources(result.resources.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoadedResources(true));

    getRecentPublicLessons(3)
      .then((result) => setFeaturedLessons(result))
      .catch(() => {})
      .finally(() => setLoadedLessons(true));

    getInspirationItems({}, 3)
      .then((result) => setInspirationItems(result.items))
      .catch(() => {})
      .finally(() => setLoadedInspiration(true));
  }, []);

  return (
    <div className="space-y-4">
      {/* Trending Discussions */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          🔥 Trending Discussions
        </h3>
        {!loadedTrending ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 bg-secondary-100 rounded animate-pulse" />
            ))}
          </div>
        ) : trendingPosts.length === 0 ? (
          <p className="text-xs text-muted">No discussions yet.</p>
        ) : (
          <ul className="space-y-2">
            {trendingPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/?post=${post.id}`}
                  onClick={onClose}
                  className="group block rounded-lg border border-secondary-200/80 bg-white/65 px-2 py-2 transition-colors hover:border-primary-200 hover:bg-white"
                >
                  <p className="text-xs text-foreground line-clamp-2 leading-relaxed group-hover:text-primary-900">
                    {post.content}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {post.authorName} · {post.likesCount} likes
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Latest Resources */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          📚 Latest Resources
        </h3>
        {!loadedResources ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 bg-secondary-100 rounded animate-pulse" />
            ))}
          </div>
        ) : latestResources.length === 0 ? (
          <p className="text-xs text-muted">No resources yet.</p>
        ) : (
          <ul className="space-y-2">
            {latestResources.map((r) => (
              <li key={r.id} className="rounded-lg border border-secondary-200/80 bg-white/65 px-2 py-2">
                <Link
                  href={`/resources/${r.id}`}
                  onClick={onClose}
                  className="text-xs text-foreground hover:text-primary-900 hover:underline line-clamp-2 leading-relaxed"
                >
                  {r.title}
                </Link>
                <p className="text-xs text-muted mt-0.5">{r.subject}</p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/resources"
          onClick={onClose}
          className="text-xs text-primary-900 hover:underline mt-2 inline-block"
        >
          Browse all resources →
        </Link>
      </Card>

      {/* Featured Lessons */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          📝 Featured Lessons
        </h3>
        {!loadedLessons ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 bg-secondary-100 rounded animate-pulse" />
            ))}
          </div>
        ) : featuredLessons.length === 0 ? (
          <p className="text-xs text-muted">No lessons yet.</p>
        ) : (
          <ul className="space-y-2">
            {featuredLessons.map((l) => (
              <li key={l.id} className="rounded-lg border border-secondary-200/80 bg-white/65 px-2 py-2">
                <Link
                  href={`/lesson-builder/${l.id}`}
                  onClick={onClose}
                  className="text-xs text-foreground hover:text-primary-900 hover:underline line-clamp-2 leading-relaxed"
                >
                  {l.title}
                </Link>
                <p className="text-xs text-muted mt-0.5">{l.gradeLevel} · {l.subject}</p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/lesson-builder"
          onClick={onClose}
          className="text-xs text-primary-900 hover:underline mt-2 inline-block"
        >
          Create a lesson →
        </Link>
      </Card>

      {/* Inspiration Highlights */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          ✨ Inspiration
        </h3>
        {!loadedInspiration ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-3 bg-secondary-100 rounded animate-pulse" />
            ))}
          </div>
        ) : inspirationItems.length === 0 ? (
          <p className="text-xs text-muted">No inspiration items yet.</p>
        ) : (
          <ul className="space-y-2">
            {inspirationItems.map((item) => (
              <li key={item.id} className="rounded-lg border border-secondary-200/80 bg-white/65 px-2 py-2">
                <Link
                  href={`/inspiration/${item.id}`}
                  onClick={onClose}
                  className="text-xs text-foreground hover:text-primary-900 hover:underline line-clamp-2 leading-relaxed"
                >
                  {cleanDisplayText(item.title) || "Untitled inspiration"}
                </Link>
                <p className="mt-0.5 text-[11px] font-medium text-muted">
                  Source: {cleanDisplayText(item.creator) || "Community"}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/inspiration"
          onClick={onClose}
          className="text-xs text-primary-900 hover:underline mt-2 inline-block"
        >
          Explore inspiration →
        </Link>
      </Card>

      {/* Quick Links */}
      <Card padding="md">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          Quick Links
        </h3>
        <ul className="space-y-1.5">
          {[
            { href: "/resources", label: "Browse Resources" },
            { href: "/lesson-builder", label: "Create a Lesson" },
            { href: "/forums", label: "Join a Discussion" },
            { href: "/jobs", label: "Find Jobs" },
          ].map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                onClick={onClose}
                className="text-sm text-muted hover:text-primary-900 transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mobile drawer button - rendered in the main layout on small screens
// ---------------------------------------------------------------------------

export function SidebarDrawerButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isLessonBuilderRoute = pathname?.startsWith("/lesson-builder") ?? false;
  const isDrawerVisible = open && !isLessonBuilderRoute;

  const handleClose = useCallback(() => setOpen(false), []);

  // Close on Escape
  useEffect(() => {
    if (!isDrawerVisible) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDrawerVisible]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isDrawerVisible ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isDrawerVisible]);

  // Hide on lesson-builder pages - they show their own AI floating button
  if (isLessonBuilderRoute) return null;

  return (
    <>
      {/* Toggle button - only visible on mobile */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open sidebar"
        className="xl:hidden fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary-900 text-white shadow-lg hover:bg-primary-800 transition-colors"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
        </svg>
      </button>

      {/* Backdrop */}
      {isDrawerVisible && (
        <div
          className="fixed inset-0 z-40 bg-black/40 xl:hidden"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sidebar"
        className={`fixed inset-y-0 right-0 z-50 w-80 max-w-full overflow-y-auto border-l border-primary-100 bg-linear-to-b from-secondary-50 via-background to-background shadow-2xl transition-transform duration-300 xl:hidden ${isDrawerVisible ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-primary-100 bg-surface/95 px-4 py-3 backdrop-blur">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400">
              VistaTeacher
            </p>
            <span className="text-base font-semibold text-foreground">Explore</span>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close sidebar"
            className="rounded-lg p-1 text-muted hover:bg-surface-hover hover:text-foreground transition-colors cursor-pointer"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4">
          <SidebarContents onClose={handleClose} />
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Default export - desktop aside (hidden on mobile)
// ---------------------------------------------------------------------------

export default function Sidebar() {
  return (
    <aside className="hidden xl:block w-72 shrink-0">
      <SidebarContents />
    </aside>
  );
}
