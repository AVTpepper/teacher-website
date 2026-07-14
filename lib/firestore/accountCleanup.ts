import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  documentId,
  getDoc,
  getDocs,
  increment,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { deleteCommentWithReplies } from "@/lib/firestore/commentThreads";

function requireCleanupDb() {
  if (!db) throw new Error("Firestore is not initialized");
  return db;
}

async function deleteSubcollectionDocs(path: string[]) {
  const firestore = requireCleanupDb();
  const [firstSegment, ...restSegments] = path;
  if (!firstSegment) return;
  const snapshot = await getDocs(collection(firestore, firstSegment, ...restSegments));
  await Promise.all(snapshot.docs.map((entry) => deleteDoc(entry.ref)));
}

async function deleteCommentCollection(path: string[], nestedSubcollections: string[]) {
  const firestore = requireCleanupDb();
  const [firstSegment, ...restSegments] = path;
  if (!firstSegment) return;
  const snapshot = await getDocs(collection(firestore, firstSegment, ...restSegments));

  for (const commentDoc of snapshot.docs) {
    for (const subcollectionName of nestedSubcollections) {
      await deleteSubcollectionDocs([...path, commentDoc.id, subcollectionName]);
    }
    await deleteDoc(commentDoc.ref);
  }
}

async function deleteOwnedPosts(userId: string) {
  const firestore = requireCleanupDb();
  const snapshot = await getDocs(query(collection(firestore, "posts"), where("authorId", "==", userId)));

  for (const postDoc of snapshot.docs) {
    await deleteSubcollectionDocs(["posts", postDoc.id, "likes"]);
    await deleteCommentCollection(["posts", postDoc.id, "comments"], ["likes"]);
    await deleteDoc(postDoc.ref);
  }
}

async function deleteOwnedResources(userId: string) {
  const firestore = requireCleanupDb();
  const snapshot = await getDocs(query(collection(firestore, "resources"), where("authorId", "==", userId)));

  for (const resourceDoc of snapshot.docs) {
    await deleteSubcollectionDocs(["resources", resourceDoc.id, "downloads"]);
    await deleteSubcollectionDocs(["resources", resourceDoc.id, "saves"]);
    await deleteSubcollectionDocs(["resources", resourceDoc.id, "ratings"]);
    await deleteCommentCollection(["resources", resourceDoc.id, "comments"], ["likes"]);
    await deleteDoc(resourceDoc.ref);
  }
}

async function deleteOwnedLessons(userId: string) {
  const firestore = requireCleanupDb();
  const snapshot = await getDocs(query(collection(firestore, "lessons"), where("authorId", "==", userId)));

  for (const lessonDoc of snapshot.docs) {
    await deleteSubcollectionDocs(["lessons", lessonDoc.id, "downloads"]);
    await deleteCommentCollection(["lessons", lessonDoc.id, "comments"], ["likes"]);

    const bookmarkSnapshot = await getDocs(query(collection(firestore, "bookmarks"), where("lessonId", "==", lessonDoc.id)));
    await Promise.all(bookmarkSnapshot.docs.map((bookmarkDoc) => deleteDoc(bookmarkDoc.ref)));

    const ratingSnapshot = await getDocs(query(collection(firestore, "ratings"), where("lessonId", "==", lessonDoc.id)));
    await Promise.all(ratingSnapshot.docs.map((ratingDoc) => deleteDoc(ratingDoc.ref)));

    await deleteDoc(lessonDoc.ref);
  }
}

async function deleteOwnedThreads(userId: string) {
  const firestore = requireCleanupDb();
  const snapshot = await getDocs(query(collectionGroup(firestore, "threads"), where("authorId", "==", userId)));

  for (const threadDoc of snapshot.docs) {
    const segments = threadDoc.ref.path.split("/");
    const categoryId = segments[1];
    const threadId = threadDoc.id;

    await deleteSubcollectionDocs(["forums", categoryId, "threads", threadId, "votes"]);
    await deleteCommentCollection(["forums", categoryId, "threads", threadId, "comments"], ["likes", "votes"]);
    await deleteDoc(threadDoc.ref);
    await updateDoc(doc(firestore, "forums", categoryId), {
      threadCount: increment(-1),
    }).catch(() => {});
  }
}

async function deleteUserComments(userId: string) {
  const firestore = requireCleanupDb();
  const snapshot = await getDocs(query(collectionGroup(firestore, "comments"), where("authorId", "==", userId)));

  for (const commentDoc of snapshot.docs) {
    const segments = commentDoc.ref.path.split("/");

    await deleteSubcollectionDocs([...segments, "likes"]).catch(() => {});
    await deleteSubcollectionDocs([...segments, "votes"]).catch(() => {});

    if (segments[0] === "posts") {
      await deleteCommentWithReplies({
        collectionPath: ["posts", segments[1], "comments"],
        commentId: segments[3],
        countTargetPath: ["posts", segments[1]],
        countField: "commentCount",
      }).catch(() => {});
      continue;
    }

    if (segments[0] === "resources") {
      await deleteCommentWithReplies({
        collectionPath: ["resources", segments[1], "comments"],
        commentId: segments[3],
      }).catch(() => {});
      continue;
    }

    if (segments[0] === "lessons") {
      await deleteCommentWithReplies({
        collectionPath: ["lessons", segments[1], "comments"],
        commentId: segments[3],
      }).catch(() => {});
      continue;
    }

    if (segments[0] === "forums") {
      await deleteCommentWithReplies({
        collectionPath: ["forums", segments[1], "threads", segments[3], "comments"],
        commentId: segments[5],
        countTargetPath: ["forums", segments[1], "threads", segments[3]],
        countField: "commentCount",
        touchTargetPath: ["forums", segments[1], "threads", segments[3]],
      }).catch(() => {});
    }
  }
}

