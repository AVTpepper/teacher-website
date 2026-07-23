import type { NextRequest } from "next/server";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/apiAuth";
import { captureServerError } from "@/lib/server/monitoring";
import { MessageServiceError } from "@/lib/server/messages";

export async function withAuthenticatedMessageUser<T>(
  request: NextRequest,
  handler: (uid: string) => Promise<T>,
  source: string,
): Promise<Response> {
  try {
    const { uid } = await requireAuthenticatedUser(request);
    const payload = await handler(uid);
    return Response.json(payload);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    if (error instanceof MessageServiceError) {
      return Response.json({ error: error.message, code: error.code }, { status: error.status });
    }

    await captureServerError(error, { source });
    return Response.json({ error: "Temporary server error." }, { status: 500 });
  }
}
