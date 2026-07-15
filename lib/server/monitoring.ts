import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminDb, isFirebaseAdminConfigured } from "@/lib/server/firebaseAdmin";

interface CaptureErrorOptions {
  source: string;
  uid?: string | null;
  severity?: "error" | "warning";
  context?: Record<string, unknown>;
}

export async function captureServerError(
  error: unknown,
  options: CaptureErrorOptions,
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack ?? null : null;

  console.error(
    "[monitoring]",
    JSON.stringify({
      source: options.source,
      severity: options.severity ?? "error",
      uid: options.uid ?? null,
      message,
      context: options.context ?? {},
    }),
  );

  if (!isFirebaseAdminConfigured()) return;

  try {
    const db = getFirebaseAdminDb();
    await db.collection("errorEvents").add({
      source: options.source,
      severity: options.severity ?? "error",
      uid: options.uid ?? null,
      message,
      stack,
      context: options.context ?? {},
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Last-resort logging already happened above.
  }
}
