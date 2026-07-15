import type { NextRequest } from "next/server";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/apiAuth";
import { queueAccountDeletion } from "@/lib/server/accountDeletion";
import { captureServerError } from "@/lib/server/monitoring";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { uid } = await requireAuthenticatedUser(request);
    await queueAccountDeletion(uid);

    return Response.json({
      ok: true,
      message: "Account deletion requested. Your account will be removed shortly.",
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    await captureServerError(error, {
      source: "api/account/delete",
      context: { method: "POST" },
    });
    return Response.json(
      { error: "Unable to queue account deletion right now." },
      { status: 500 },
    );
  }
}
