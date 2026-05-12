import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  writeBatch,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  displayName: string;
  /** Lowercase version of displayName used for case-insensitive prefix search. */
  displayNameLower?: string;
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
  "createdAt" | "badges" | "followerCount" | "followingCount" | "isVerified" | "displayNameLower"
>;

export const GRADE_LEVELS = [
  "Kindergarten",
  "Elementary",
  "Middle School",
  "High School",
  "Higher Education",
] as const;

export const SUBJECTS = [
  "Cross-Curricular",
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
    displayNameLower: data.displayName.toLowerCase(),
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

  const payload: Record<string, unknown> = { ...data };
  if (data.displayName !== undefined) {
    payload.displayNameLower = data.displayName.toLowerCase();
  }
  await updateDoc(doc(db, "users", uid), payload);
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

// --- Educator discovery ---

export interface SearchEducatorsFilters {
  gradeLevel?: string;
  subject?: string;
  /** Prefix match on displayNameLower for case-insensitive name search. */
  nameQuery?: string;
}

export interface SearchEducatorsResult {
  educators: UserProfile[];
  lastDoc: DocumentSnapshot | null;
}

const PAGE_SIZE = 12;

export async function searchEducators(
  filters: SearchEducatorsFilters,
  cursor?: DocumentSnapshot | null
): Promise<SearchEducatorsResult> {
  if (!db) throw new Error("Firestore is not initialized");

  // --- Name search path ---
  // Uses a prefix-range query on displayNameLower (no composite index needed).
  // gradeLevel / subject are applied client-side.
  if (filters.nameQuery?.trim()) {
    const lower = filters.nameQuery.trim().toLowerCase();
    const upper = lower + "\uf8ff";
    const q = query(
      collection(db, "users"),
      where("displayNameLower", ">=", lower),
      where("displayNameLower", "<=", upper),
      orderBy("displayNameLower"),
      limit(PAGE_SIZE * 4) // fetch extra to account for client-side filtering
    );
    const snapshot = await getDocs(q);
    let educators = snapshot.docs.map((d) => d.data() as UserProfile);

    if (filters.gradeLevel) {
      educators = educators.filter((e) => e.gradeLevel === filters.gradeLevel);
    }
    if (filters.subject) {
      educators = educators.filter((e) => e.subjects?.includes(filters.subject!));
    }

    return { educators: educators.slice(0, PAGE_SIZE), lastDoc: null };
  }

  // --- Filter path (no name query) ---
  const constraints = [];

  if (filters.gradeLevel) {
    constraints.push(where("gradeLevel", "==", filters.gradeLevel));
  }

  if (filters.subject) {
    constraints.push(where("subjects", "array-contains", filters.subject));
  }

  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(PAGE_SIZE));

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, "users"), ...constraints);
  const snapshot = await getDocs(q);

  const educators = snapshot.docs.map((d) => d.data() as UserProfile);
  const lastDoc =
    snapshot.docs.length === PAGE_SIZE
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

  return { educators, lastDoc };
}

// --- Mention / @username search ---

export async function searchUsersByDisplayName(
  prefix: string,
  max = 5
): Promise<{ uid: string; displayName: string; photoURL: string | null }[]> {
  if (!db || !prefix.trim()) return [];

  // Query against displayNameLower for case-insensitive prefix matching.
  const lower = prefix.toLowerCase();
  const end = lower + "\uf8ff";

  const q = query(
    collection(db, "users"),
    orderBy("displayNameLower"),
    where("displayNameLower", ">=", lower),
    where("displayNameLower", "<=", end),
    limit(max)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data() as UserProfile;
    return { uid: data.uid, displayName: data.displayName, photoURL: data.photoURL };
  });
}
