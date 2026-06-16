/**
 * One-time migration: adds `tier: "free"` to every user document
 * that does not already have a `tier` field.
 *
 * Run with:
 *   node scripts/set-default-tier.mjs
 *
 * Requires .env.local to have NEXT_PUBLIC_FIREBASE_PROJECT_ID and
 * NEXT_PUBLIC_FIREBASE_API_KEY set.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

// --- Load .env.local ---
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=").map((p) => p.trim()))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, v.join("=")])
);

const PROJECT_ID = env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"];
const API_KEY = env["NEXT_PUBLIC_FIREBASE_API_KEY"];

if (!PROJECT_ID || !API_KEY) {
  console.error("Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID or NEXT_PUBLIC_FIREBASE_API_KEY in .env.local");
  process.exit(1);
}

const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function listUsers(pageToken) {
  const url = `${BASE}/users?key=${API_KEY}&pageSize=100${pageToken ? `&pageToken=${pageToken}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`List users failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchTier(docName) {
  const url = `https://firestore.googleapis.com/v1/${docName}?updateMask.fieldPaths=tier&key=${API_KEY}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { tier: { stringValue: "free" } } }),
  });
  if (!res.ok) throw new Error(`Patch failed for ${docName}: ${res.status} ${await res.text()}`);
}

async function run() {
  let pageToken;
  let total = 0;
  let updated = 0;
  let skipped = 0;

  do {
    const data = await listUsers(pageToken);
    const docs = data.documents ?? [];
    pageToken = data.nextPageToken;

    for (const doc of docs) {
      total++;
      if (doc.fields?.tier) {
        skipped++;
        console.log(`  skip  ${doc.name.split("/").pop()} (already has tier: ${doc.fields.tier.stringValue})`);
      } else {
        await patchTier(doc.name);
        updated++;
        console.log(`  set   ${doc.name.split("/").pop()} → tier: free`);
      }
    }
  } while (pageToken);

  console.log(`\nDone. ${total} users total — ${updated} updated, ${skipped} skipped.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
