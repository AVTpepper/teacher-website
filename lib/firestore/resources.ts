import {
  doc,
  getDoc,
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

// --- URL slug helpers ---

export function resourceSlug(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug}--${id}`;
}

export function parseResourceSlug(slug: string): string {
  const idx = slug.lastIndexOf("--");
  return idx !== -1 ? slug.slice(idx + 2) : slug;
}

// --- Resource types ---

export type ResourceType =
  | "lessonPlan"
  | "worksheet"
  | "strategy"
  | "slides"
  | "tool";

export const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: "lessonPlan", label: "Lesson Plan" },
  { value: "worksheet", label: "Worksheet" },
  { value: "strategy", label: "Strategy" },
  { value: "slides", label: "Slides" },
  { value: "tool", label: "Tool" },
];

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
  savedByCount: number;
  createdAt: Timestamp | null;
  tags: string[];
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
  tags: string[];
}

// --- Resource CRUD ---

const PAGE_SIZE = 12;

export async function createResource(data: ResourceInput): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(collection(db, "resources"));

  await setDoc(ref, {
    ...data,
    id: ref.id,
    createdAt: serverTimestamp(),
    downloadCount: 0,
    ratingSum: 0,
    ratingCount: 0,
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

export type ResourceSortBy = "newest" | "popular";

export interface ResourceFilters {
  gradeLevel?: string;
  subject?: string;
  type?: ResourceType;
  sortBy?: ResourceSortBy;
}

export async function getResources(
  filters?: ResourceFilters,
  cursor?: DocumentSnapshot | null
): Promise<GetResourcesResult> {
  if (!db) throw new Error("Firestore is not initialized");

  const constraints: QueryConstraint[] = [];

  if (filters?.gradeLevel) {
    constraints.push(where("gradeLevel", "==", filters.gradeLevel));
  }
  if (filters?.subject) {
    constraints.push(where("subject", "==", filters.subject));
  }
  if (filters?.type) {
    constraints.push(where("type", "==", filters.type));
  }

  if (filters?.sortBy === "popular") {
    constraints.push(orderBy("downloadCount", "desc"));
  } else {
    constraints.push(orderBy("createdAt", "desc"));
  }

  constraints.push(limit(PAGE_SIZE));

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, "resources"), ...constraints);
  const snapshot = await getDocs(q);

  const resources = snapshot.docs.map((d) => d.data() as Resource);
  const lastDoc =
    snapshot.docs.length === PAGE_SIZE
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

  return { resources, lastDoc };
}

export async function getResourcesByAuthor(
  authorId: string,
  cursor?: DocumentSnapshot | null
): Promise<GetResourcesResult> {
  if (!db) throw new Error("Firestore is not initialized");

  const constraints: QueryConstraint[] = [
    where("authorId", "==", authorId),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE),
  ];

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, "resources"), ...constraints);
  const snapshot = await getDocs(q);

  const resources = snapshot.docs.map((d) => d.data() as Resource);
  const lastDoc =
    snapshot.docs.length === PAGE_SIZE
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

  return { resources, lastDoc };
}

// --- Download tracking ---

export async function trackDownload(
  resourceId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  // Record individual download (idempotent per user — overwrites)
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

  if (existing.exists()) {
    // Update: adjust the sum by the difference
    const prevRating = existing.data().rating as number;
    const diff = rating - prevRating;

    await setDoc(ratingRef, { rating, ratedAt: serverTimestamp() });
    await updateDoc(resourceRef, {
      ratingSum: increment(diff),
    });
  } else {
    // New rating
    await setDoc(ratingRef, { rating, ratedAt: serverTimestamp() });
    await updateDoc(resourceRef, {
      ratingSum: increment(rating),
      ratingCount: increment(1),
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
  createdAt: Timestamp | null;
}

export interface ResourceCommentInput {
  parentId?: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
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

  return snapshot.docs.map((d) => d.data() as ResourceComment);
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
