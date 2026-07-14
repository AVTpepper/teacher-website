import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
  increment,
  collection,
  collectionGroup,
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
} from "@/lib/firestore/commentThreads";

// --- Slug helper ---

export function threadSlug(title: string, id: string): string {
  return makeSlug(title, id);
}

export function parseThreadSlug(slug: string): string {
  return parseSlug(slug);
}

// --- Forum category definitions ---

export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  threadCount: number;
  lastActivityAt: Timestamp | null;
}

export const FORUM_CATEGORIES: Omit<ForumCategory, "threadCount" | "lastActivityAt">[] = [
  {
    id: "classroom-management",
    name: "Classroom Management",
    description: "Strategies for maintaining a productive and positive classroom environment.",
    icon: "🏫",
  },
  {
    id: "lesson-planning",
    name: "Lesson Planning",
    description: "Tips, templates, and ideas for effective lesson planning.",
    icon: "📋",
  },
  {
    id: "student-engagement",
    name: "Student Engagement",
    description: "Creative ways to keep students motivated and involved.",
    icon: "🙋",
  },
  {
    id: "technology-in-education",
    name: "Technology in Education",
    description: "EdTech tools, digital resources, and tech integration strategies.",
    icon: "💻",
  },
  {
    id: "teacher-support",
    name: "Teacher Support",
    description: "Peer support, mental health, work-life balance, and career advice.",
    icon: "🤝",
  },
  {
    id: "grade-level-discussions",
    name: "Grade-Level Discussions",
    description: "Conversations specific to your grade level and age group.",
    icon: "📚",
  },
  {
    id: "general-discussion",
    name: "General Discussion",
    description: "Anything that doesn't fit elsewhere - open conversations for the educator community.",
    icon: "💬",
  },
  {
    id: "questions-answers",
    name: "Q&A",
    description: "Ask a question, get answers from fellow educators.",
    icon: "❓",
  },
];

// --- Thread types ---

export interface AttachedLink {
  url: string;
  label: string;
}

export interface ForumThread {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  tags: string[];
  gradeLevel: string;
  subject: string;
  links: AttachedLink[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  upvotes: number;
  downvotes: number;
  commentCount: number;
}

export interface ForumThreadInput {
  categoryId: string;
  title: string;
  content: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  tags: string[];
  gradeLevel: string;
  subject: string;
  links?: AttachedLink[];
}

// --- Thread comment types ---

export interface ThreadComment {
  id: string;
  threadId: string;
  parentId: string | null; // null = top-level, string = nested reply
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  mentionedUsers?: { uid: string; displayName: string }[];
  createdAt: Timestamp | null;
  editedAt?: Timestamp | null;
  deleted?: boolean;
  likesCount: number;
  upvotes: number;
  downvotes: number;
}

export interface ThreadCommentInput {
  parentId?: string | null;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  mentionedUsers?: { uid: string; displayName: string }[];
}

// --- Category helpers ---

export async function getCategory(categoryId: string): Promise<ForumCategory | null> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "forums", categoryId));
  if (!snap.exists()) return null;
  return snap.data() as ForumCategory;
}

export async function getCategories(): Promise<ForumCategory[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const snapshot = await getDocs(collection(db, "forums"));
  const stored = new Map(snapshot.docs.map((d) => [d.id, d.data() as ForumCategory]));

  // Return all defined categories, merging with stored data
  return FORUM_CATEGORIES.map((cat) => {
    const data = stored.get(cat.id);
    return {
      ...cat,
      threadCount: data?.threadCount ?? 0,
      lastActivityAt: data?.lastActivityAt ?? null,
    };
  });
}

/** Ensure a category document exists in Firestore (idempotent). */
async function ensureCategory(categoryId: string): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(db, "forums", categoryId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const cat = FORUM_CATEGORIES.find((c) => c.id === categoryId);
    if (!cat) throw new Error(`Unknown category: ${categoryId}`);
    await setDoc(ref, {
      ...cat,
      threadCount: 0,
      lastActivityAt: null,
    });
  }
}

// --- Thread CRUD ---

const THREADS_PAGE_SIZE = 15;

export async function createThread(data: ForumThreadInput): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  await ensureCategory(data.categoryId);

  const ref = doc(collection(db, "forums", data.categoryId, "threads"));

  await setDoc(ref, {
    ...data,
    id: ref.id,
    links: data.links ?? [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    upvotes: 0,
    downvotes: 0,
    commentCount: 0,
  });

  // Update category stats
  await updateDoc(doc(db, "forums", data.categoryId), {
    threadCount: increment(1),
    lastActivityAt: serverTimestamp(),
  });

  return ref.id;
}