async function cleanupUserRelationships(userId: string) {
  const firestore = requireCleanupDb();
  const followersSnapshot = await getDocs(collection(firestore, "users", userId, "followers"));
  for (const followerDoc of followersSnapshot.docs) {
    const followerId = followerDoc.id;
    await deleteDoc(followerDoc.ref);
    await deleteDoc(doc(firestore, "users", followerId, "following", userId)).catch(() => {});
    await updateDoc(doc(firestore, "users", followerId), {
      followingCount: increment(-1),
    }).catch(() => {});
  }

  const followingSnapshot = await getDocs(collection(firestore, "users", userId, "following"));
  for (const followingDoc of followingSnapshot.docs) {
    const followedUserId = followingDoc.id;
    await deleteDoc(followingDoc.ref);
    await deleteDoc(doc(firestore, "users", followedUserId, "followers", userId)).catch(() => {});
    await updateDoc(doc(firestore, "users", followedUserId), {
      followerCount: increment(-1),
    }).catch(() => {});
  }

  for (const subcollectionName of ["aiUsage", "aiRefineUsage", "notifications"]) {
    await deleteSubcollectionDocs(["users", userId, subcollectionName]);
  }
}

async function cleanupBookmarksAndRatings(userId: string) {
  const firestore = requireCleanupDb();

  const bookmarkSnapshot = await getDocs(query(collection(firestore, "bookmarks"), where("userId", "==", userId)));
  for (const bookmarkDoc of bookmarkSnapshot.docs) {
    const lessonId = bookmarkDoc.data().lessonId as string | undefined;
    await deleteDoc(bookmarkDoc.ref);
    if (!lessonId) continue;
    const lessonRef = doc(firestore, "lessons", lessonId);
    const lessonSnap = await getDoc(lessonRef);
    if (lessonSnap.exists()) {
      const current = (lessonSnap.data().bookmarkCount as number) ?? 0;
      await updateDoc(lessonRef, { bookmarkCount: Math.max(0, current - 1) }).catch(() => {});
    }
  }

  const ratingSnapshot = await getDocs(query(collection(firestore, "ratings"), where("userId", "==", userId)));
  const affectedLessonIds = new Set<string>();
  for (const ratingDoc of ratingSnapshot.docs) {
    const lessonId = ratingDoc.data().lessonId as string | undefined;
    if (lessonId) affectedLessonIds.add(lessonId);
    await deleteDoc(ratingDoc.ref);
  }

  for (const lessonId of affectedLessonIds) {
    const remainingRatings = await getDocs(query(collection(firestore, "ratings"), where("lessonId", "==", lessonId)));
    const values = remainingRatings.docs.map((entry) => entry.data().value as number);
    const nextCount = values.length;
    const nextAverage = nextCount > 0 ? Math.round((values.reduce((sum, value) => sum + value, 0) / nextCount) * 10) / 10 : 0;
    await updateDoc(doc(firestore, "lessons", lessonId), {
      ratingCount: nextCount,
      ratingAverage: nextAverage,
    }).catch(() => {});
  }

  const resourceSaveSnapshot = await getDocs(query(collectionGroup(firestore, "saves"), where(documentId(), "==", userId)));
  for (const saveDoc of resourceSaveSnapshot.docs) {
    const segments = saveDoc.ref.path.split("/");
    if (segments[0] !== "resources") continue;
    await deleteDoc(saveDoc.ref);
    await updateDoc(doc(firestore, "resources", segments[1]), {
      savedByCount: increment(-1),
    }).catch(() => {});
  }

  const resourceRatingSnapshot = await getDocs(query(collectionGroup(firestore, "ratings"), where(documentId(), "==", userId)));
  for (const ratingDoc of resourceRatingSnapshot.docs) {
    const segments = ratingDoc.ref.path.split("/");
    if (segments[0] !== "resources") continue;
    const resourceId = segments[1];
    const ratingValue = (ratingDoc.data().rating as number) ?? 0;
    const resourceRef = doc(firestore, "resources", resourceId);
    const resourceSnap = await getDoc(resourceRef);
    if (resourceSnap.exists()) {
      const currentSum = (resourceSnap.data().ratingSum as number) ?? 0;
      const currentCount = (resourceSnap.data().ratingCount as number) ?? 0;
      const nextSum = Math.max(0, currentSum - ratingValue);
      const nextCount = Math.max(0, currentCount - 1);
      const nextAverage = nextCount > 0 ? Math.round((nextSum / nextCount) * 10) / 10 : 0;
      await updateDoc(resourceRef, {
        ratingSum: nextSum,
        ratingCount: nextCount,
        ratingAverage: nextAverage,
      }).catch(() => {});
    }
    await deleteDoc(ratingDoc.ref);
  }

  const downloadSnapshot = await getDocs(query(collectionGroup(firestore, "downloads"), where(documentId(), "==", userId)));
  await Promise.all(downloadSnapshot.docs.map((downloadDoc) => deleteDoc(downloadDoc.ref)));
}

export async function cleanupUserAccountData(userId: string) {
  const firestore = requireCleanupDb();

  await deleteOwnedPosts(userId);
  await deleteOwnedResources(userId);
  await deleteOwnedLessons(userId);
  await deleteOwnedThreads(userId);
  await deleteUserComments(userId);
  await cleanupBookmarksAndRatings(userId);
  await cleanupUserRelationships(userId);
  await deleteDoc(doc(firestore, "users", userId));
}