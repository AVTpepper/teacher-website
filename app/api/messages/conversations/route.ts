import type { NextRequest } from "next/server";
import { getOrCreateConversation, listConversations } from "@/lib/server/messages";
import { withAuthenticatedMessageUser } from "@/lib/server/messagesApi";

interface CreateConversationBody {
  targetUid?: unknown;
}

export async function GET(request: NextRequest): Promise<Response> {
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const pageSize = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  return withAuthenticatedMessageUser(
    request,
    async (uid) => {
      const items = await listConversations(uid, pageSize);
      return { items };
    },
    "api/messages/conversations:get",
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedMessageUser(
    request,
    async (uid) => {
      const body = (await request.json().catch(() => ({}))) as CreateConversationBody;
      const targetUid = typeof body.targetUid === "string" ? body.targetUid : "";
      const conversation = await getOrCreateConversation({ currentUid: uid, targetUid });
      return { ok: true, conversation };
    },
    "api/messages/conversations:post",
  );
}
