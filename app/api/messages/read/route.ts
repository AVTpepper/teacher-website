import type { NextRequest } from "next/server";
import { markConversationRead } from "@/lib/server/messages";
import { withAuthenticatedMessageUser } from "@/lib/server/messagesApi";

interface ReadBody {
  conversationId?: unknown;
  lastReadMessageId?: unknown;
}

export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedMessageUser(
    request,
    async (uid) => {
      const body = (await request.json().catch(() => ({}))) as ReadBody;
      const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
      const lastReadMessageId =
        typeof body.lastReadMessageId === "string" ? body.lastReadMessageId : undefined;

      const result = await markConversationRead({ uid, conversationId, lastReadMessageId });
      return { ok: true, result };
    },
    "api/messages/read:post",
  );
}
