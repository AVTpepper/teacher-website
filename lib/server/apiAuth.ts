import type { NextRequest } from "next/server";
import { getFirebaseAdminAuth, getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";

export interface AuthenticatedRequestContext {
  uid: string;
  token: string;
}

export class ApiAuthError extends Error {}

export async function requireAuthenticatedUser(
  request: NextRequest,
): Promise<AuthenticatedRequestContext> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    throw new ApiAuthError("Authentication required.");
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, token };
  } catch {
    throw new ApiAuthError("Invalid or expired session.");
  }
}

export async function requireAdmin(
  request: NextRequest,
): Promise<AuthenticatedRequestContext> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!token) {
    throw new Error("UNAUTHENTICATED");
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(token);
    const uid = decoded.uid;

    if (decoded.admin === true || decoded.role === "admin") {
      return { uid, token };
    }

    const userSnap = await getFirebaseAdminDb().doc(`users/${uid}`).get();
    const userData = userSnap.data() as Record<string, unknown> | undefined;
    const role = userData?.role;

    if (role === "admin") {
      return { uid, token };
    }

    throw new Error("FORBIDDEN");
  } catch (error) {
    if (error instanceof Error && (error.message === "FORBIDDEN" || error.message === "UNAUTHENTICATED")) {
      throw error;
    }
    throw new Error("UNAUTHENTICATED");
  }
}
