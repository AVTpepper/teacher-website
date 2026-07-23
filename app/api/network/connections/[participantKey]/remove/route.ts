import type { NextRequest } from "next/server";
import { removeConnection } from "@/lib/server/connections";
import { withAuthenticatedUser } from "@/lib/server/networkApi";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ participantKey: string }> },
): Promise<Response> {
  return withAuthenticatedUser(
    request,
    async (uid) => {
      const { participantKey } = await context.params;
      const result = await removeConnection(participantKey, uid);
      return { ok: true, result };
    },
    "api/network/connections/remove",
  );
}
