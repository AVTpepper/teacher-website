import type { NextRequest } from "next/server";
import { sendMessage } from "@/lib/server/messages";
import { withAuthenticatedMessageUser } from "@/lib/server/messagesApi";

interface SendMessageBody {
  conversationId?: unknown;
  body?: unknown;
  idempotencyKey?: unknown;
}

export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedMessageUser(
    request,
    async (uid) => {
      const body = (await request.json().catch(() => ({}))) as SendMessageBody;
      const conversationId = typeof body.conversationId === "string" ? body.conversationId : "";
      const messageBody = typeof body.body === "string" ? body.body : "";
      const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey : "";

      const result = await sendMessage({
        senderUid: uid,
        conversationId,
        body: messageBody,
        idempotencyKey,
      });

      return { ok: true, result };
    },
    "api/messages/send:post",
  );
}
