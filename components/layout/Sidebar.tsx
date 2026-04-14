"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { getPosts, type Post } from "@/lib/firestore/posts";

export default function Sidebar() {
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [loadedTrending, setLoadedTrending] = useState(false);

  useEffect(() => {
    getPosts()
      .then((result) => {
        // Show up to 5 discussion-type posts as "trending"
        const discussions = result.posts
          .filter((p) => p.type === "discussion")
          .slice(0, 5);
        setTrendingPosts(
          discussions.length > 0 ? discussions : result.posts.slice(0, 5)
        );
      })
      .catch(() => {})
      .finally(() => setLoadedTrending(true));
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
                <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                  {post.content}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {post.authorName} · {post.likesCount} likes
                </p>
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
        <p className="text-xs text-muted">No resources yet.</p>
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
        <p className="text-xs text-muted">No lessons yet.</p>
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
        <p className="text-xs text-muted">No inspiration items yet.</p>
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
