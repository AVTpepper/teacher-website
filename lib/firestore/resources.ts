import {
  doc,
  getDoc,
  getCountFromServer,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  increment,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type DocumentSnapshot,
  type Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { makeSlug, parseSlug, byCreatedAtDesc } from "@/lib/utils";
import {
  deleteCommentWithReplies,
  type DeleteCommentResult,
  migrateLegacyCommentFields,
} from "@/lib/firestore/commentThreads";

// --- URL slug helpers ---

export function resourceSlug(title: string, id: string): string {
  return makeSlug(title, id);
}

export function parseResourceSlug(slug: string): string {
  return parseSlug(slug);
}

// --- Resource types ---

export type ResourceType =
  | "lessonPlan"
  | "worksheet"
  | "rubric"
  | "strategy"
  | "slides"
  | "tool";

export interface AttachedLink {
  url: string;
  label: string;
}

export const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: "lessonPlan", label: "Lesson Plan" },
  { value: "worksheet", label: "Worksheet" },
  { value: "rubric", label: "Rubric" },
  { value: "strategy", label: "Strategy" },
  { value: "slides", label: "Slides" },
  { value: "tool", label: "Tool" },
];

export interface ResourceContentSection {
  heading: string;
  body: string;
}

export const SUGGESTED_TAGS = [
  "Differentiated Instruction",
  "Project-Based Learning",
  "Assessment",
  "Homework",
  "Group Activity",
  "Interactive",
  "Printable",
  "Digital",
  "Rubric",
  "Anchor Chart",
  "Warm-Up",
  "Exit Ticket",
  "Review",
  "Test Prep",
  "Hands-On",
  "Scaffolded",
  "IEP Accommodations",
  "ESL / ELL",
  "Classroom Management",
  "Parent Communication",
] as const;

export interface Resource {
  id: string;
  title: string;
  titleLower?: string;
  description: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  gradeLevel: string;
  subject: string;
  type: ResourceType;
  fileURL: string;
  fileName: string;
  downloadCount: number;
  ratingSum: number;
  ratingCount: number;
  ratingAverage: number;
  savedByCount: number;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
  isPublic: boolean;
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  generatedFromLesson?: boolean;
  contentSections?: ResourceContentSection[];
  tags: string[];
  links: AttachedLink[];
}

export interface ResourceInput {
  title: string;
  description: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  gradeLevel: string;
  subject: string;
  type: ResourceType;
  fileURL: string;
  fileName: string;
  isPublic?: boolean;
  sourceLessonId?: string | null;
  sourceLessonTitle?: string | null;
  generatedFromLesson?: boolean;
  contentSections?: ResourceContentSection[];
  tags: string[];
  links?: AttachedLink[];
}

// --- Resource CRUD ---

const PAGE_SIZE = 12;

export async function updateResource(
  resourceId: string,
  data: Partial<ResourceInput>
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");
  await updateDoc(doc(db, "resources", resourceId), {
    ...data,
    ...(data.title !== undefined ? { titleLower: data.title.toLowerCase() } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteResource(resourceId: string): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");
  await deleteDoc(doc(db, "resources", resourceId));
}

export async function createResource(data: ResourceInput): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(collection(db, "resources"));

  await setDoc(ref, {
    ...data,
    titleLower: data.title.toLowerCase(),
    id: ref.id,
    links: data.links ?? [],
    isPublic: data.isPublic ?? true,
    sourceLessonId: data.sourceLessonId ?? null,
    sourceLessonTitle: data.sourceLessonTitle ?? null,
    generatedFromLesson: data.generatedFromLesson ?? false,
    contentSections: data.contentSections ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    downloadCount: 0,
    ratingSum: 0,
    ratingCount: 0,
    ratingAverage: 0,
    savedByCount: 0,
  });

  return ref.id;
}

export async function getResource(resourceId: string): Promise<Resource | null> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "resources", resourceId));
  if (!snap.exists()) return null;
  return snap.data() as Resource;
}

export interface GetResourcesResult {
  resources: Resource[];
  lastDoc: DocumentSnapshot | null;
}

export type ResourceSortBy = "newest" | "oldest" | "downloads" | "bookmarks" | "rating";

export interface ResourceFilters {
  gradeLevel?: string;
  subject?: string;
  type?: ResourceType;
  sortBy?: ResourceSortBy;
}

