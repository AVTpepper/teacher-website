"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Footer from "@/components/layout/Footer";
import {
  BookOpen,
  Sparkles,
  MessageSquare,
  FolderOpen,
  Users,
  Crown,
  Check,
} from "lucide-react";
import { getPosts, type Post } from "@/lib/firestore/posts";
import { getPublicLessons, type Lesson } from "@/lib/firestore/lessons";

const features = [
  {
    Icon: BookOpen,
    title: "Lesson Builder",
    description:
      "Design rich, structured lesson plans with objectives, materials, and guided activities in one place.",
  },
  {
    Icon: Sparkles,
    title: "AI Assistant",
    description:
      "Generate a complete lesson plan from a single topic prompt, or get targeted suggestions for any section in seconds.",
  },
  {
    Icon: MessageSquare,
    title: "Forums",
    description:
      "Ask questions, swap strategies, and connect with educators who truly understand the classroom.",
  },
  {
    Icon: FolderOpen,
    title: "Resource Library",
    description:
      "Upload, discover, and share worksheets, slide decks, and teaching materials with the whole community.",
  },
  {
    Icon: Users,
    title: "Community",
    description:
      "Follow educators you admire, bookmark their best work, and build a professional learning network.",
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function timeAgoFromSeconds(seconds: number | null | undefined): string {
  if (!seconds) return "Recently";
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return `${Math.floor(diff / 604800)}w ago`;
}

interface HighlightCard {
  key: string;
  kind: "post" | "lesson";
  title: string;
  excerpt: string;
  authorName: string;
  createdSeconds: number | null;
  badgeLabel: string;
  badgeClass: string;
  metaChips?: string[];
  statLeft: string;
  statRight: string;
}

const POST_RECENCY_WINDOW_DAYS = 60;
const POST_SCORE_HALF_LIFE_DAYS = 15;

function getRecencyWeightedPostScore(post: Post, nowSeconds: number): number {
  const createdSeconds = post.createdAt?.seconds ?? 0;
  if (!createdSeconds) return 0;

  const ageDays = Math.max(0, (nowSeconds - createdSeconds) / 86400);
  if (ageDays > POST_RECENCY_WINDOW_DAYS) return 0;

  const interactionScore = post.likesCount + post.commentCount * 2;
  const decay = Math.exp((-Math.log(2) * ageDays) / POST_SCORE_HALF_LIFE_DAYS);
  return interactionScore * decay;
}

export default function LandingPage() {
  const [topPosts, setTopPosts] = useState<Post[]>([]);
  const [topLessons, setTopLessons] = useState<Lesson[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadHighlights() {
      setLoadingHighlights(true);
      try {
        const nowSeconds = Math.floor(Date.now() / 1000);
        const collectedPosts: Post[] = [];
        const collectedLessons: Lesson[] = [];

        // Fetch posts independently so a lesson query issue doesn't blank both sections.
        try {
          let cursor: Parameters<typeof getPosts>[0] = null;
          for (let i = 0; i < 5; i += 1) {
            const result = await getPosts(cursor, null);
            collectedPosts.push(...result.posts);
            cursor = result.lastDoc;
            if (!cursor) break;
          }
        } catch {
          // Keep rendering with whatever data is available.
        }

        // Use newest sort (index-safe) and rank lessons client-side.
        try {
          let lessonCursor: Parameters<typeof getPublicLessons>[1] = null;
          for (let i = 0; i < 4; i += 1) {
            const lessonPage = await getPublicLessons({ sortBy: "newest" }, lessonCursor, 12);
            collectedLessons.push(...lessonPage.lessons);
            lessonCursor = lessonPage.lastDoc;
            if (!lessonCursor) break;
          }
        } catch {
          // Keep rendering with whatever data is available.
        }

        const recentPosts = collectedPosts.filter((post) => {
          const createdSeconds = post.createdAt?.seconds ?? 0;
          if (!createdSeconds) return false;
          const ageDays = Math.max(0, (nowSeconds - createdSeconds) / 86400);
          return ageDays <= POST_RECENCY_WINDOW_DAYS;
        });

        const postPool = recentPosts.length > 0 ? recentPosts : collectedPosts;

        const rankedPosts = postPool
          .filter((post) => {
            const createdSeconds = post.createdAt?.seconds ?? 0;
            return Boolean(createdSeconds);
          })
          .sort((a, b) => {
            const scoreA = getRecencyWeightedPostScore(a, nowSeconds);
            const scoreB = getRecencyWeightedPostScore(b, nowSeconds);
            if (scoreA !== scoreB) return scoreB - scoreA;
            const interactionA = a.likesCount + a.commentCount * 2;
            const interactionB = b.likesCount + b.commentCount * 2;
            if (interactionA !== interactionB) return interactionB - interactionA;
            return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
          })
          .slice(0, 2);

        const rankedLessons = collectedLessons
          .filter((lesson) => lesson.isPublic)
          .sort((a, b) => {
            if ((b.ratingAverage ?? 0) !== (a.ratingAverage ?? 0)) {
              return (b.ratingAverage ?? 0) - (a.ratingAverage ?? 0);
            }
            if ((b.ratingCount ?? 0) !== (a.ratingCount ?? 0)) {
              return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
            }
            return (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0);
          })
          .slice(0, 2);

        if (!cancelled) {
          setTopPosts(rankedPosts);
          setTopLessons(rankedLessons);
        }
      } catch {
        if (!cancelled) {
          // Only hard-fail to empty if unexpected errors escape the guarded blocks above.
          setTopPosts([]);
          setTopLessons([]);
        }
      } finally {
        if (!cancelled) setLoadingHighlights(false);
      }
    }

    void loadHighlights();

    return () => {
      cancelled = true;
    };
  }, []);

  const highlights = useMemo<HighlightCard[]>(() => {
    const postCards: HighlightCard[] = topPosts.map((post) => ({
      key: `post-${post.id}`,
      kind: "post",
      title: post.content.split("\n")[0].slice(0, 90) || "Community post",
      excerpt: post.content,
      authorName: post.authorName || "Educator",
      createdSeconds: post.createdAt?.seconds ?? null,
      badgeLabel: post.type === "discussion" ? "Discussion" : "Community Post",
      badgeClass:
        post.type === "discussion"
          ? "bg-warning-50 text-warning-700"
          : "bg-info-50 text-info-700",
      statLeft: `❤️ ${post.likesCount} likes`,
      statRight: `💬 ${post.commentCount} comments`,
    }));

    const lessonCards: HighlightCard[] = topLessons.map((lesson) => ({
      key: `lesson-${lesson.id}`,
      kind: "lesson",
      title: lesson.title || "Top-rated lesson",
      excerpt: lesson.objectives?.[0] || "High-quality lesson plan from the community.",
      authorName: lesson.authorName || "Educator",
      createdSeconds: lesson.createdAt?.seconds ?? null,
      badgeLabel: "Top Rated Lesson",
      badgeClass: "bg-success-50 text-success-700",
      metaChips: [lesson.gradeLevel, lesson.subject].filter(Boolean),
      statLeft: `⭐ ${(lesson.ratingAverage ?? 0).toFixed(1)} / 5`,
      statRight: `🧑‍🏫 ${lesson.ratingCount ?? 0} ratings`,
    }));

    return [...postCards, ...lessonCards].slice(0, 4);
  }, [topPosts, topLessons]);

  return (
    <div className="flex min-h-screen flex-col">
      <section
        className="relative bg-primary-900 text-white"
        aria-labelledby="hero-heading"
      >
        <div
          className="absolute inset-0 bg-linear-to-br from-primary-950 via-primary-900 to-primary-800 opacity-90"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 py-20 sm:py-28 lg:py-36 text-center">
          <p className="mb-4 text-sm font-semibold tracking-widest uppercase text-accent-300">
            Welcome to TeacherlyConnect
          </p>

          <h1
            id="hero-heading"
            className="text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl"
          >
            Where Great Teachers <span className="text-accent-400">Connect</span>
          </h1>

          <p className="mt-6 mx-auto max-w-xl text-lg text-white/80 leading-relaxed">
            Plan better lessons, share resources, swap ideas, and grow
            alongside a community of educators who love what they do.
          </p>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-base font-semibold text-primary-900 shadow-sm transition-colors hover:bg-accent-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white min-h-11 min-w-11"
            >
              Get Started
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center rounded-lg border-2 border-white/70 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white min-h-11 min-w-11"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      <section
        className="bg-background py-16 sm:py-20"
        aria-labelledby="features-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              id="features-heading"
              className="text-3xl font-bold text-foreground sm:text-4xl"
            >
              Everything you need, in one place
            </h2>
            <p className="mt-4 text-base text-muted max-w-xl mx-auto">
              From early lesson plan drafts to professional connections,
              TeacherlyConnect has you covered.
            </p>
          </div>

          <ul
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
            role="list"
          >
            {features.map(({ Icon, title, description }) => (
              <li
                key={title}
                className="rounded-xl border border-border bg-surface p-6 shadow-sm"
              >
                <div
                  className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary-50 text-primary-900"
                  aria-hidden="true"
                >
                  <Icon size={22} strokeWidth={1.8} />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {title}
                </h3>
                <p className="mt-2 text-sm text-muted leading-relaxed">
                  {description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        className="bg-secondary-50 py-16 sm:py-20"
        aria-labelledby="social-proof-heading"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2
              id="social-proof-heading"
              className="text-3xl font-bold text-foreground sm:text-4xl"
            >
              See what educators are sharing
            </h2>
            <p className="mt-4 text-base text-muted max-w-xl mx-auto">
              Live highlights pulled from the community: most interacted posts in the last 60 days and highest-rated lessons.
            </p>
          </div>

          {loadingHighlights ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border border-border bg-surface p-5 shadow-sm animate-pulse">
                  <div className="h-4 w-2/3 bg-secondary-100 rounded mb-3" />
                  <div className="h-3 w-full bg-secondary-100 rounded mb-2" />
                  <div className="h-3 w-5/6 bg-secondary-100 rounded mb-4" />
                  <div className="h-3 w-1/2 bg-secondary-100 rounded" />
                </div>
              ))}
            </div>
          ) : highlights.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted">
              Community highlights are loading up. Check back soon.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {highlights.map((card) => (
                <div key={card.key} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                          card.kind === "lesson"
                            ? "bg-success-50 text-success-700"
                            : "bg-primary-100 text-primary-900"
                        }`}
                        aria-hidden="true"
                      >
                        {initials(card.authorName)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {card.authorName}
                        </p>
                        <p className="text-xs text-muted">{timeAgoFromSeconds(card.createdSeconds)}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${card.badgeClass}`}>
                      {card.badgeLabel}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-foreground mb-2 line-clamp-2">
                    {card.title}
                  </h3>

                  {card.metaChips && card.metaChips.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-3">
                      {card.metaChips.map((chip) => (
                        <span
                          key={`${card.key}-${chip}`}
                          className="inline-flex items-center rounded-md bg-secondary-100 px-2 py-0.5 text-xs text-secondary-700"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-sm text-muted line-clamp-3">{card.excerpt}</p>

                  <div className="mt-4 flex items-center gap-4 text-xs text-muted">
                    <span>{card.statLeft}</span>
                    <span>{card.statRight}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="bg-background py-16 sm:py-20" aria-labelledby="tiers-heading">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 id="tiers-heading" className="text-3xl font-bold text-foreground sm:text-4xl">
              Free vs Plus
            </h2>
            <p className="mt-3 text-base text-muted max-w-2xl mx-auto">
              Start free, then upgrade when you want more AI power and advanced planning controls.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Free</h3>
                  <p className="mt-1 text-sm font-medium text-muted">$0 / month</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-secondary-100 px-3 py-1 text-xs font-semibold text-secondary-800">
                  Starter
                </span>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-muted">
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success-700" />Create, share, and discover resources and lessons</li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success-700" />10 AI lesson generation requests per day</li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success-700" />Community posts, forums, and inspiration hub access</li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success-700" />Monthly AI refine cap for free accounts</li>
              </ul>
            </div>

            <div className="rounded-xl border border-accent-300 bg-surface p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Plus</h3>
                  <p className="mt-1 text-sm font-medium text-muted">$9 / month</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent-100 px-3 py-1 text-xs font-semibold text-accent-800">
                  <Crown className="h-3.5 w-3.5" />
                  Recommended
                </span>
              </div>
              <ul className="mt-5 space-y-3 text-sm text-muted">
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success-700" />Unlimited daily AI lesson generation requests</li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success-700" />Advanced AI controls: grade override + additional context</li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success-700" />No free-tier usage meter interruptions</li>
                <li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-success-700" />Built for heavier planning and daily AI workflows</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-lg bg-primary-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-800"
            >
              Start Free
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
