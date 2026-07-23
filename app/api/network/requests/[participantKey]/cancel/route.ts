import type { NextRequest } from "next/server";
import { cancelConnectionRequest } from "@/lib/server/connections";
import { withAuthenticatedUser } from "@/lib/server/networkApi";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantKey: string }> },
): Promise<Response> {
  return withAuthenticatedUser(
    request,
    async (uid) => {
      const { participantKey } = await context.params;
      const result = await cancelConnectionRequest(participantKey, uid);
      return { ok: true, result };
    },
    "api/network/requests/cancel",
  );
}
