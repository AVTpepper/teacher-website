import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/server/apiAuth";
import { adminAuth } from "@/lib/server/firebaseAdmin";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> },
): Promise<Response> {
  try {
    await requireAdmin(request);
    const { uid } = await context.params;

    const user = await adminAuth.getUser(uid);
    if (!user.email) {
      return Response.json({ error: "User does not have an email address." }, { status: 400 });
    }

    const resetLink = await adminAuth.generatePasswordResetLink(user.email);
    return Response.json({ resetLink });
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHENTICATED") {
      return Response.json({ error: "Authentication required." }, { status: 401 });
    }
    if (err instanceof Error && err.message === "FORBIDDEN") {
      return Response.json({ error: "Admin access required." }, { status: 403 });
    }

    return Response.json({ error: err instanceof Error ? err.message : "Failed to generate reset link." }, { status: 500 });
  }
}
