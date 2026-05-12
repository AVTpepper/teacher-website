import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
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

// --- Category definitions ---

export type InspirationCategory =
  | "podcast"
  | "article"
  | "video"
  | "education-news"
  | "teacher-story";

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
];

// --- Firestore schema ---

export interface InspirationItem {
  id: string;
  title: string;
  description: string;
  category: InspirationCategory;
  sourceURL: string;
  thumbnailURL: string | null;       // URL-pasted thumbnail
  thumbnailStorageURL: string | null; // uploaded file thumbnail (takes priority)
  creator: string; // name of creator / publication / source
  submittedBy: string | null; // uid — null for seeded/admin content
  createdAt: Timestamp | null;
  isApproved: boolean;
}

export type InspirationInput = Omit<InspirationItem, "id" | "createdAt" | "isApproved">;

// --- CRUD helpers ---

export async function createInspirationItem(
  input: InspirationInput
): Promise<InspirationItem> {
  if (!db) throw new Error("Firestore is not initialized");
  const ref = doc(collection(db, "inspiration"));
  const item: Omit<InspirationItem, "id"> = {
    ...input,
    thumbnailStorageURL: input.thumbnailStorageURL ?? null,
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
