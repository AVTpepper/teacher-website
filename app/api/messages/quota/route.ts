import type { NextRequest } from "next/server";
import { getMessageQuota } from "@/lib/server/messages";
import { withAuthenticatedMessageUser } from "@/lib/server/messagesApi";

export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedMessageUser(
    request,
    async (uid) => {
      const quota = await getMessageQuota(uid);
      return { quota };
    },
    "api/messages/quota:get",
  );
}
