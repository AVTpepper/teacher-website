"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { type DocumentSnapshot } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { GRADE_LEVELS, SUBJECTS } from "@/lib/firestore/users";
import {
  getResources,
  resourceSlug,
  RESOURCE_TYPES,
  getAverageRating,
  type Resource,
  type ResourceFilters,
  type ResourceType,
  type ResourceSortBy,
} from "@/lib/firestore/resources";
import {
  Avatar,
  Badge,
  Button,
  Card,
  Input,
  Select,
} from "@/components/ui";

export default function ResourcesPage() {
  const { user } = useAuth();

  // Filters
  const [gradeLevel, setGradeLevel] = useState("");
  const [subject, setSubject] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [sortBy, setSortBy] = useState<ResourceSortBy>("newest");
  const [searchQuery, setSearchQuery] = useState("");

  // Data
  const [resources, setResources] = useState<Resource[]>([]);
  const [cursor, setCursor] = useState<DocumentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const filters: ResourceFilters = {
    gradeLevel: gradeLevel || undefined,
    subject: subject || undefined,
    type: (resourceType as ResourceType) || undefined,
    sortBy,
  };

  const fetchResources = useCallback(
    async (reset: boolean) => {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const result = await getResources(filters, reset ? null : cursor);

        setResources((prev) =>
          reset ? result.resources : [...prev, ...result.resources]
        );
        setCursor(result.lastDoc);
        setHasMore(result.lastDoc !== null);
      } catch (err) {
        console.error("getResources error:", err);
        setResources([]);
        setHasMore(false);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gradeLevel, subject, resourceType, sortBy, cursor]
  );

  // Re-fetch when filters change
  useEffect(() => {
    setCursor(null);
    fetchResources(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gradeLevel, subject, resourceType, sortBy]);

  // Client-side search filtering
  const displayed = searchQuery.trim()
    ? resources.filter(
        (r) =>
          r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          r.tags.some((t) =>
            t.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : resources;

  const hasFilters = gradeLevel || subject || resourceType;

  return (
    <div className="py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Resource Library
          </h1>
          <p className="mt-1 text-sm text-muted">
            Browse, share, and download teaching resources — lesson plans,
            worksheets, strategies, and more.
          </p>
        </div>
        {user && (
          <Link href="/resources/upload">
            <Button className="shrink-0">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Upload Resource
            </Button>
          </Link>
        )}
      </div>

      {/* Filters + Search */}
      <Card className="mb-8">
        <div className="flex flex-col gap-4">
          {/* Search */}
          <Input
            placeholder="Search resources by title, description, or tags…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={
              <svg
                className="h-4 w-4"
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
            }
          />

          {/* Filter row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Select
                label="Grade Level"
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                placeholder="All Grade Levels"
                options={GRADE_LEVELS.map((g) => ({ value: g, label: g }))}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="All Subjects"
                options={SUBJECTS.map((s) => ({ value: s, label: s }))}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Type"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
                placeholder="All Types"
                options={RESOURCE_TYPES.map((t) => ({
                  value: t.value,
                  label: t.label,
                }))}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Sort By"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as ResourceSortBy)}
                options={[
                  { value: "newest", label: "Newest" },
                  { value: "popular", label: "Most Popular" },
                ]}
              />
            </div>
            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGradeLevel("");
                  setSubject("");
                  setResourceType("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-20 text-center">
          <svg
            className="mx-auto h-12 w-12 text-secondary-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
            />
          </svg>
          <h3 className="mt-3 text-sm font-medium text-foreground">
            No resources found
          </h3>
          <p className="mt-1 text-xs text-muted">
            {hasFilters || searchQuery
              ? "Try adjusting your filters or search query."
              : "Be the first to share a resource!"}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
          </div>

          {hasMore && !searchQuery && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchResources(false)}
                isLoading={loadingMore}
              >
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// --- Resource card ---

function ResourceCard({ resource }: { resource: Resource }) {
  const avgRating = getAverageRating(resource);
  const typeLabel =
    RESOURCE_TYPES.find((t) => t.value === resource.type)?.label ??
    resource.type;

  return (
    <Link href={`/resources/${resourceSlug(resource.title, resource.id)}`}>
      <Card hoverable className="flex h-full flex-col">
        {/* Type badge */}
        <div className="mb-2 flex items-center justify-between">
          <Badge variant="primary">{typeLabel}</Badge>
          {avgRating > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <svg
                className="h-3.5 w-3.5 text-warning-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {avgRating.toFixed(1)}
            </span>
          )}
        </div>

        {/* Title + description */}
        <h3 className="font-semibold text-foreground line-clamp-2">
          {resource.title}
        </h3>
        <p className="mt-1 text-xs text-muted line-clamp-2">
          {resource.description}
        </p>

        {/* Tags */}
        {resource.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {resource.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
            {resource.tags.length > 3 && (
              <span className="text-xs text-muted">
                +{resource.tags.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Meta */}
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Avatar
              src={resource.authorPhotoURL}
              alt={resource.authorName}
              size="sm"
            />
            <span className="text-xs text-muted truncate max-w-30">
              {resource.authorName}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                />
              </svg>
              {resource.downloadCount}
            </span>
            <span className="flex items-center gap-1">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
                />
              </svg>
              {resource.savedByCount}
            </span>
          </div>
        </div>

        {/* Grade + Subject footer */}
        <div className="mt-2 flex items-center gap-2 text-xs text-muted">
          {resource.gradeLevel && (
            <span className="truncate">{resource.gradeLevel}</span>
          )}
          {resource.gradeLevel && resource.subject && <span>·</span>}
          {resource.subject && (
            <span className="truncate">{resource.subject}</span>
          )}
        </div>
      </Card>
    </Link>
  );
}
