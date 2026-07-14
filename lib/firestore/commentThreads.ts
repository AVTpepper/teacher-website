import {
  collection,
  deleteDoc,
  type DocumentReference,
  doc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { requireDb } from "@/lib/utils";

export interface DeleteCommentResult {
  removed: boolean;
  tombstoned: boolean;
}

interface DeleteCommentOptions {
  collectionPath: string[];
  commentId: string;
  countTargetPath?: string[];
  countField?: string;
  touchTargetPath?: string[];
}

export async function deleteCommentWithReplies(
  options: DeleteCommentOptions
): Promise<DeleteCommentResult> {
  const db = requireDb();
  const [commentsRoot, ...commentPathRest] = options.collectionPath;
  if (!commentsRoot) {
    throw new Error("Comment collection path is required");
  }

  const commentsRef = collection(db, commentsRoot, ...commentPathRest);
  const commentRef = doc(db, commentsRoot, ...commentPathRest, options.commentId);

  const childSnapshot = await getDocs(
    query(commentsRef, where("parentId", "==", options.commentId), limit(1))
  );

  if (!childSnapshot.empty) {
    await updateDoc(commentRef, {
      content: "",
      deleted: true,
      editedAt: serverTimestamp(),
    });

    return { removed: false, tombstoned: true };
  }

  await deleteDoc(commentRef);

  if (options.countTargetPath && options.countField) {
    const [countRoot, ...countPathRest] = options.countTargetPath;
    if (!countRoot) {
      throw new Error("Count target path is required");
    }

    await updateDoc(doc(db, countRoot, ...countPathRest), {
      [options.countField]: increment(-1),
    });
  }

  if (options.touchTargetPath) {
    const [touchRoot, ...touchPathRest] = options.touchTargetPath;
    if (!touchRoot) {
      throw new Error("Touch target path is required");
    }

    await updateDoc(doc(db, touchRoot, ...touchPathRest), {
      updatedAt: serverTimestamp(),
    });
  }

  return { removed: true, tombstoned: false };
}

export function migrateLegacyCommentFields<
  T extends { likesCount?: number; deleted?: boolean }
>(
  commentRef: DocumentReference,
  data: T
): T & { likesCount: number; deleted: boolean } {
  const updates: Record<string, number | boolean> = {};

  if (typeof data.likesCount !== "number") {
    updates.likesCount = 0;
  }

  if (typeof data.deleted !== "boolean") {
    updates.deleted = false;
  }

  if (Object.keys(updates).length > 0) {
    updateDoc(commentRef, updates).catch(() => {});
  }

  return {
    ...data,
    likesCount: data.likesCount ?? 0,
    deleted: data.deleted ?? false,
  };
}