export interface GetThreadsResult {
  threads: ForumThread[];
  lastDoc: DocumentSnapshot | null;
}

export async function getThreads(
  categoryId: string,
  cursor?: DocumentSnapshot | null
): Promise<GetThreadsResult> {
  if (!db) throw new Error("Firestore is not initialized");

  const constraints: QueryConstraint[] = [
    orderBy("createdAt", "desc"),
    limit(THREADS_PAGE_SIZE),
  ];

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(
    collection(db, "forums", categoryId, "threads"),
    ...constraints
  );
  const snapshot = await getDocs(q);

  const threads = snapshot.docs.map((d) => d.data() as ForumThread);
  const lastDoc =
    snapshot.docs.length === THREADS_PAGE_SIZE
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

  return { threads, lastDoc };
}

export async function getThread(
  categoryId: string,
  threadId: string
): Promise<ForumThread | null> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(
    doc(db, "forums", categoryId, "threads", threadId)
  );
  if (!snap.exists()) return null;
  return snap.data() as ForumThread;
}

/** Get all forum threads created by a specific author across all categories. */
export async function getThreadsByAuthor(
  authorId: string
): Promise<GetThreadsResult> {
  if (!db) throw new Error("Firestore is not initialized");

  // collectionGroup queries all 'threads' subcollections across every category.
  // Single equality where() uses the auto single-field index - no composite needed.
  // Sort client-side to avoid orderBy composite index requirement.
  const q = query(
    collectionGroup(db, "threads"),
    where("authorId", "==", authorId)
  );
  const snapshot = await getDocs(q);

  const threads = snapshot.docs
    .map((d) => d.data() as ForumThread)
    .sort(byCreatedAtDesc);

  return { threads, lastDoc: null };
}

/** Search all categories for a thread by ID. Returns thread + categoryId. */
export async function findThreadById(
  threadId: string
): Promise<{ thread: ForumThread; categoryId: string } | null> {
  if (!db) throw new Error("Firestore is not initialized");

  for (const cat of FORUM_CATEGORIES) {
    const thread = await getThread(cat.id, threadId);
    if (thread) return { thread, categoryId: cat.id };
  }
  return null;
}

// --- Upvote / downvote system ---

export async function upvoteThread(
  categoryId: string,
  threadId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  const voteRef = doc(
    db,
    "forums",
    categoryId,
    "threads",
    threadId,
    "votes",
    userId
  );
  const threadRef = doc(db, "forums", categoryId, "threads", threadId);

  const existing = await getDoc(voteRef);
  const prevVote = existing.exists() ? (existing.data().vote as string) : null;

  if (prevVote === "up") {
    // Remove upvote
    await deleteDoc(voteRef);
    await updateDoc(threadRef, { upvotes: increment(-1) });
  } else if (prevVote === "down") {
    // Switch from down to up
    await setDoc(voteRef, { vote: "up", votedAt: serverTimestamp() });
    await updateDoc(threadRef, {
      upvotes: increment(1),
      downvotes: increment(-1),
    });
  } else {
    // New upvote
    await setDoc(voteRef, { vote: "up", votedAt: serverTimestamp() });
    await updateDoc(threadRef, { upvotes: increment(1) });
  }
}

export async function downvoteThread(
  categoryId: string,
  threadId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  const voteRef = doc(
    db,
    "forums",
    categoryId,
    "threads",
    threadId,
    "votes",
    userId
  );
  const threadRef = doc(db, "forums", categoryId, "threads", threadId);

  const existing = await getDoc(voteRef);
  const prevVote = existing.exists() ? (existing.data().vote as string) : null;

  if (prevVote === "down") {
    // Remove downvote
    await deleteDoc(voteRef);
    await updateDoc(threadRef, { downvotes: increment(-1) });
  } else if (prevVote === "up") {
    // Switch from up to down
    await setDoc(voteRef, { vote: "down", votedAt: serverTimestamp() });
    await updateDoc(threadRef, {
      upvotes: increment(-1),
      downvotes: increment(1),
    });
  } else {
    // New downvote
    await setDoc(voteRef, { vote: "down", votedAt: serverTimestamp() });
    await updateDoc(threadRef, { downvotes: increment(1) });
  }
}

