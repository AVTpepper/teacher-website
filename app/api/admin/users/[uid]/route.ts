import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdmin } from "@/lib/server/apiAuth";
import { adminAuth, adminDb } from "@/lib/server/firebaseAdmin";

type AdminUpdateBody = {
  displayName?: string;
  tier?: "free" | "plus";
  role?: "user" | "admin";
  disabled?: boolean;
  school?: string;
  bio?: string;
  country?: string;
  gradeLevel?: string;
  subjects?: string[];
};

function parseBody(value: unknown): AdminUpdateBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AdminUpdateBody;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> },
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { uid } = await context.params;

    const raw = await request.json();
    const body = parseBody(raw);
    if (!body) {
      return Response.json({ error: "Invalid request body." }, { status: 400 });
    }

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (typeof body.displayName === "string") {
      const displayName = body.displayName.trim();
      if (!displayName) {
        return Response.json({ error: "Display name cannot be empty." }, { status: 400 });
      }
      updates.displayName = displayName;
      updates.displayNameLower = displayName.toLowerCase();
      await adminAuth.updateUser(uid, { displayName });
    }

    if (body.tier === "free" || body.tier === "plus") {
      updates.tier = body.tier;
      updates.tierUpdatedAt = FieldValue.serverTimestamp();
    }

    if (body.role === "admin" || body.role === "user") {
      updates.role = body.role;
      updates.roleUpdatedAt = FieldValue.serverTimestamp();
      await adminAuth.setCustomUserClaims(uid, {
        role: body.role,
        admin: body.role === "admin",
      });
    }

    if (typeof body.disabled === "boolean") {
      await adminAuth.updateUser(uid, { disabled: body.disabled });
    }

    if (typeof body.school === "string") updates.school = body.school.trim();
    if (typeof body.bio === "string") updates.bio = body.bio.trim();
    if (typeof body.country === "string") updates.country = body.country.trim();
    if (typeof body.gradeLevel === "string") updates.gradeLevel = body.gradeLevel.trim();
    if (Array.isArray(body.subjects) && body.subjects.every((s) => typeof s === "string")) {
      updates.subjects = body.subjects;
    }

    await adminDb.collection("users").doc(uid).set(updates, { merge: true });

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return Response.json({ error: "Admin access required." }, { status: 403 });
    }

    return Response.json({ error: err instanceof Error ? err.message : "Update failed." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> },
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { uid } = await context.params;

    await adminAuth.deleteUser(uid);
    await adminDb.collection("users").doc(uid).delete();

    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return Response.json({ error: "Admin access required." }, { status: 403 });
    }

    return Response.json({ error: err instanceof Error ? err.message : "Delete failed." }, { status: 500 });
  }
}
