import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  type DocumentSnapshot,
  type Timestamp,
  type QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { byCreatedAtDesc, byUpdatedAtDesc } from "@/lib/utils";

// --- Lesson types ---

export interface LessonStep {
  title: string;
  description: string;
}

export interface LessonAttachment {
  name: string;
  url: string;
}

export interface Lesson {
  id: string;
  title: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  gradeLevel: string;
  subject: string;
  duration: string;
  objectives: string[];
  materials: string[];
  steps: LessonStep[];
  attachments: LessonAttachment[];
  isPublic: boolean;
  remixedFromId: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  downloadCount: number;
}

export interface LessonInput {
  title: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  gradeLevel: string;
  subject: string;
  duration: string;
  objectives: string[];
  materials: string[];
  steps: LessonStep[];
  attachments: LessonAttachment[];
  isPublic: boolean;
  remixedFromId?: string | null;
}

// --- Lesson CRUD ---

const PAGE_SIZE = 12;

export async function createLesson(data: LessonInput): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(collection(db, "lessons"));

  await setDoc(ref, {
    ...data,
    id: ref.id,
    remixedFromId: data.remixedFromId ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    downloadCount: 0,
  });

  return ref.id;
}

export async function getLesson(lessonId: string): Promise<Lesson | null> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "lessons", lessonId));
  if (!snap.exists()) return null;
  return snap.data() as Lesson;
}

export async function updateLesson(
  lessonId: string,
  data: Partial<LessonInput>
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await updateDoc(doc(db, "lessons", lessonId), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export interface GetLessonsResult {
  lessons: Lesson[];
  lastDoc: DocumentSnapshot | null;
}

export async function getPublicLessons(
  filters?: { gradeLevel?: string; subject?: string },
  // cursor param kept for API compatibility but pagination is handled client-side
  _cursor?: DocumentSnapshot | null
): Promise<GetLessonsResult> {
  if (!db) throw new Error("Firestore is not initialized");

  // Only equality where() filters — no composite index required.
  // orderBy is done client-side to avoid needing a composite index.
  const constraints: QueryConstraint[] = [
    where("isPublic", "==", true),
  ];

  if (filters?.gradeLevel) {
    constraints.push(where("gradeLevel", "==", filters.gradeLevel));
  }
  if (filters?.subject) {
    constraints.push(where("subject", "==", filters.subject));
  }

  const q = query(collection(db, "lessons"), ...constraints);
  const snapshot = await getDocs(q);

  const lessons = snapshot.docs
    .map((d) => d.data() as Lesson)
    .sort(byCreatedAtDesc);

  return { lessons, lastDoc: null };
}

export async function getLessonsByAuthor(
  authorId: string,
  includePrivate = false,
  // cursor + pageSize params kept for API compatibility
  _cursor?: DocumentSnapshot | null,
  _pageSize = PAGE_SIZE
): Promise<GetLessonsResult> {
  if (!db) throw new Error("Firestore is not initialized");

  // Single equality where() — no composite index required.
  // Filtering by isPublic and sorting are done client-side.
  const q = query(
    collection(db, "lessons"),
    where("authorId", "==", authorId)
  );

  const snapshot = await getDocs(q);

  let lessons = snapshot.docs.map((d) => d.data() as Lesson);

  if (!includePrivate) {
    lessons = lessons.filter((l) => l.isPublic);
  }

  lessons.sort(byUpdatedAtDesc);

  return { lessons, lastDoc: null };
}

// --- Download tracking ---

export async function trackLessonDownload(
  lessonId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await setDoc(doc(db, "lessons", lessonId, "downloads", userId), {
    downloadedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "lessons", lessonId), {
    downloadCount: increment(1),
  });
}

// --- Comment system ---

export interface LessonComment {
  id: string;
  lessonId: string;
  parentId: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  createdAt: Timestamp | null;
}

export interface LessonCommentInput {
  parentId?: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
}

export async function addLessonComment(
  lessonId: string,
  data: LessonCommentInput
): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(collection(db, "lessons", lessonId, "comments"));

  await setDoc(ref, {
    ...data,
    id: ref.id,
    lessonId,
    parentId: data.parentId ?? null,
    createdAt: serverTimestamp(),
  });

  return ref.id;
}

export async function getLessonComments(
  lessonId: string
): Promise<LessonComment[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const q = query(
    collection(db, "lessons", lessonId, "comments"),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => d.data() as LessonComment);
}