export async function getResources(
  filters?: ResourceFilters,
  cursor?: DocumentSnapshot | null,
  pageSize = PAGE_SIZE
): Promise<GetResourcesResult> {
  if (!db) throw new Error("Firestore is not initialized");

  const constraints: QueryConstraint[] = [];

  constraints.push(where("isPublic", "==", true));

  if (filters?.gradeLevel) {
    constraints.push(where("gradeLevel", "==", filters.gradeLevel));
  }
  if (filters?.subject) {
    constraints.push(where("subject", "==", filters.subject));
  }
  if (filters?.type) {
    constraints.push(where("type", "==", filters.type));
  }

  if (filters?.sortBy === "oldest") {
    constraints.push(orderBy("createdAt", "asc"));
  } else if (filters?.sortBy === "downloads") {
    constraints.push(orderBy("downloadCount", "desc"));
  } else if (filters?.sortBy === "bookmarks") {
    constraints.push(orderBy("savedByCount", "desc"));
  } else if (filters?.sortBy === "rating") {
    constraints.push(orderBy("ratingAverage", "desc"));
  } else {
    constraints.push(orderBy("createdAt", "desc"));
  }

  constraints.push(limit(pageSize));

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, "resources"), ...constraints);
  const snapshot = await getDocs(q);

  const resources = snapshot.docs.map((d) => d.data() as Resource);
  const lastDoc =
    snapshot.docs.length === pageSize
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

  return { resources, lastDoc };
}

export async function getResourcesByAuthor(
  authorId: string,
  includePrivate = false,
): Promise<GetResourcesResult> {
  if (!db) throw new Error("Firestore is not initialized");

  // Single equality where() - uses Firestore auto single-field index, no composite needed.
  // Sort client-side to avoid needing a composite index.
  const q = query(
    collection(db, "resources"),
    where("authorId", "==", authorId)
  );
  const snapshot = await getDocs(q);

  let resources = snapshot.docs
    .map((d) => d.data() as Resource)
    .sort(byCreatedAtDesc);

  if (!includePrivate) {
    resources = resources.filter((resource) => resource.isPublic !== false);
  }

  return { resources, lastDoc: null };
}

export async function getResourceCountByAuthor(
  authorId: string,
  includePrivate = false,
): Promise<number> {
  if (!db) throw new Error("Firestore is not initialized");

  if (!includePrivate) {
    const snapshot = await getCountFromServer(
      query(
        collection(db, "resources"),
        where("authorId", "==", authorId),
        where("isPublic", "==", true),
      )
    );

    return snapshot.data().count;
  }

  const snapshot = await getCountFromServer(
    query(collection(db, "resources"), where("authorId", "==", authorId))
  );

  return snapshot.data().count;
}

export async function getResourcesByIds(resourceIds: string[]): Promise<Resource[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const uniqueIds = Array.from(new Set(resourceIds.filter(Boolean)));
  const results = await Promise.all(
    uniqueIds.map(async (resourceId) => {
      try {
        return await getResource(resourceId);
      } catch {
        return null;
      }
    })
  );

  return results.filter((resource): resource is Resource => resource !== null);
}

// --- Download tracking ---

export async function trackDownload(
  resourceId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  // Record individual download (idempotent per user - overwrites)
  await setDoc(doc(db, "resources", resourceId, "downloads", userId), {
    downloadedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "resources", resourceId), {
    downloadCount: increment(1),
  });
}

// --- Save / bookmark system ---

export async function saveResource(
  resourceId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await setDoc(doc(db, "resources", resourceId, "saves", userId), {
    savedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "resources", resourceId), {
    savedByCount: increment(1),
  });
}

export async function unsaveResource(
  resourceId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await deleteDoc(doc(db, "resources", resourceId, "saves", userId));
  await updateDoc(doc(db, "resources", resourceId), {
    savedByCount: increment(-1),
  });
}

export async function hasSavedResource(
  resourceId: string,
  userId: string
): Promise<boolean> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "resources", resourceId, "saves", userId));
  return snap.exists();
}

// --- Rating system ---

