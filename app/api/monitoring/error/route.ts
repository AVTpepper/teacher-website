import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";
import { captureServerError } from "@/lib/server/monitoring";

interface ClientErrorBody {
  message?: unknown;
  stack?: unknown;
  source?: unknown;
  url?: unknown;
  userAgent?: unknown;
}

function toBoundedString(value: unknown, max = 1000): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

async function getOptionalUid(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return null;

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json()) as ClientErrorBody;
    const message = toBoundedString(body.message, 1000);
    if (!message) {
      return Response.json({ error: "Missing message." }, { status: 400 });
    }

    const uid = await getOptionalUid(request);
    const db = getFirebaseAdminDb();

    await db.collection("errorEvents").add({
      source: toBoundedString(body.source, 100) ?? "client",
      message,
      stack: toBoundedString(body.stack, 5000),
      url: toBoundedString(body.url, 1000),
      userAgent: toBoundedString(body.userAgent, 500),
      uid,
      severity: "error",
      createdAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ ok: true });
  } catch (error) {
    await captureServerError(error, {
      source: "api/monitoring/error",
      context: { method: "POST" },
    });
    return Response.json({ error: "Failed to capture error." }, { status: 500 });
  }
}
