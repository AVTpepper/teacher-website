"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { getPosts, type Post } from "@/lib/firestore/posts";
import { getResources, type Resource } from "@/lib/firestore/resources";
import { getPublicLessons, type Lesson } from "@/lib/firestore/lessons";
import { getInspirationItems, type InspirationItem } from "@/lib/firestore/inspiration";

export default function Sidebar() {
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

    getPublicLessons({}, null)
      .then((result) => setFeaturedLessons(result.lessons.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoadedLessons(true));

    getInspirationItems({}, 3)
      .then((result) => setInspirationItems(result.items))
      .catch(() => {})
      .finally(() => setLoadedInspiration(true));
  }, []);

  return (
    <aside className="hidden lg:block w-72 shrink-0 space-y-4">
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
                  className="group block rounded-md hover:bg-surface-hover transition-colors -mx-1 px-1 py-0.5"
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
              <li key={r.id}>
                <Link
                  href={`/resources/${r.id}`}
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
              <li key={l.id}>
                <Link
                  href={`/lesson-builder/${l.id}`}
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
              <li key={item.id}>
                <a
                  href={item.sourceURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-foreground hover:text-primary-900 hover:underline line-clamp-2 leading-relaxed"
                >
                  {item.title}
                </a>
                <p className="text-xs text-muted mt-0.5">{item.creator}</p>
              </li>
            ))}
          </ul>
        )}
        <Link
          href="/inspiration"
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
                className="text-sm text-muted hover:text-primary-900 transition-colors"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </aside>
  );
}
