"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  collection,
  collectionGroup,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListSkeleton,
  PageContainer,
  SearchResultCard,
  Section,
  SectionHeader,
} from "@/components/ui";
import { db } from "@/lib/firebase";
import { resourceSlug, type Resource } from "@/lib/firestore/resources";
import { jobSlug, type Job } from "@/lib/firestore/jobs";
import { threadSlug, type ForumThread } from "@/lib/firestore/forums";
import { type Lesson } from "@/lib/firestore/lessons";
import { type UserProfile } from "@/lib/firestore/users";
import HorizontalScrollHint from "@/components/ui/HorizontalScrollHint";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = "all" | "educators" | "resources" | "discussions" | "lessons" | "jobs";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "🔍" },
  { id: "educators", label: "Educators", icon: "👩‍🏫" },
  { id: "resources", label: "Resources", icon: "📂" },
  { id: "discussions", label: "Discussions", icon: "💬" },
  { id: "lessons", label: "Lessons", icon: "📝" },
  { id: "jobs", label: "Jobs", icon: "💼" },
];

interface SearchResults {
  educators: UserProfile[];
  resources: Resource[];
  discussions: ForumThread[];
  lessons: Lesson[];
  jobs: Job[];
}

// ---------------------------------------------------------------------------
// Firestore prefix-range search helper
// ---------------------------------------------------------------------------
// Firestore has no native full-text search. We use a prefix-range query
// on a lowercase title/displayName field and then client-filter for the
// substring. This works well for short queries. Algolia/Typesense is the
// recommended upgrade path for production full-text search.

