import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string | null;
  gradeLevel: string;
  subjects: string[];
  location: string;
  school: string;
  yearsOfExperience: number;
  bio: string;
  isVerified: boolean;
  createdAt: unknown;
  badges: string[];
  followerCount: number;
  followingCount: number;
}

export type UserProfileInput = Omit<
  UserProfile,
  "createdAt" | "badges" | "followerCount" | "followingCount" | "isVerified"
>;

export const GRADE_LEVELS = [
  "Kindergarten",
  "Elementary",
  "Middle School",
  "High School",
  "Higher Education",
] as const;

export const SUBJECTS = [
  "Math",
  "Science",
  "English",
  "History",
  "Art",
  "Music",
  "Physical Education",
  "Computer Science",
  "Foreign Language",
  "Special Education",
  "Social Studies",
  "Reading",
  "Writing",
  "STEM",
  "Other",
] as const;

export async function createUser(data: UserProfileInput): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await setDoc(doc(db, "users", data.uid), {
    ...data,
    isVerified: false,
    createdAt: serverTimestamp(),
    badges: [],
    followerCount: 0,
    followingCount: 0,
  });
}

export async function getUser(uid: string): Promise<UserProfile | null> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

export async function updateUser(
  uid: string,
  data: Partial<UserProfileInput>
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await updateDoc(doc(db, "users", uid), data);
}

export async function followUser(
  currentUid: string,
  targetUid: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  const batch = writeBatch(db);

  // Add to current user's following sub-collection
  batch.set(doc(db, "users", currentUid, "following", targetUid), {
    followedAt: serverTimestamp(),
  });

  // Add to target user's followers sub-collection
  batch.set(doc(db, "users", targetUid, "followers", currentUid), {
    followedAt: serverTimestamp(),
  });

  // Increment counts
  batch.update(doc(db, "users", currentUid), {
    followingCount: increment(1),
  });
  batch.update(doc(db, "users", targetUid), {
    followerCount: increment(1),
  });

  await batch.commit();
}

export async function unfollowUser(
  currentUid: string,
  targetUid: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  const batch = writeBatch(db);

  batch.delete(doc(db, "users", currentUid, "following", targetUid));
  batch.delete(doc(db, "users", targetUid, "followers", currentUid));

  batch.update(doc(db, "users", currentUid), {
    followingCount: increment(-1),
  });
  batch.update(doc(db, "users", targetUid), {
    followerCount: increment(-1),
  });

  await batch.commit();
}

export async function isFollowing(
  currentUid: string,
  targetUid: string
): Promise<boolean> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(
    doc(db, "users", currentUid, "following", targetUid)
  );
  return snap.exists();
}
