/**
 * Upserts Firestore doc: siteConfig/publicShowcase
 *
 * Usage:
 *   node scripts/set-public-showcase.mjs
 *
 * Requires one of:
 * - GOOGLE_APPLICATION_CREDENTIALS pointing to a service-account JSON file
 * - Firebase default application credentials in the environment
 */

import { initializeApp, applicationDefault, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "fs";

const MAX_EDUCATORS = 6;
const MAX_DISCUSSIONS = 6;
const MAX_INSPIRATION = 6;
const FORUM_CATEGORY_IDS = [
  "classroom-management",
  "lesson-planning",
  "student-engagement",
  "technology-in-education",
  "teacher-support",
  "grade-level-discussions",
  "general-discussion",
  "questions-answers",
];

function uniq(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function take(values, count) {
  return uniq(values).slice(0, count);
}

function bootstrapAdminApp() {
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (serviceAccountPath && existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    return initializeApp({ credential: cert(serviceAccount) });
  }

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  return initializeApp({ credential: applicationDefault() });
}

async function run() {
  bootstrapAdminApp();
  const db = getFirestore();

  const showcaseRef = db.collection("siteConfig").doc("publicShowcase");
  const currentSnap = await showcaseRef.get();
  const current = currentSnap.exists ? currentSnap.data() ?? {} : {};

  const [educatorSnap, discussionSnap, inspirationSnap] = await Promise.all([
    db.collection("users").orderBy("createdAt", "desc").limit(20).get().catch(() => ({ docs: [] })),
    db.collectionGroup("threads").orderBy("createdAt", "desc").limit(30).get().catch(() => ({ docs: [] })),
    db
      .collection("inspiration")
      .where("isApproved", "==", true)
      .orderBy("createdAt", "desc")
      .limit(30)
      .get()
      .catch(() => ({ docs: [] })),
  ]);

  const autoEducatorIds = educatorSnap.docs.map((doc) => doc.id);
  const autoDiscussionIds = discussionSnap.docs
    .map((doc) => doc.data())
    .map((data) => (typeof data.id === "string" ? data.id : ""));
  const autoInspirationIds = inspirationSnap.docs.map((doc) => doc.id);

  let fallbackDiscussionIds = [];
  if (autoDiscussionIds.filter(Boolean).length === 0) {
    const categorySnaps = await Promise.all(
      FORUM_CATEGORY_IDS.map((categoryId) =>
        db.collection("forums").doc(categoryId).collection("threads").limit(10).get().catch(() => ({ docs: [] }))
      )
    );

    fallbackDiscussionIds = categorySnaps
      .flatMap((snap) => snap.docs)
      .map((doc) => doc.data())
      .map((data) => (typeof data.id === "string" ? data.id : ""));
  }

  const payload = {
    educatorProfileIds: take([
      ...(Array.isArray(current.educatorProfileIds) ? current.educatorProfileIds : []),
      ...autoEducatorIds,
    ], MAX_EDUCATORS),
    lessonPlanIds: take(Array.isArray(current.lessonPlanIds) ? current.lessonPlanIds : [], 20),
    resourceIds: take(Array.isArray(current.resourceIds) ? current.resourceIds : [], 6),
    discussionIds: take([
      ...(Array.isArray(current.discussionIds) ? current.discussionIds : []),
      ...autoDiscussionIds,
      ...fallbackDiscussionIds,
    ], MAX_DISCUSSIONS),
    inspirationIds: take([
      ...(Array.isArray(current.inspirationIds) ? current.inspirationIds : []),
      ...autoInspirationIds,
    ], MAX_INSPIRATION),
    feedPostIds: take(Array.isArray(current.feedPostIds) ? current.feedPostIds : [], 6),
    updatedAt: new Date().toISOString(),
  };

  await showcaseRef.set(payload, { merge: true });

  console.log("Updated siteConfig/publicShowcase");
  console.log(`Educators: ${payload.educatorProfileIds.length}`);
  console.log(`Lessons: ${payload.lessonPlanIds.length}`);
  console.log(`Discussions: ${payload.discussionIds.length}`);
  console.log(`Inspiration: ${payload.inspirationIds.length}`);
  console.log(JSON.stringify(payload, null, 2));
}

run().catch((error) => {
  console.error("Failed to update siteConfig/publicShowcase");
  console.error(error);
  process.exit(1);
});
