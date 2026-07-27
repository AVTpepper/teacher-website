import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

function loadEnvFile() {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = resolve(__dirname, "../.env.local");
  const text = readFileSync(envPath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;

    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function initAdmin() {
  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin environment variables in .env.local");
  }

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }
}

async function run() {
  const name = process.argv[2]?.trim();
  if (!name) {
    throw new Error("Usage: node scripts/feature-educator.mjs \"Display Name\"");
  }

  loadEnvFile();
  initAdmin();

  const db = getFirestore();
  const userSnap = await db
    .collection("users")
    .where("displayName", "==", name)
    .limit(1)
    .get();

  if (userSnap.empty) {
    throw new Error(`No user found with displayName: ${name}`);
  }

  const userDoc = userSnap.docs[0];
  const uid = userDoc.id;

  const showcaseRef = db.collection("siteConfig").doc("publicShowcase");
  const showcaseSnap = await showcaseRef.get();
  const data = showcaseSnap.exists ? showcaseSnap.data() : {};
  const currentIds = Array.isArray(data?.educatorProfileIds)
    ? data.educatorProfileIds.filter((v) => typeof v === "string" && v.trim())
    : [];

  if (!currentIds.includes(uid)) {
    currentIds.push(uid);
  }

  await showcaseRef.set(
    {
      educatorProfileIds: currentIds,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  console.log(JSON.stringify({ name, uid, featured: true, featuredCount: currentIds.length }, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
