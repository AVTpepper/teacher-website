import type { NextRequest } from "next/server";
import { getConversation } from "../../../../../lib/server/messages";
import { withAuthenticatedMessageUser } from "../../../../../lib/server/messagesApi";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  return withAuthenticatedMessageUser(
    request,
    async (uid) => {
      const { conversationId } = await context.params;
      const conversation = await getConversation(uid, conversationId);
      return { conversation };
    },
    "api/messages/conversations/[conversationId]:get",
  );
}
