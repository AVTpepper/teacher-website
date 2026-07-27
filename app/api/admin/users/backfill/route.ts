import type { UserRecord } from "firebase-admin/auth";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/apiAuth";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

type BackfillBody = {
  uid?: string;
  limit?: number;
};

type BackfillResult = {
  uid: string;
  action: "created" | "updated" | "unchanged";
};

type BackfillResponse = {
  scanned: number;
  created: number;
  updated: number;
  unchanged: number;
  results: BackfillResult[];
};

function parseBody(value: unknown): BackfillBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const data = value as Record<string, unknown>;
  return {
    uid: typeof data.uid === "string" ? data.uid.trim() : undefined,
    limit: typeof data.limit === "number" && Number.isFinite(data.limit) ? data.limit : undefined,
  };
}

function isMissing(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function defaultUserFields(record: UserRecord): Record<string, unknown> {
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

function buildMissingPatch(existing: Record<string, unknown>, defaults: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(defaults)) {
    if (key === "uid") continue;
    if (isMissing(existing[key])) {
      patch[key] = value;
    }
  }

  const displayName = typeof patch.displayName === "string"
    ? patch.displayName
    : typeof existing.displayName === "string"
      ? existing.displayName
      : null;

  if (typeof displayName === "string" && isMissing(existing.displayNameLower)) {
    patch.displayNameLower = displayName.toLowerCase();
  }

  return patch;
}

async function upsertProfileFromAuthRecord(record: UserRecord): Promise<BackfillResult> {
  const userRef = adminDb.collection("users").doc(record.uid);
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

  const existing = userSnap.data() as Record<string, unknown>;
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

async function backfillSingleUser(uid: string): Promise<BackfillResponse> {
  const record = await adminAuth.getUser(uid);
  const result = await upsertProfileFromAuthRecord(record);

  return {
    scanned: 1,
    created: result.action === "created" ? 1 : 0,
    updated: result.action === "updated" ? 1 : 0,
    unchanged: result.action === "unchanged" ? 1 : 0,
    results: [result],
  };
}

async function backfillManyUsers(limit: number): Promise<BackfillResponse> {
  let scanned = 0;
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  const results: BackfillResult[] = [];

  let pageToken: string | undefined;
  while (scanned < limit) {
    const pageSize = Math.min(100, limit - scanned);
    const page = await adminAuth.listUsers(pageSize, pageToken);
    if (page.users.length === 0) break;

    for (const record of page.users) {
      const result = await upsertProfileFromAuthRecord(record);
      results.push(result);
      scanned += 1;

      if (result.action === "created") created += 1;
      if (result.action === "updated") updated += 1;
      if (result.action === "unchanged") unchanged += 1;

      if (scanned >= limit) break;
    }

    pageToken = page.pageToken;
    if (!pageToken) break;
  }

  return { scanned, created, updated, unchanged, results };
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    await requireAdmin(request);
    const body = parseBody(await request.json().catch(() => ({})));

    if (body.uid) {
      const response = await backfillSingleUser(body.uid);
      return Response.json(response);
    }

    const limit = Math.max(1, Math.min(body.limit ?? 200, 1000));
    const response = await backfillManyUsers(limit);
    return Response.json(response);
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return Response.json({ error: "Admin access required." }, { status: 403 });
    }
    return Response.json({ error: err instanceof Error ? err.message : "Backfill failed." }, { status: 500 });
  }
}