export async function getUserVote(
  categoryId: string,
  threadId: string,
  userId: string
): Promise<"up" | "down" | null> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(
    doc(db, "forums", categoryId, "threads", threadId, "votes", userId)
  );
  if (!snap.exists()) return null;
  return snap.data().vote as "up" | "down";
}

// --- Thread comments ---

export async function addThreadComment(
  categoryId: string,
  threadId: string,
  data: ThreadCommentInput
): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(
    collection(db, "forums", categoryId, "threads", threadId, "comments")
  );

  await setDoc(ref, {
    ...data,
    id: ref.id,
    threadId,
    parentId: data.parentId ?? null,
    mentionedUsers: data.mentionedUsers ?? [],
    createdAt: serverTimestamp(),
    likesCount: 0,
    upvotes: 0,
    downvotes: 0,
  });

  // Update thread comment count
  await updateDoc(doc(db, "forums", categoryId, "threads", threadId), {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  // Update category last activity
  await updateDoc(doc(db, "forums", categoryId), {
    lastActivityAt: serverTimestamp(),
  });

  return ref.id;
}

export async function getThreadComments(
  categoryId: string,
  threadId: string
): Promise<ThreadComment[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const q = query(
    collection(db, "forums", categoryId, "threads", threadId, "comments"),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => d.data() as ThreadComment);
}

export async function updateThreadComment(
  categoryId: string,
  threadId: string,
  commentId: string,
  text: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");
  await updateDoc(
    doc(db, "forums", categoryId, "threads", threadId, "comments", commentId),
    {
      content: text.trim().slice(0, 2000),
      editedAt: serverTimestamp(),
    }
  );
}

export async function deleteThreadComment(
  categoryId: string,
  threadId: string,
  commentId: string
): Promise<DeleteCommentResult> {
  return deleteCommentWithReplies({
    collectionPath: ["forums", categoryId, "threads", threadId, "comments"],
    commentId,
    countTargetPath: ["forums", categoryId, "threads", threadId],
    countField: "commentCount",
    touchTargetPath: ["forums", categoryId, "threads", threadId],
  });
}

export async function likeThreadComment(
  categoryId: string,
  threadId: string,
  commentId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await setDoc(
    doc(db, "forums", categoryId, "threads", threadId, "comments", commentId, "likes", userId),
    { likedAt: serverTimestamp() }
  );
  await updateDoc(
    doc(db, "forums", categoryId, "threads", threadId, "comments", commentId),
    { likesCount: increment(1) }
  );
}

export async function unlikeThreadComment(
  categoryId: string,
  threadId: string,
  commentId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await deleteDoc(
    doc(db, "forums", categoryId, "threads", threadId, "comments", commentId, "likes", userId)
  );
  await updateDoc(
    doc(db, "forums", categoryId, "threads", threadId, "comments", commentId),
    { likesCount: increment(-1) }
  );
}

export async function hasLikedThreadComment(
  categoryId: string,
  threadId: string,
  commentId: string,
  userId: string
): Promise<boolean> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(
    doc(db, "forums", categoryId, "threads", threadId, "comments", commentId, "likes", userId)
  );
  return snap.exists();
}

// --- Comment voting ---

export async function upvoteComment(
  categoryId: string,
  threadId: string,
  commentId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  const voteRef = doc(
    db,
    "forums",
    categoryId,
    "threads",
    threadId,
    "comments",
    commentId,
    "votes",
    userId
  );
  const commentRef = doc(
    db,
    "forums",
    categoryId,
    "threads",
    threadId,
    "comments",
    commentId
  );

  const existing = await getDoc(voteRef);
  const prevVote = existing.exists() ? (existing.data().vote as string) : null;

  if (prevVote === "up") {
    await deleteDoc(voteRef);
    await updateDoc(commentRef, { upvotes: increment(-1) });
  } else if (prevVote === "down") {
    await setDoc(voteRef, { vote: "up", votedAt: serverTimestamp() });
    await updateDoc(commentRef, {
      upvotes: increment(1),
      downvotes: increment(-1),
    });
  } else {
    await setDoc(voteRef, { vote: "up", votedAt: serverTimestamp() });
    await updateDoc(commentRef, { upvotes: increment(1) });
  }
}

export async function getUserCommentVote(
  categoryId: string,
  threadId: string,
  commentId: string,
  userId: string
): Promise<"up" | "down" | null> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(
    doc(
      db,
      "forums",
      categoryId,
      "threads",
      threadId,
      "comments",
      commentId,
      "votes",
      userId
    )
  );
  if (!snap.exists()) return null;
  return snap.data().vote as "up" | "down";
}
