import { FieldValue, type Query } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";

const DELETE_BATCH_SIZE = 100;

async function deleteByQueryLoop(query: Query): Promise<number> {
  const db = getFirebaseAdminDb();
  let deleted = 0;

  while (true) {
    const snap = await query.limit(DELETE_BATCH_SIZE).get();
    if (snap.empty) break;

    for (const doc of snap.docs) {
      await db.recursiveDelete(doc.ref);
      deleted += 1;
    }

    if (snap.size < DELETE_BATCH_SIZE) break;
  }

  return deleted;
}

async function deleteTopLevelByField(
  collectionName: string,
  field: string,
  uid: string,
): Promise<number> {
  const db = getFirebaseAdminDb();
  return deleteByQueryLoop(db.collection(collectionName).where(field, "==", uid));
}

async function deleteCollectionGroupByField(
  groupName: string,
  field: string,
  uid: string,
): Promise<number> {
  const db = getFirebaseAdminDb();
  return deleteByQueryLoop(db.collectionGroup(groupName).where(field, "==", uid));
}

async function decrementCounterIfPresent(docPath: string, field: string): Promise<void> {
  const db = getFirebaseAdminDb();
  const ref = db.doc(docPath);
  const snap = await ref.get();
  if (!snap.exists) return;
  await ref.update({ [field]: FieldValue.increment(-1) }).catch(() => {});
}

async function cleanupRelationships(uid: string): Promise<void> {
  const db = getFirebaseAdminDb();

  const followersSnap = await db.collection(`users/${uid}/followers`).get();
  for (const followerDoc of followersSnap.docs) {
    const followerId = followerDoc.id;
    await followerDoc.ref.delete().catch(() => {});
    await db.doc(`users/${followerId}/following/${uid}`).delete().catch(() => {});
    await decrementCounterIfPresent(`users/${followerId}`, "followingCount");
  }

  const followingSnap = await db.collection(`users/${uid}/following`).get();
  for (const followingDoc of followingSnap.docs) {
    const followedUserId = followingDoc.id;
    await followingDoc.ref.delete().catch(() => {});
    await db.doc(`users/${followedUserId}/followers/${uid}`).delete().catch(() => {});
    await decrementCounterIfPresent(`users/${followedUserId}`, "followerCount");
  }
}

async function cleanupTopLevelReferences(uid: string): Promise<void> {
  await deleteTopLevelByField("posts", "authorId", uid);
  await deleteTopLevelByField("resources", "authorId", uid);
  await deleteTopLevelByField("lessons", "authorId", uid);
  await deleteTopLevelByField("jobs", "postedBy", uid);
  await deleteTopLevelByField("inspiration", "submittedBy", uid);
  await deleteTopLevelByField("bookmarks", "userId", uid);
  await deleteTopLevelByField("ratings", "userId", uid);
}

async function cleanupNestedReferences(uid: string): Promise<void> {
  await deleteCollectionGroupByField("threads", "authorId", uid);
  await deleteCollectionGroupByField("comments", "authorId", uid);
}

export async function processAccountDeletion(uid: string): Promise<void> {
  const db = getFirebaseAdminDb();

  await cleanupTopLevelReferences(uid);
  await cleanupNestedReferences(uid);
  await cleanupRelationships(uid);

  await db.recursiveDelete(db.doc(`users/${uid}`));

  await getFirebaseAdminAuth().deleteUser(uid).catch(() => {
    // The user may already be deleted or disabled.
  });
}

export async function queueAccountDeletion(uid: string): Promise<void> {
  const db = getFirebaseAdminDb();
  const requestRef = db.collection("accountDeletionRequests").doc(uid);

  await requestRef.set(
    {
      uid,
      status: "queued",
      requestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      attempts: FieldValue.increment(1),
    },
    { merge: true },
  );

  await db.doc(`users/${uid}`).set(
    {
      deletionStatus: "queued",
      deletionRequestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function processQueuedAccountDeletions(batchSize = 1): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const db = getFirebaseAdminDb();
  const safeBatchSize = Math.min(Math.max(batchSize, 1), 10);

  const queued = await db
    .collection("accountDeletionRequests")
    .where("status", "==", "queued")
    .limit(safeBatchSize)
    .get();

  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  for (const docSnap of queued.docs) {
    processed += 1;
    const uid = docSnap.id;

    try {
      await docSnap.ref.set(
        {
          status: "processing",
          startedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      await processAccountDeletion(uid);

      await docSnap.ref.set(
        {
          status: "completed",
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      succeeded += 1;
    } catch (error) {
      await docSnap.ref.set(
        {
          status: "failed",
          errorMessage: error instanceof Error ? error.message.slice(0, 500) : "unknown_error",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      failed += 1;
    }
  }

  return { processed, succeeded, failed };
}