async function prefixQuery<T>(
  collectionName: string,
  field: string,
  term: string,
  pageSize: number
): Promise<T[]> {
  if (!db) return [];
  const lower = term.toLowerCase();
  const upper = lower + "\uf8ff";
  const q = query(
    collection(db, collectionName),
    where(field, ">=", lower),
    where(field, "<=", upper),
    orderBy(field),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

async function prefixQueryGroup<T>(
  groupName: string,
  field: string,
  term: string,
  pageSize: number
): Promise<T[]> {
  if (!db) return [];
  const lower = term.toLowerCase();
  const upper = lower + "\uf8ff";
  const q = query(
    collectionGroup(db, groupName),
    where(field, ">=", lower),
    where(field, "<=", upper),
    orderBy(field),
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as T));
}

async function runSearch(rawQuery: string): Promise<SearchResults> {
  const term = rawQuery.trim().toLowerCase();
  if (!term) return { educators: [], resources: [], discussions: [], lessons: [], jobs: [] };

  const [educators, resources, discussions, lessons, jobs] = await Promise.all([
    prefixQuery<UserProfile>("users", "displayNameLower", term, 8),
    prefixQuery<Resource>("resources", "titleLower", term, 8),
    prefixQueryGroup<ForumThread>("threads", "title", term, 8),
    prefixQuery<Lesson>("lessons", "titleLower", term, 8),
    prefixQuery<Job>("jobs", "title", term, 8),
  ]);

  // Client-side substring filter so partial-word matches work too
  const sub = (val: string) => val.toLowerCase().includes(term);

  return {
    educators: educators.filter((u) => sub(u.displayName)),
    resources: resources.filter((r) => sub(r.title)),
    discussions: discussions.filter((t) => sub(t.title)),
    lessons: lessons.filter((l) => sub(l.title)),
    jobs: jobs.filter((j) => sub(j.title)),
  };
}

// ---------------------------------------------------------------------------
// Result card components
// ---------------------------------------------------------------------------

function EducatorResult({ user }: { user: UserProfile }) {
  const subtitle =
    user.professionalHeadline?.trim() || user.professionalRole?.trim() || user.gradeLevel || "Educator";

  const meta = [user.professionalRole?.trim(), user.country?.trim()]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/educators/${user.uid}`} className="block group">
      <Card className="hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <Avatar src={user.photoURL ?? null} alt={user.displayName} size="md" />
          <div className="min-w-0">
            <p className="font-semibold text-foreground group-hover:underline truncate">{user.displayName}</p>
            <p className="text-xs text-muted truncate">{subtitle}</p>
            {meta && <p className="text-xs text-muted truncate">{meta}</p>}
            <div className="flex flex-wrap gap-1 mt-1">
              {user.subjects?.slice(0, 3).map((s) => (
                <Badge key={s} variant="default">{s}</Badge>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}

function ResourceResult({ resource }: { resource: Resource }) {
  return (
    <SearchResultCard
      href={`/resources/${resourceSlug(resource.title, resource.id)}`}
      title={resource.title}
      subtitle={resource.description}
      icon="📂"
      badges={<><Badge variant="default">{resource.gradeLevel}</Badge><Badge variant="default">{resource.subject}</Badge></>}
    />
  );
}

function DiscussionResult({ thread }: { thread: ForumThread }) {
  return (
    <SearchResultCard
      href={`/forums/${threadSlug(thread.title, thread.id)}`}
      title={thread.title}
      subtitle={`by ${thread.authorName}`}
      icon="💬"
      badges={
        <>
          {thread.gradeLevel && <Badge variant="default">{thread.gradeLevel}</Badge>}
          {thread.subject && <Badge variant="default">{thread.subject}</Badge>}
        </>
      }
    />
  );
}

function LessonResult({ lesson }: { lesson: Lesson }) {
  return (
    <SearchResultCard
      href={`/lesson-builder/${lesson.id}`}
      title={lesson.title}
      subtitle={`by ${lesson.authorName}`}
      icon="📝"
      badges={<><Badge variant="default">{lesson.gradeLevel}</Badge><Badge variant="default">{lesson.subject}</Badge></>}
    />
  );
}

function JobResult({ job }: { job: Job }) {
  return (
    <SearchResultCard
      href={`/jobs/${jobSlug(job.title, job.id)}`}
      title={job.title}
      subtitle={`${job.organization} · ${job.location}`}
      icon="💼"
      badges={<><Badge variant="default">{job.gradeLevel}</Badge><Badge variant="default">{job.jobType}</Badge></>}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner search page (needs useSearchParams - must be inside Suspense)
// ---------------------------------------------------------------------------

function SearchInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";

  const [inputValue, setInputValue] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState<TabId>("all");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const doSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults(null);
      setSearchError(null);
      return;
    }
    setLoading(true);
    setSearchError(null);
    try {
      const res = await runSearch(trimmed);
      setResults(res);
    } catch (err) {
      console.error(err);
      setResults({ educators: [], resources: [], discussions: [], lessons: [], jobs: [] });
      setSearchError("We could not load search results right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Run search whenever URL query param changes
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setInputValue(q);
    setActiveTab("all");
    doSearch(q);
  }, [searchParams, doSearch]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    }
  }

  const totalCount = results
    ? results.educators.length +
      results.resources.length +
      results.discussions.length +
      results.lessons.length +
      results.jobs.length
    : 0;

  const tabCount: Record<TabId, number> = {
    all: totalCount,
    educators: results?.educators.length ?? 0,
    resources: results?.resources.length ?? 0,
    discussions: results?.discussions.length ?? 0,
    lessons: results?.lessons.length ?? 0,
    jobs: results?.jobs.length ?? 0,
  };

  const showEducators = activeTab === "all" || activeTab === "educators";
  const showResources = activeTab === "all" || activeTab === "resources";
  const showDiscussions = activeTab === "all" || activeTab === "discussions";
  const showLessons = activeTab === "all" || activeTab === "lessons";
  const showJobs = activeTab === "all" || activeTab === "jobs";

  return (
    <PageContainer width="wide" className="space-y-6 pb-8">
      {/* Search box */}
      <div className="surface-panel -mx-4 -mt-4 overflow-hidden rounded-t-2xl border border-primary-700/30 bg-linear-to-r from-primary-900 via-primary-800 to-primary-900 p-6 text-primary-50 sm:-mx-6 sm:-mt-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-300">Explore</p>
        <h1 className="text-2xl font-bold mb-3">Search</h1>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Search educators, resources, communities, lessons, jobs…"
            />
          </div>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? "…" : "Search"}
          </Button>
        </form>
      </div>

      {/* No query yet */}
      {!initialQuery && !loading && results === null && (
        <EmptyState
          icon="🔍"
          title="What are you looking for?"
          description="Search across educators, resources, communities discussions, lesson plans, and jobs."
          actionLabel="Create Account"
          onAction={() => router.push("/auth/signup?redirect=/search")}
        />
      )}

      {/* Loading */}
      {loading && (
        <ListSkeleton rows={4} />
      )}

      {searchError && !loading && <ErrorState message={searchError} onRetry={() => doSearch(initialQuery)} />}

      {/* Results */}
      {!loading && results !== null && (
        <>
          {/* Tab bar */}
          <HorizontalScrollHint
            innerClassName="flex gap-1 border-b border-border"
            role="tablist"
            nudgeKey="search-tabs"
          >
            {TABS.map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tabCount[tab.id] > 0 && (
                  <span className="ml-1 text-xs bg-secondary-100 text-muted px-1.5 py-0.5 rounded-full">
                    {tabCount[tab.id]}
                  </span>
                )}
              </button>
            ))}
          </HorizontalScrollHint>

          {/* Zero results */}
          {totalCount === 0 && (
            <EmptyState
              icon="😔"
              title="No results found"
              description={`No matches for “${initialQuery}”. Try a different search term.`}
              actionLabel="Try a broader search"
              onAction={() => setInputValue("")}
            />
          )}

          {/* Filtered empty (tab has 0, but others have results) */}
          {totalCount > 0 && tabCount[activeTab] === 0 && activeTab !== "all" && (
            <EmptyState
              icon="🧭"
              title={`No ${activeTab} results`}
              description="Try another tab to explore all matching content types."
              actionLabel="Show all results"
              onAction={() => setActiveTab("all")}
            />
          )}

          <div className="space-y-8">
            {/* Educators */}
            {showEducators && results.educators.length > 0 && (
              <Section>
                <SectionHeader title="Educators" description={`${results.educators.length} results`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.educators.map((u) => (
                    <EducatorResult key={u.uid} user={u} />
                  ))}
                </div>
              </Section>
            )}

            {/* Resources */}
            {showResources && results.resources.length > 0 && (
              <Section>
                <SectionHeader title="Resources" description={`${results.resources.length} results`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.resources.map((r) => (
                    <ResourceResult key={r.id} resource={r} />
                  ))}
                </div>
              </Section>
            )}

            {/* Discussions */}
            {showDiscussions && results.discussions.length > 0 && (
              <Section>
                <SectionHeader title="Discussions" description={`${results.discussions.length} results`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.discussions.map((t) => (
                    <DiscussionResult key={t.id} thread={t} />
                  ))}
                </div>
              </Section>
            )}

            {/* Lessons */}
            {showLessons && results.lessons.length > 0 && (
              <Section>
                <SectionHeader title="Lessons" description={`${results.lessons.length} results`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.lessons.map((l) => (
                    <LessonResult key={l.id} lesson={l} />
                  ))}
                </div>
              </Section>
            )}

            {/* Jobs */}
            {showJobs && results.jobs.length > 0 && (
              <Section>
                <SectionHeader title="Jobs" description={`${results.jobs.length} results`} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {results.jobs.map((j) => (
                    <JobResult key={j.id} job={j} />
                  ))}
                </div>
              </Section>
            )}
          </div>
        </>
      )}
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// Page export - wraps inner in Suspense (required for useSearchParams)
// ---------------------------------------------------------------------------

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="py-20 text-center text-sm text-muted">Loading search…</div>
    }>
      <SearchInner />
    </Suspense>
  );
}

