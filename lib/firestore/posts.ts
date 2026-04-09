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

// --- Post types ---

export type PostType = "idea" | "resource" | "discussion";

export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  type: PostType;
  tags: string[];
  gradeLevel: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
  likesCount: number;
  commentsCount: number;
}

export interface PostInput {
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  type: PostType;
  tags: string[];
  gradeLevel: string;
}

// --- Comment types ---

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
  createdAt: Timestamp | null;
}

export interface PostCommentInput {
  authorId: string;
  authorName: string;
  authorPhotoURL: string | null;
  content: string;
}

// --- Post CRUD ---

const PAGE_SIZE = 10;

export async function createPost(data: PostInput): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(collection(db, "posts"));

  await setDoc(ref, {
    ...data,
    id: ref.id,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    likesCount: 0,
    commentsCount: 0,
  });

  return ref.id;
}

export interface GetPostsResult {
  posts: Post[];
  lastDoc: DocumentSnapshot | null;
}

export async function getPosts(
  cursor?: DocumentSnapshot | null
): Promise<GetPostsResult> {
  if (!db) throw new Error("Firestore is not initialized");

  const constraints: QueryConstraint[] = [
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE),
  ];

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, "posts"), ...constraints);
  const snapshot = await getDocs(q);

  const posts = snapshot.docs.map((d) => d.data() as Post);
  const lastDoc =
    snapshot.docs.length === PAGE_SIZE
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

  return { posts, lastDoc };
}

export async function getPostsByAuthor(
  authorId: string,
  cursor?: DocumentSnapshot | null
): Promise<GetPostsResult> {
  if (!db) throw new Error("Firestore is not initialized");

  const constraints: QueryConstraint[] = [
    where("authorId", "==", authorId),
    orderBy("createdAt", "desc"),
    limit(PAGE_SIZE),
  ];

  if (cursor) {
    constraints.push(startAfter(cursor));
  }

  const q = query(collection(db, "posts"), ...constraints);
  const snapshot = await getDocs(q);

  const posts = snapshot.docs.map((d) => d.data() as Post);
  const lastDoc =
    snapshot.docs.length === PAGE_SIZE
      ? snapshot.docs[snapshot.docs.length - 1]
      : null;

  return { posts, lastDoc };
}

export async function getPost(postId: string): Promise<Post | null> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "posts", postId));
  if (!snap.exists()) return null;
  return snap.data() as Post;
}

// --- Like system ---

export async function likePost(
  postId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await setDoc(doc(db, "posts", postId, "likes", userId), {
    likedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "posts", postId), {
    likesCount: increment(1),
  });
}

export async function unlikePost(
  postId: string,
  userId: string
): Promise<void> {
  if (!db) throw new Error("Firestore is not initialized");

  await deleteDoc(doc(db, "posts", postId, "likes", userId));
  await updateDoc(doc(db, "posts", postId), {
    likesCount: increment(-1),
  });
}

export async function hasLikedPost(
  postId: string,
  userId: string
): Promise<boolean> {
  if (!db) throw new Error("Firestore is not initialized");

  const snap = await getDoc(doc(db, "posts", postId, "likes", userId));
  return snap.exists();
}

// --- Comment system ---

export async function commentOnPost(
  postId: string,
  data: PostCommentInput
): Promise<string> {
  if (!db) throw new Error("Firestore is not initialized");

  const ref = doc(collection(db, "posts", postId, "comments"));

  await setDoc(ref, {
    ...data,
    id: ref.id,
    postId,
    createdAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "posts", postId), {
    commentsCount: increment(1),
  });

  return ref.id;
}

export async function getPostComments(
  postId: string
): Promise<PostComment[]> {
  if (!db) throw new Error("Firestore is not initialized");

  const q = query(
    collection(db, "posts", postId, "comments"),
    orderBy("createdAt", "asc")
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((d) => d.data() as PostComment);
}
