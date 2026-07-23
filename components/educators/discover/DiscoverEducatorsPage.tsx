"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import DiscoveryShell from "@/components/layout/DiscoveryShell";
import DiscoverEducatorCard from "@/components/educators/discover/DiscoverEducatorCard";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Select,
  Skeleton,
} from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import {
  followUser,
  getUser,
  unfollowUser,
  type UserProfile,
  SUBJECTS,
} from "@/lib/firestore/users";
import { GRADE_LEVELS } from "@/lib/constants";
import { COUNTRIES, CURRICULA, PROFESSIONAL_ROLES, computeProfileCompletion } from "@/lib/onboarding";
import {
  DEFAULT_DISCOVER_QUERY_STATE,
  hasActiveDiscoverFilters,
  parseDiscoverQueryState,
  stateWithResetPage,
  toDiscoverQueryString,
  type DiscoverQueryState,
  type DiscoverSort,
} from "@/lib/discover/queryState";
import {
  dedupeEducatorCandidates,
  isRecommendationEligible,
  rankRecommendedEducators,
} from "@/lib/discover/recommendations";
import {
  getDiscoverCandidatePool,
  getNewestDiscoverEducators,
  type DiscoverSearchFilters,
} from "@/lib/discover/search";
import { getSharedContextReasons } from "@/lib/profile/sharedContext";
import { notifyNewFollower } from "@/lib/notifications";
import {
  ConnectionClientError,
  fetchConnectionQuota,
  fetchConnectionStatuses,
  sendConnectionRequest as sendConnectionRequestApi,
} from "@/lib/network/client";
import type { ConnectionQuotaSummary, ConnectionRelationshipState, ConnectionRequestReason } from "@/lib/network/types";

const PAGE_SIZE = 12;
const CANDIDATE_POOL_LIMIT = 180;
const RECOMMENDATION_POOL_LIMIT = 120;
const NEW_SECTION_LIMIT = 6;

const SORT_OPTIONS: Array<{ value: DiscoverSort; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name A-Z" },
];

interface FollowState {
  ids: Set<string>;
  loadingIds: Set<string>;
}

interface ConnectionState {
  byEducatorId: Map<string, ConnectionRelationshipState>;
  loadingIds: Set<string>;
}

function createdAtSeconds(profile: UserProfile): number {
  const createdAt = profile.createdAt as { seconds?: number } | null | undefined;
  return createdAt?.seconds ?? 0;
}

function toFilters(state: DiscoverQueryState): DiscoverSearchFilters {
  return {
    q: state.q.trim(),
    role: state.role,
    subject: state.subject,
    grade: state.grade,
    curriculum: state.curriculum,
    country: state.country,
    sort: state.sort,
  };
}

function educatorHasProfessionalContext(educator: UserProfile): boolean {
  return Boolean(
    educator.displayName?.trim() &&
      ((educator.subjects?.length ?? 0) > 0 ||
        educator.professionalRole?.trim() ||
        educator.professionalHeadline?.trim()),
  );
}

function sortByNameThenNewest(profiles: UserProfile[]): UserProfile[] {
  return [...profiles].sort((a, b) => {
    const nameDiff = a.displayName.localeCompare(b.displayName);
    if (nameDiff !== 0) return nameDiff;
    return createdAtSeconds(b) - createdAtSeconds(a);
  });
}

function applySort(
  profiles: UserProfile[],
  sort: DiscoverSort,
  viewerProfile: UserProfile | null,
): UserProfile[] {
  if (sort === "name") return sortByNameThenNewest(profiles);

  if (sort === "recommended" && viewerProfile && isRecommendationEligible(viewerProfile)) {
    const ranked = rankRecommendedEducators(viewerProfile, profiles, {
      maxResults: profiles.length,
    }).map((item) => item.educator);

    const rankedSet = new Set(ranked.map((profile) => profile.uid));
    const remainder = profiles.filter((profile) => !rankedSet.has(profile.uid));
    const newestRemainder = [...remainder].sort((a, b) => createdAtSeconds(b) - createdAtSeconds(a));
    return [...ranked, ...newestRemainder];
  }

  return [...profiles].sort((a, b) => createdAtSeconds(b) - createdAtSeconds(a));
}

