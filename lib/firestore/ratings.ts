import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  type Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface Rating {
  id: string;         // "{userId}_{lessonId}"
  userId: string;
  lessonId: string;
  value: number;      // 1–5
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

function ratingId(userId: string, lessonId: string) {
  return `${userId}_${lessonId}`;
}

/** Returns the current user's rating (1-5) for a lesson, or null if not rated. */
export async function getUserRating(userId: string, lessonId: string): Promise<number | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, "ratings", ratingId(userId, lessonId)));
  if (!snap.exists()) return null;
  return (snap.data().value as number) ?? null;
}

/**
 * Submits or updates a rating. Recalculates the lesson's ratingAverage and ratingCount.
 * value must be 1–5.
 */
export async function submitRating(userId: string, lessonId: string, value: number): Promise<void> {
  if (!db) throw new Error("Firestore not initialized");
  if (value < 1 || value > 5) throw new RangeError("Rating must be 1–5");

  const id = ratingId(userId, lessonId);
  const ratingRef = doc(db, "ratings", id);
  const existing = await getDoc(ratingRef);

  if (existing.exists()) {
    await updateDoc(ratingRef, { value, updatedAt: serverTimestamp() });
  } else {
    await setDoc(ratingRef, {
      id,
      userId,
      lessonId,
      value,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // Recalculate aggregate from all ratings for this lesson
  const q = query(collection(db, "ratings"), where("lessonId", "==", lessonId));
  const snap = await getDocs(q);
  const values = snap.docs.map((d) => d.data().value as number);
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  await updateDoc(doc(db, "lessons", lessonId), {
    ratingAverage: Math.round(avg * 10) / 10,
    ratingCount: values.length,
  });
}