export async function rateResource(
  resourceId: string,
  userId: string,
  rating: number
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");
  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");

  const ratingRef = doc(db, "resources", resourceId, "ratings", userId);
  const resourceRef = doc(db, "resources", resourceId);

  const existing = await getDoc(ratingRef);
  const resourceSnap = await getDoc(resourceRef);
  const currentSum = (resourceSnap.data()?.ratingSum as number) ?? 0;
  const currentCount = (resourceSnap.data()?.ratingCount as number) ?? 0;

  if (existing.exists()) {
    // Update: adjust the sum by the difference
    const prevRating = existing.data().rating as number;
    const diff = rating - prevRating;
    const nextSum = currentSum + diff;
    const ratingAverage = currentCount > 0 ? Math.round((nextSum / currentCount) * 10) / 10 : 0;

    await setDoc(ratingRef, { rating, ratedAt: serverTimestamp() });
    await updateDoc(resourceRef, {
      ratingSum: increment(diff),
      ratingAverage,
    });
  } else {
    // New rating
    const nextSum = currentSum + rating;
    const nextCount = currentCount + 1;
    const ratingAverage = Math.round((nextSum / nextCount) * 10) / 10;

    await setDoc(ratingRef, { rating, ratedAt: serverTimestamp() });
    await updateDoc(resourceRef, {
      ratingSum: increment(rating),
      ratingCount: increment(1),
      ratingAverage,
    });
  }
}

export async function getUserRating(
  resourceId: string,
  userId: string
): Promise<number | null> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "resources", resourceId, "ratings", userId));
  if (!snap.exists()) return null;
  return snap.data().rating as number;
}

/** Returns average rating (0 if no ratings). */
export function getAverageRating(resource: Resource): number {
  if (typeof resource.ratingAverage === "number") return resource.ratingAverage;
  if (resource.ratingCount === 0) return 0;
  return resource.ratingSum / resource.ratingCount;
}

// --- Comment system ---

export interface ResourceComment {
  id: string;
  resourceId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  mentionedUsers?: { uid: string; displayName: string }[];
  createdAt: Timestamp | null;
  editedAt?: Timestamp | null;
  deleted?: boolean;
  likesCount: number;
}

export interface ResourceCommentInput {
  parentId?: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  mentionedUsers?: { uid: string; displayName: string }[];
}

export async function addResourceComment(
  resourceId: string,
  data: ResourceCommentInput
): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(collection(db, "resources", resourceId, "comments"));

  await setDoc(ref, {
    ...data,
    id: ref.id,
    resourceId,
    parentId: data.parentId ?? null,
    mentionedUsers: data.mentionedUsers ?? [],
    likesCount: 0,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function getResourceComments(
  resourceId: string
): Promise<ResourceComment[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const q = query(
    collection(db, "resources", resourceId, "comments"),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) =>
    migrateLegacyCommentFields(
      doc(db!, "resources", resourceId, "comments", d.id),
      d.data() as ResourceComment
    )
  );
}

export async function updateResourceComment(
  resourceId: string,
  commentId: string,
  text: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");
  await updateDoc(doc(db, "resources", resourceId, "comments", commentId), {
    content: text.trim().slice(0, 2000),
    editedAt: serverTimestamp(),
  });
}

export async function likeResourceComment(
  resourceId: string,
  commentId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await setDoc(doc(db, "resources", resourceId, "comments", commentId, "likes", userId), {
    likedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "resources", resourceId, "comments", commentId), {
    likesCount: increment(1),
  });
}

export async function unlikeResourceComment(
  resourceId: string,
  commentId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await deleteDoc(doc(db, "resources", resourceId, "comments", commentId, "likes", userId));
  await updateDoc(doc(db, "resources", resourceId, "comments", commentId), {
    likesCount: increment(-1),
  });
}

export async function hasLikedResourceComment(
  resourceId: string,
  commentId: string,
  userId: string
): Promise<boolean> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "resources", resourceId, "comments", commentId, "likes", userId));
  return snap.exists();
}

export async function deleteResourceComment(
  resourceId: string,
  commentId: string
): Promise<DeleteCommentResult> {
  return deleteCommentWithReplies({
    collectionPath: ["resources", resourceId, "comments"],
    commentId,
  });
}

// --- Related resources ---

export async function getRelatedResources(
  resource: Resource,
  maxResults = 4
): Promise<Resource[]> {
  if (!db) throw new Error("Firestore is not initialized");

  // Query by same subject, excluding the current resource
  const q = query(
    collection(db, "resources"),
    where("isPublic", "==", true),
    where("subject", "==", resource.subject),
    orderBy("downloadCount", "desc"),
    limit(maxResults + 1)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((d) => d.data() as Resource)
    .filter((r) => r.id !== resource.id)
    .slice(0, maxResults);
}
