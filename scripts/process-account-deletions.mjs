/**
 * Triggers queued account-deletion processing via the internal API.
 *
 * Usage:
 *   node scripts/process-account-deletions.mjs
 *
 * Required env vars:
 *   NEXT_PUBLIC_APP_URL (e.g. http://localhost:3000)
 *   ACCOUNT_DELETION_JOB_SECRET
 */

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const secret = process.env.ACCOUNT_DELETION_JOB_SECRET;

if (!secret) {
  console.error("Missing ACCOUNT_DELETION_JOB_SECRET.");
  process.exit(1);
}

async function run() {
  const response = await fetch(`${baseUrl}/api/internal/account-deletion/process?batch=1`, {
    method: "POST",
    headers: {
      "x-job-secret": secret,
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("Failed to process account deletions:", payload);
    process.exit(1);
  }

  console.log("Account deletion processing result:", payload);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
