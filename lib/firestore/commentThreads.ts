import {
  collection,
  deleteDoc,
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
  const commentsRef = collection(db, ...options.collectionPath);
  const commentRef = doc(db, ...options.collectionPath, options.commentId);

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
    await updateDoc(doc(db, ...options.countTargetPath), {
      [options.countField]: increment(-1),
    });
  }

  if (options.touchTargetPath) {
    await updateDoc(doc(db, ...options.touchTargetPath), {
      updatedAt: serverTimestamp(),
    });
  }

  return { removed: true, tombstoned: false };
}