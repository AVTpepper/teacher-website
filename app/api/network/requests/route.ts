import type { NextRequest } from "next/server";
import {
  listIncomingRequests,
  listSentRequests,
  sendConnectionRequest,
} from "@/lib/server/connections";
import { withAuthenticatedUser } from "@/lib/server/networkApi";
import { normalizeConnectionReason } from "@/lib/network/utils";

interface SendRequestBody {
  recipientId?: unknown;
  reason?: unknown;
  introMessage?: unknown;
}

export async function GET(request: NextRequest): Promise<Response> {
  const tab = request.nextUrl.searchParams.get("kind") ?? "incoming";
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const pageSize = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  return withAuthenticatedUser(
    request,
    async (uid) => {
      if (tab === "sent") {
        const sent = await listSentRequests(uid, pageSize);
        return { items: sent };
      }
      const incoming = await listIncomingRequests(uid, pageSize);
      return { items: incoming };
    },
    "api/network/requests:get",
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  return withAuthenticatedUser(
    request,
    async (uid) => {
      const body = (await request.json().catch(() => ({}))) as SendRequestBody;
      const recipientId = typeof body.recipientId === "string" ? body.recipientId : "";
      const reason = normalizeConnectionReason(body.reason);
      const introMessage = typeof body.introMessage === "string" ? body.introMessage : undefined;

      const result = await sendConnectionRequest({
        requesterId: uid,
        recipientId,
        reason,
        introMessage,
      });

      return { ok: true, result };
    },
    "api/network/requests:post",
  );
}
