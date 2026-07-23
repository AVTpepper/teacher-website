import type { NextRequest } from "next/server";
import { listMessages } from "@/lib/server/messages";
import { withAuthenticatedMessageUser } from "@/lib/server/messagesApi";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
): Promise<Response> {
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "30");
  const pageSize = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 30;
  const beforeCreatedAt = request.nextUrl.searchParams.get("beforeCreatedAt") ?? undefined;

  return withAuthenticatedMessageUser(
    request,
    async (uid) => {
      const { conversationId } = await context.params;
      const page = await listMessages(uid, conversationId, {
        limit: pageSize,
        beforeCreatedAt,
      });
      return { page };
    },
    "api/messages/conversations/[conversationId]/messages:get",
  );
}
