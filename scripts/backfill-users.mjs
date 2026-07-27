/**
 * Backfill Firestore `users` docs from Firebase Auth records.
 *
 * Usage:
 *   node scripts/backfill-users.mjs
 *   node scripts/backfill-users.mjs --limit 500
 *   node scripts/backfill-users.mjs --uid <firebase-auth-uid>
 *
 * Reads Firebase Admin credentials from `.env.local`:
 *   FIREBASE_ADMIN_PROJECT_ID (optional if NEXT_PUBLIC_FIREBASE_PROJECT_ID exists)
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

function parseArgs(argv) {
  const args = { limit: undefined, uid: undefined };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--limit" && argv[i + 1]) {
      const parsed = Number.parseInt(argv[i + 1], 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.limit = parsed;
      }
      i += 1;
    } else if (token === "--uid" && argv[i + 1]) {
      args.uid = argv[i + 1].trim();
      i += 1;
    }
  }

  return args;
}

function loadEnvLocal() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dirname, "../.env.local");
  const rows = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  const env = {};
  for (const row of rows) {
    const firstEq = row.indexOf("=");
    if (firstEq <= 0) continue;
    const key = row.slice(0, firstEq).trim();
    const rawVal = row.slice(firstEq + 1).trim();
    env[key] = rawVal;
  }

  return env;
}

function stripQuotes(value) {
  if (!value) return value;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function initAdminFromEnv() {
  const env = loadEnvLocal();
  const projectId = stripQuotes(env.FIREBASE_ADMIN_PROJECT_ID) || stripQuotes(env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
  const clientEmail = stripQuotes(env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const privateKey = stripQuotes(env.FIREBASE_ADMIN_PRIVATE_KEY)?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin env vars in .env.local");
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      projectId,
    });
  }

  return {
    projectId,
    auth: getAuth(),
    db: getFirestore(),
  };
}

function isMissing(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function defaultUserFields(record) {
  const displayName = record.displayName?.trim() || record.email?.split("@")[0] || "Educator";
  const email = record.email ?? "";

  return {
    uid: record.uid,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    email,
    photoURL: record.photoURL ?? null,
    gradeLevel: "",
    gradeLevels: [],
    subjects: [],
    professionalRole: "",
    additionalRoles: [],
    professionalHeadline: "",
    curricula: [],
    country: "",
    city: "",
    languages: [],
    school: "",
    schoolType: "",
    yearsOfExperience: 0,
    bio: "",
    professionalInterests: [],
    networkingGoals: [],
    lookingFor: "",
    onboardingCompleted: false,
    onboardingVersion: 0,
    onboardingCurrentStep: 1,
    profileCompletion: 0,
    profileCardTheme: "classic",
    isVerified: false,
    role: "user",
    tier: "free",
    badges: [],
    followerCount: 0,
    followingCount: 0,
  };
}

function buildMissingPatch(existing, defaults) {
  const patch = {};

  for (const [key, value] of Object.entries(defaults)) {
    if (key === "uid") continue;
    if (isMissing(existing[key])) {
      patch[key] = value;
    }
  }

  const displayName =
    typeof patch.displayName === "string"
      ? patch.displayName
      : typeof existing.displayName === "string"
        ? existing.displayName
        : null;

  if (typeof displayName === "string" && isMissing(existing.displayNameLower)) {
    patch.displayNameLower = displayName.toLowerCase();
  }

  return patch;
}

async function upsertProfileFromAuthRecord(record, db) {
  const userRef = db.collection("users").doc(record.uid);
  const userSnap = await userRef.get();
  const defaults = defaultUserFields(record);

  if (!userSnap.exists) {
    await userRef.set({
      ...defaults,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return { uid: record.uid, action: "created" };
  }

  const existing = userSnap.data() ?? {};
  const patch = buildMissingPatch(existing, defaults);

  if (!existing.createdAt) {
    const createdAtFromAuth = record.metadata.creationTime
      ? Timestamp.fromDate(new Date(record.metadata.creationTime))
      : FieldValue.serverTimestamp();
    patch.createdAt = createdAtFromAuth;
  }

  if (Object.keys(patch).length === 0) {
    return { uid: record.uid, action: "unchanged" };
  }

  patch.updatedAt = FieldValue.serverTimestamp();
  await userRef.set(patch, { merge: true });

  return { uid: record.uid, action: "updated" };
}

async function backfillSingleUser(uid, auth, db) {
  const record = await auth.getUser(uid);
  const result = await upsertProfileFromAuthRecord(record, db);

  return {
    scanned: 1,
    created: result.action === "created" ? 1 : 0,
    updated: result.action === "updated" ? 1 : 0,
    unchanged: result.action === "unchanged" ? 1 : 0,
  };
}

async function backfillManyUsers(limit, auth, db) {
  let scanned = 0;
  let created = 0;
  let updated = 0;
  let unchanged = 0;

  let pageToken;
  while (scanned < limit) {
    const pageSize = Math.min(100, limit - scanned);
    const page = await auth.listUsers(pageSize, pageToken);

    if (page.users.length === 0) break;

    for (const record of page.users) {
      const result = await upsertProfileFromAuthRecord(record, db);
      scanned += 1;

      if (result.action === "created") created += 1;
      if (result.action === "updated") updated += 1;
      if (result.action === "unchanged") unchanged += 1;

      if (scanned >= limit) break;
    }

    pageToken = page.pageToken;
    if (!pageToken) break;
  }

  return { scanned, created, updated, unchanged };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { projectId, auth, db } = initAdminFromEnv();

  console.log(`Backfill target project: ${projectId}`);

  let summary;
  if (args.uid) {
    summary = await backfillSingleUser(args.uid, auth, db);
  } else {
    const limit = args.limit ?? Number.MAX_SAFE_INTEGER;
    summary = await backfillManyUsers(limit, auth, db);
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        ...summary,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Backfill failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
