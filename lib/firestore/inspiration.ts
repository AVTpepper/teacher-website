import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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
import { deleteCommentWithReplies, type DeleteCommentResult, migrateLegacyCommentFields } from "@/lib/firestore/commentThreads";

// --- Category definitions ---

export type InspirationCategory =
  | "podcast"
  | "article"
  | "video"
  | "education-news"
  | "teacher-story"
  | "general"
  | "other";

export const INSPIRATION_CATEGORIES: {
  value: InspirationCategory;
  label: string;
  icon: string;
}[] = [
  { value: "podcast", label: "Podcasts", icon: "🎙️" },
  { value: "article", label: "Articles", icon: "📝" },
  { value: "video", label: "Videos", icon: "🎬" },
  { value: "education-news", label: "Education News", icon: "📰" },
  { value: "teacher-story", label: "Teacher Stories", icon: "✨" },
  { value: "general", label: "General", icon: "💡" },
  { value: "other", label: "Other", icon: "🧩" },
];

// --- Firestore schema ---

export interface InspirationItem {
  id: string;
  title: string;
  description: string;
  category: InspirationCategory;
  sourceURL: string | null;
  videoURL: string | null;
  thumbnailURL: string | null;       // URL-pasted thumbnail
  thumbnailStorageURL: string | null; // uploaded file thumbnail (takes priority)
  creator: string | null; // name of creator / publication / source
  submittedBy: string | null; // uid - null for seeded/admin content
  createdAt: Timestamp | null;
  isApproved: boolean;
}

export interface InspirationInput {
  title: string;
  description: string;
  category?: InspirationCategory;
  sourceURL?: string | null;
  videoURL?: string | null;
  thumbnailURL?: string | null;
  thumbnailStorageURL?: string | null;
  creator?: string | null;
  submittedBy: string | null;
}

// --- CRUD helpers ---

export async function createInspirationItem(
  input: InspirationInput
): Promise<InspirationItem> {
  if (!db) throw new Error("Firestore is not initialized");
  const ref = doc(collection(db, "inspiration"));
  const item: Omit<InspirationItem, "id"> = {
    title: input.title,
    description: input.description,
    category: input.category ?? "general",
    sourceURL: input.sourceURL ?? null,
    videoURL: input.videoURL ?? null,
    thumbnailURL: input.thumbnailURL ?? null,
    thumbnailStorageURL: input.thumbnailStorageURL ?? null,
    creator: input.creator ?? null,
    submittedBy: input.submittedBy,
    isApproved: true, // community-submitted content is auto-approved for MVP
    createdAt: null,
  };
  await setDoc(ref, { ...item, createdAt: serverTimestamp() });
  return { id: ref.id, ...item };
}

export interface InspirationFilters {
  category?: InspirationCategory;
}

export async function getInspirationItems(
  filters: InspirationFilters,
  pageSize = 12,
  cursor: DocumentSnapshot | null = null
): Promise<{ items: InspirationItem[]; cursor: DocumentSnapshot | null }> {
  if (!db) return { items: [], cursor: null };

  const constraints: QueryConstraint[] = [
    where("isApproved", "==", true),
    orderBy("createdAt", "desc"),
    limit(pageSize),
  ];

  if (filters.category) {
    constraints.unshift(where("category", "==", filters.category));
  }

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, "inspiration"), ...constraints);
  const snap = await getDocs(q);

  const items: InspirationItem[] = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<InspirationItem, "id">),
  }));

  const lastDoc = snap.docs[snap.docs.length - 1] ?? null;
  const nextCursor = snap.docs.length === pageSize ? lastDoc : null;

  return { items, cursor: nextCursor };
}

export async function getInspirationItem(id: string): Promise<InspirationItem | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "inspiration", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<InspirationItem, "id">) };
}

export type InspirationUpdateInput = Partial<Omit<InspirationItem, "id" | "createdAt" | "isApproved" | "submittedBy">>;

export async function updateInspirationItem(
  id: string,
  data: InspirationUpdateInput
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");
  await updateDoc(doc(db, "inspiration", id), data);
}

export async function deleteInspirationItem(id: string): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");
  await deleteDoc(doc(db, "inspiration", id));
}

// --- Comment system ---

export interface InspirationComment {
  id: string;
  inspirationId: string;
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

export interface InspirationCommentInput {
  parentId?: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  mentionedUsers?: { uid: string; displayName: string }[];
}

export async function addInspirationComment(
  inspirationId: string,
  data: InspirationCommentInput
): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(collection(db, "inspiration", inspirationId, "comments"));

  await setDoc(ref, {
    ...data,
    id: ref.id,
    inspirationId,
    parentId: data.parentId ?? null,
    mentionedUsers: data.mentionedUsers ?? [],
    likesCount: 0,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function getInspirationComments(
  inspirationId: string
): Promise<InspirationComment[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const q = query(
    collection(db, "inspiration", inspirationId, "comments"),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) =>
    migrateLegacyCommentFields(
      doc(db!, "inspiration", inspirationId, "comments", d.id),
      d.data() as InspirationComment
    )
  );
}

export async function updateInspirationComment(
  inspirationId: string,
  commentId: string,
  text: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");
  await updateDoc(doc(db, "inspiration", inspirationId, "comments", commentId), {
    content: text.trim().slice(0, 2000),
    editedAt: serverTimestamp(),
  });
}

export async function likeInspirationComment(
  inspirationId: string,
  commentId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await setDoc(doc(db, "inspiration", inspirationId, "comments", commentId, "likes", userId), {
    likedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "inspiration", inspirationId, "comments", commentId), {
    likesCount: increment(1),
  });
}

export async function unlikeInspirationComment(
  inspirationId: string,
  commentId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await deleteDoc(doc(db, "inspiration", inspirationId, "comments", commentId, "likes", userId));
  await updateDoc(doc(db, "inspiration", inspirationId, "comments", commentId), {
    likesCount: increment(-1),
  });
}

export async function hasLikedInspirationComment(
  inspirationId: string,
  commentId: string,
  userId: string
): Promise<boolean> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "inspiration", inspirationId, "comments", commentId, "likes", userId));
  return snap.exists();
}

export async function deleteInspirationComment(
  inspirationId: string,
  commentId: string
): Promise<DeleteCommentResult> {
  return deleteCommentWithReplies({
    collectionPath: ["inspiration", inspirationId, "comments"],
    commentId,
  });
}
