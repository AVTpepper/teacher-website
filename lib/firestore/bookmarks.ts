import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  increment,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Bookmark {
  id: string;         // "{userId}_{lessonId}"
  userId: string;
  lessonId: string;
  lessonTitle: string;
  createdAt: Timestamp | null;
}

function bookmarkId(userId: string, lessonId: string) {
  return `${userId}_${lessonId}`;
}

/** Returns true if the user has bookmarked this lesson. */
export async function isBookmarked(userId: string, lessonId: string): Promise<boolean> {
  if (!db) return false;
  const ref = doc(db, "bookmarks", bookmarkId(userId, lessonId));
  const snap = await getDoc(ref);
  return snap.exists();
}

/** Adds a bookmark and increments the lesson's bookmarkCount. */
export async function addBookmark(userId: string, lessonId: string, lessonTitle: string): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  const id = bookmarkId(userId, lessonId);
  await setDoc(doc(db, "bookmarks", id), {
    id,
    userId,
    lessonId,
    lessonTitle,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "lessons", lessonId), { bookmarkCount: increment(1) });
}

/** Removes a bookmark and decrements the lesson's bookmarkCount (floor 0). */
export async function removeBookmark(userId: string, lessonId: string): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  await deleteDoc(doc(db, "bookmarks", bookmarkId(userId, lessonId)));
  // Decrement but never below 0
  const lessonRef = doc(db, "lessons", lessonId);
  const lessonSnap = await getDoc(lessonRef);
  if (lessonSnap.exists()) {
    const current = (lessonSnap.data().bookmarkCount as number) ?? 0;
    await updateDoc(lessonRef, { bookmarkCount: Math.max(0, current - 1) });
  }
}

/** Returns all lessons bookmarked by a user (as Bookmark records). */
export async function getUserBookmarks(userId: string): Promise<Bookmark[]> {
  if (!db) return [];
  const q = query(collection(db, "bookmarks"), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => d.data() as Bookmark);
}