function activeFilterChips(state: DiscoverQueryState): Array<{ key: keyof DiscoverQueryState; label: string }> {
  const chips: Array<{ key: keyof DiscoverQueryState; label: string }> = [];
  if (state.role) chips.push({ key: "role", label: state.role });
  if (state.subject) chips.push({ key: "subject", label: state.subject });
  if (state.grade) chips.push({ key: "grade", label: state.grade });
  if (state.curriculum) chips.push({ key: "curriculum", label: state.curriculum });
  if (state.country) chips.push({ key: "country", label: state.country });
  if (state.q) chips.push({ key: "q", label: `Search: ${state.q}` });
  return chips;
}

export default function DiscoverEducatorsPage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const queryState = useMemo(
    () => parseDiscoverQueryState(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const [searchDraft, setSearchDraft] = useState(queryState.q);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const [viewerProfile, setViewerProfile] = useState<UserProfile | null>(null);
  const [allEducators, setAllEducators] = useState<UserProfile[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [resultsError, setResultsError] = useState<string | null>(null);

  const [recommended, setRecommended] = useState<Array<{ educator: UserProfile; reasons: string[]; matchLabel: string }>>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);

  const [newEducators, setNewEducators] = useState<UserProfile[]>([]);
  const [newSectionError, setNewSectionError] = useState<string | null>(null);

  const [followState, setFollowState] = useState<FollowState>({ ids: new Set(), loadingIds: new Set() });
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    byEducatorId: new Map(),
    loadingIds: new Set(),
  });
  const [connectionQuota, setConnectionQuota] = useState<ConnectionQuotaSummary | null>(null);

  const latestResultsRequestRef = useRef(0);
  const latestRecommendationsRequestRef = useRef(0);

  useEffect(() => {
    Promise.resolve().then(() => {
      setSearchDraft(queryState.q);
    });
  }, [queryState.q]);

  const setUrlState = useCallback(
    (nextState: DiscoverQueryState, mode: "push" | "replace" = "push") => {
      const url = `${pathname}${toDiscoverQueryString(nextState)}`;
      if (mode === "replace") {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [pathname, router],
  );

  const updateQueryState = useCallback(
    (updates: Partial<DiscoverQueryState>, mode: "push" | "replace" = "push") => {
      const next = stateWithResetPage(queryState, updates);
      setUrlState(next, mode);
    },
    [queryState, setUrlState],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchDraft === queryState.q) return;
      updateQueryState({ q: searchDraft }, "replace");
    }, 350);

    return () => clearTimeout(timer);
  }, [searchDraft, queryState.q, updateQueryState]);

  useEffect(() => {
    let cancelled = false;

    if (!user?.uid) {
      Promise.resolve().then(() => {
        if (!cancelled) setViewerProfile(null);
      });
      return;
    }

    getUser(user.uid)
      .then((profile) => {
        if (!cancelled) setViewerProfile(profile);
      })
      .catch(() => {
        if (!cancelled) setViewerProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setConnectionQuota(null);
      return;
    }

    user
      .getIdToken()
      .then((token) => fetchConnectionQuota(() => Promise.resolve(token)))
      .then((quota) => {
        if (!cancelled) setConnectionQuota(quota);
      })
      .catch(() => {
        if (!cancelled) setConnectionQuota(null);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    if (!user?.uid || !db) {
      Promise.resolve().then(() => {
        if (!cancelled) setFollowState({ ids: new Set(), loadingIds: new Set() });
      });
      return;
    }

    getDocs(collection(db, "users", user.uid, "following"))
      .then((snapshot) => {
        if (cancelled) return;
        setFollowState((current) => ({
          ...current,
          ids: new Set(snapshot.docs.map((docSnap) => docSnap.id)),
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setFollowState((current) => ({ ...current, ids: new Set() }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  useEffect(() => {
    const requestId = latestResultsRequestRef.current + 1;
    latestResultsRequestRef.current = requestId;

    async function loadDiscoverResults() {
      setLoadingResults(true);
      setResultsError(null);

      try {
        const profiles = await getDiscoverCandidatePool(toFilters(queryState), CANDIDATE_POOL_LIMIT);
        if (latestResultsRequestRef.current !== requestId) return;
        const deduped = dedupeEducatorCandidates(profiles).filter(educatorHasProfessionalContext);
        setAllEducators(applySort(deduped, queryState.sort, viewerProfile));
      } catch {
        if (latestResultsRequestRef.current !== requestId) return;
        setAllEducators([]);
        setResultsError("We could not load educators right now. Please try again.");
      } finally {
        if (latestResultsRequestRef.current !== requestId) return;
        setLoadingResults(false);
      }
    }

    void loadDiscoverResults();
  }, [queryState, viewerProfile]);

  useEffect(() => {
    const requestId = latestRecommendationsRequestRef.current + 1;
    latestRecommendationsRequestRef.current = requestId;

    async function loadRecommendations() {
      if (!user || !viewerProfile || !isRecommendationEligible(viewerProfile)) {
        setRecommended([]);
        setRecommendationsError(null);
        setRecommendationsLoading(false);
        return;
      }

      setRecommendationsLoading(true);
      setRecommendationsError(null);

      try {
        const profiles = await getDiscoverCandidatePool(
          {
            q: "",
            role: "",
            subject: "",
            grade: "",
            curriculum: "",
            country: "",
            sort: "newest",
          },
          RECOMMENDATION_POOL_LIMIT,
        );

        if (latestRecommendationsRequestRef.current !== requestId) return;

        const ranked = rankRecommendedEducators(viewerProfile, profiles, {
          maxResults: 8,
          excludeUserIds: new Set([viewerProfile.uid]),
        });

        setRecommended(
          ranked.map((item) => ({
            educator: item.educator,
            reasons: item.reasons.map((reason) => reason.label),
            matchLabel: item.matchLabel,
          })),
        );
      } catch {
        if (latestRecommendationsRequestRef.current !== requestId) return;
        setRecommended([]);
        setRecommendationsError("Recommendations are temporarily unavailable.");
      } finally {
        if (latestRecommendationsRequestRef.current !== requestId) return;
        setRecommendationsLoading(false);
      }
    }

    void loadRecommendations();
  }, [user, viewerProfile]);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setConnectionState({ byEducatorId: new Map(), loadingIds: new Set() });
      return;
    }

    const ids = new Set<string>();
    allEducators.forEach((educator) => {
      if (educator.uid !== user.uid) ids.add(educator.uid);
    });
    newEducators.forEach((educator) => {
      if (educator.uid !== user.uid) ids.add(educator.uid);
    });
    recommended.forEach((entry) => {
      if (entry.educator.uid !== user.uid) ids.add(entry.educator.uid);
    });

    const targetUids = Array.from(ids);
    if (targetUids.length === 0) return;

    user
      .getIdToken()
      .then((token) => fetchConnectionStatuses(() => Promise.resolve(token), targetUids))
      .then((statuses) => {
        if (cancelled) return;
        setConnectionState((current) => {
          const next = new Map(current.byEducatorId);
          for (const uid of targetUids) {
            next.set(uid, statuses[uid]?.status ?? "none");
          }
          return { ...current, byEducatorId: next };
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [allEducators, newEducators, recommended, user]);

  useEffect(() => {
    let cancelled = false;

    getNewestDiscoverEducators(40)
      .then((profiles) => {
        if (cancelled) return;
        setNewSectionError(null);
        setNewEducators(profiles.slice(0, 20));
      })
      .catch(() => {
        if (!cancelled) {
          setNewEducators([]);
          setNewSectionError("Could not load new educators right now.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const completion = viewerProfile ? computeProfileCompletion(viewerProfile) : null;
  const showCompletionPrompt = user && (!viewerProfile || !completion?.minimumComplete);

  const resultCount = allEducators.length;
  const visibleCount = queryState.page * PAGE_SIZE;
  const visibleResults = allEducators.slice(0, visibleCount);
  const hasMore = visibleCount < resultCount;

  const recommendationIds = new Set(recommended.map((entry) => entry.educator.uid));
  const newEducatorSectionItems = newEducators
    .filter((educator) => educator.uid !== user?.uid)
    .filter((educator) => !recommendationIds.has(educator.uid))
    .slice(0, NEW_SECTION_LIMIT);

  const chips = activeFilterChips(queryState);

  const followLabelById = useMemo(() => {
    const labels = new Map<string, string[]>();
    for (const entry of recommended) {
      labels.set(entry.educator.uid, [entry.matchLabel, ...entry.reasons]);
    }
    return labels;
  }, [recommended]);

  const profileForSharedContext = viewerProfile;

  const handleToggleFollow = useCallback(
    async (educator: UserProfile) => {
      if (!user?.uid) {
        const redirect = `${pathname}${toDiscoverQueryString(queryState)}`;
        router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      const educatorId = educator.uid;
      const isCurrentlyFollowing = followState.ids.has(educatorId);

      setFollowState((current) => {
        const nextLoading = new Set(current.loadingIds);
        nextLoading.add(educatorId);

        const nextIds = new Set(current.ids);
        if (isCurrentlyFollowing) nextIds.delete(educatorId);
        else nextIds.add(educatorId);

        return { ids: nextIds, loadingIds: nextLoading };
      });

      try {
        if (isCurrentlyFollowing) {
          await unfollowUser(user.uid, educatorId);
        } else {
          await followUser(user.uid, educatorId);
          notifyNewFollower({
            recipientId: educatorId,
            actorId: user.uid,
            actorName: user.displayName ?? "Someone",
            actorPhotoURL: user.photoURL ?? null,
          }).catch(() => {});
        }
      } catch {
        setFollowState((current) => {
          const nextLoading = new Set(current.loadingIds);
          nextLoading.delete(educatorId);

          const reverted = new Set(current.ids);
          if (isCurrentlyFollowing) reverted.add(educatorId);
          else reverted.delete(educatorId);

          return { ids: reverted, loadingIds: nextLoading };
        });
        return;
      }

      setFollowState((current) => {
        const nextLoading = new Set(current.loadingIds);
        nextLoading.delete(educatorId);
        return { ...current, loadingIds: nextLoading };
      });
    },
    [followState.ids, pathname, queryState, router, user],
  );

  const handleSendConnectionRequest = useCallback(
    async (
      educator: UserProfile,
      payload: { reason?: ConnectionRequestReason; introMessage?: string },
    ) => {
      if (!user) {
        const redirect = `${pathname}${toDiscoverQueryString(queryState)}`;
        router.push(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
        return;
      }

      setConnectionState((current) => {
        const nextLoading = new Set(current.loadingIds);
        nextLoading.add(educator.uid);
        return { ...current, loadingIds: nextLoading };
      });

      try {
        const token = await user.getIdToken();
        const result = await sendConnectionRequestApi(() => Promise.resolve(token), {
          recipientId: educator.uid,
          reason: payload.reason,
          introMessage: payload.introMessage,
        });

        setConnectionState((current) => {
          const nextLoading = new Set(current.loadingIds);
          nextLoading.delete(educator.uid);

          const nextMap = new Map(current.byEducatorId);
          nextMap.set(educator.uid, result.status);
          return { byEducatorId: nextMap, loadingIds: nextLoading };
        });

        const nextQuota = await fetchConnectionQuota(() => Promise.resolve(token));
        setConnectionQuota(nextQuota);
      } catch (error) {
        setConnectionState((current) => {
          const nextLoading = new Set(current.loadingIds);
          nextLoading.delete(educator.uid);
          return { ...current, loadingIds: nextLoading };
        });

        if (error instanceof ConnectionClientError && error.code === "MONTHLY_LIMIT_REACHED") {
          setConnectionQuota((current) =>
            current
              ? { ...current, canSend: false, remaining: 0 }
              : current,
          );
        }

        throw error instanceof Error ? error : new Error("Unable to send request.");
      }
    },
    [pathname, queryState, router, user],
  );

  const handleRespondToConnectionRequest = useCallback(
    () => {
      router.push("/network?tab=requests");
    },
    [router],
  );

  const removeFilterChip = useCallback(
    (key: keyof DiscoverQueryState) => {
      updateQueryState({ [key]: key === "sort" ? "recommended" : "" } as Partial<DiscoverQueryState>);
    },
    [updateQueryState],
  );

  const clearAll = useCallback(() => {
    setUrlState(DEFAULT_DISCOVER_QUERY_STATE);
    setSearchDraft("");
  }, [setUrlState]);

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    updateQueryState({ page: queryState.page + 1 });
  }, [hasMore, queryState.page, updateQueryState]);

  const showRecommendations = Boolean(user && viewerProfile && isRecommendationEligible(viewerProfile));

  return (
    <div className="space-y-6 pb-8">
      <DiscoveryShell
        title="Discover Educators"
        subtitle="Find educators who share your subjects, curriculum, professional interests, and goals."
        controls={
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <Input
                label="Search educators"
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Name, role, subjects, curriculum, interests, goals, country"
              />
              <div className="flex items-end gap-2">
                <Button type="button" variant="outline" onClick={() => setMobileFiltersOpen(true)}>
                  Filters
                </Button>
                {chips.length > 0 && (
                  <Button type="button" variant="ghost" onClick={clearAll}>
                    Clear all
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2" role="list" aria-label="Browse shortcuts">
              <ShortcutButton label="Primary educators" onClick={() => updateQueryState({ role: "Primary Teacher" })} />
              <ShortcutButton label="Secondary educators" onClick={() => updateQueryState({ role: "Secondary Teacher" })} />
              <ShortcutButton label="Mathematics" onClick={() => updateQueryState({ subject: "Math" })} />
              <ShortcutButton label="IB educators" onClick={() => updateQueryState({ curriculum: "IB PYP" })} />
              <ShortcutButton label="EdTech" onClick={() => updateQueryState({ role: "EdTech Professional" })} />
            </div>
          </div>
        }
      />

      {showCompletionPrompt && (
        <div className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-primary-900">Improve your recommendations</h2>
          <p className="mt-1 text-sm text-primary-800">
            Add your subjects, curriculum, interests, and networking goals to help VistaTeacher find relevant educators.
          </p>
          <Link href="/profile/edit" className="mt-2 inline-block">
            <Button size="sm">Complete Your Profile</Button>
          </Link>
        </div>
      )}

      {showRecommendations && (
        <section aria-labelledby="recommended-heading" className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 id="recommended-heading" className="text-lg font-semibold text-foreground">Recommended for You</h2>
          </div>

          {recommendationsLoading && <DiscoverGridSkeleton count={4} />}

          {!recommendationsLoading && recommendationsError && (
            <ErrorState message={recommendationsError} />
          )}

          {!recommendationsLoading && !recommendationsError && recommended.length === 0 && (
            <EmptyState
              icon="🧭"
              title="We need a little more professional context to personalize your recommendations."
              description="You can still search and browse all educators below."
              actionLabel="Complete profile"
              onAction={() => router.push("/profile/edit")}
            />
          )}

          {!recommendationsLoading && !recommendationsError && recommended.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {recommended.map((entry) => (
                <DiscoverEducatorCard
                  key={`recommended-${entry.educator.uid}`}
                  educator={entry.educator}
                  isOwnProfile={entry.educator.uid === user?.uid}
                  isFollowed={followState.ids.has(entry.educator.uid)}
                  followLoading={followState.loadingIds.has(entry.educator.uid)}
                  connectionState={connectionState.byEducatorId.get(entry.educator.uid) ?? "none"}
                  connectionLoading={connectionState.loadingIds.has(entry.educator.uid)}
                  connectionQuota={connectionQuota}
                  reasons={entry.reasons}
                  onToggleFollow={handleToggleFollow}
                  onSendConnectionRequest={handleSendConnectionRequest}
                  onRespondToConnectionRequest={handleRespondToConnectionRequest}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {newEducatorSectionItems.length > 0 && (
        <section aria-labelledby="new-educators-heading" className="space-y-3">
          <h2 id="new-educators-heading" className="text-lg font-semibold text-foreground">New to VistaTeacher</h2>
          {newSectionError && <p className="text-sm text-muted">{newSectionError}</p>}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {newEducatorSectionItems.map((educator) => (
              <DiscoverEducatorCard
                key={`new-${educator.uid}`}
                educator={educator}
                isOwnProfile={educator.uid === user?.uid}
                isFollowed={followState.ids.has(educator.uid)}
                followLoading={followState.loadingIds.has(educator.uid)}
                connectionState={connectionState.byEducatorId.get(educator.uid) ?? "none"}
                connectionLoading={connectionState.loadingIds.has(educator.uid)}
                connectionQuota={connectionQuota}
                reasons={
                  profileForSharedContext
                    ? getSharedContextReasons(profileForSharedContext, educator, 2).map((reason) => reason.detail)
                    : []
                }
                onToggleFollow={handleToggleFollow}
                onSendConnectionRequest={handleSendConnectionRequest}
                onRespondToConnectionRequest={handleRespondToConnectionRequest}
              />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="all-educators-heading" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="all-educators-heading" className="text-lg font-semibold text-foreground">All Educators</h2>
          <div className="sm:w-56">
            <Select
              label="Sort"
              value={queryState.sort}
              onChange={(event) => updateQueryState({ sort: event.target.value as DiscoverSort })}
              options={SORT_OPTIONS}
            />
          </div>
        </div>

        <div aria-live="polite" className="text-sm text-muted">
          {!loadingResults && !resultsError && `${resultCount} educators found`}
        </div>

        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2" aria-label="Active filters">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => removeFilterChip(chip.key)}
                className="rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-900"
              >
                {chip.label} ×
              </button>
            ))}
          </div>
        )}

        {loadingResults && <DiscoverGridSkeleton count={6} />}

        {!loadingResults && resultsError && (
          <ErrorState message={resultsError} onRetry={() => updateQueryState({}, "replace")} />
        )}

        {!loadingResults && !resultsError && resultCount === 0 && (
          <EmptyState
            icon="🔎"
            title={hasActiveDiscoverFilters(queryState) ? "No educators matched your search." : "No profiles available yet."}
            description={
              hasActiveDiscoverFilters(queryState)
                ? "Try broadening your search or clearing filters."
                : "VistaTeacher is growing. Check back soon."
            }
            actionLabel={hasActiveDiscoverFilters(queryState) ? "Clear filters" : undefined}
            onAction={hasActiveDiscoverFilters(queryState) ? clearAll : undefined}
          />
        )}

        {!loadingResults && !resultsError && resultCount > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleResults.map((educator) => {
                const baseReasons =
                  profileForSharedContext && educator.uid !== profileForSharedContext.uid
                    ? getSharedContextReasons(profileForSharedContext, educator, 2).map((reason) => reason.detail)
                    : [];

                const recommendationReasons = followLabelById.get(educator.uid) ?? [];
                const mergedReasons = dedupeStrings([...recommendationReasons, ...baseReasons]).slice(0, 2);

                return (
                  <DiscoverEducatorCard
                    key={educator.uid}
                    educator={educator}
                    isOwnProfile={educator.uid === user?.uid}
                    isFollowed={followState.ids.has(educator.uid)}
                    followLoading={followState.loadingIds.has(educator.uid)}
                    connectionState={connectionState.byEducatorId.get(educator.uid) ?? "none"}
                    connectionLoading={connectionState.loadingIds.has(educator.uid)}
                    connectionQuota={connectionQuota}
                    reasons={mergedReasons}
                    onToggleFollow={handleToggleFollow}
                    onSendConnectionRequest={handleSendConnectionRequest}
                    onRespondToConnectionRequest={handleRespondToConnectionRequest}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              {hasMore ? (
                <Button onClick={loadMore}>Load more</Button>
              ) : (
                <p className="text-sm text-muted">You have reached the end of the results.</p>
              )}
            </div>
          </>
        )}
      </section>

      <Modal open={mobileFiltersOpen} onClose={() => setMobileFiltersOpen(false)} title="Filters">
        <div className="space-y-3">
          <DiscoverFiltersForm
            state={queryState}
            onChange={updateQueryState}
          />
          <div className="flex justify-between gap-2">
            <Button variant="ghost" onClick={clearAll}>Clear all</Button>
            <Button onClick={() => setMobileFiltersOpen(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const clean = value.trim();
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(clean);
  }

  return unique;
}

function DiscoverFiltersForm({
  state,
  onChange,
}: {
  state: DiscoverQueryState;
  onChange: (updates: Partial<DiscoverQueryState>, mode?: "push" | "replace") => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Select
        label="Professional role"
        value={state.role}
        onChange={(event) => onChange({ role: event.target.value })}
        placeholder="All roles"
        options={PROFESSIONAL_ROLES.map((role) => ({ value: role, label: role }))}
      />
      <Select
        label="Subject"
        value={state.subject}
        onChange={(event) => onChange({ subject: event.target.value })}
        placeholder="All subjects"
        options={SUBJECTS.map((subject) => ({ value: subject, label: subject }))}
      />
      <Select
        label="Grade level"
        value={state.grade}
        onChange={(event) => onChange({ grade: event.target.value })}
        placeholder="All grade levels"
        options={GRADE_LEVELS.map((grade) => ({ value: grade, label: grade }))}
      />
      <Select
        label="Curriculum"
        value={state.curriculum}
        onChange={(event) => onChange({ curriculum: event.target.value })}
        placeholder="All curricula"
        options={CURRICULA.map((curriculum) => ({ value: curriculum, label: curriculum }))}
      />
      <Select
        label="Country"
        value={state.country}
        onChange={(event) => onChange({ country: event.target.value })}
        placeholder="All countries"
        options={COUNTRIES.map((country) => ({ value: country, label: country }))}
      />
    </div>
  );
}

function ShortcutButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-900"
    >
      {label}
    </button>
  );
}

function DiscoverGridSkeleton({ count }: { count: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-9 flex-1" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
