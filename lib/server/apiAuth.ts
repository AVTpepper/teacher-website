import type { NextRequest } from "next/server";
import { getFirebaseAdminAuth } from "@/lib/server/firebaseAdmin";

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
