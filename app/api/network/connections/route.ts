import type { NextRequest } from "next/server";
import { listAcceptedConnections } from "@/lib/server/connections";
import { withAuthenticatedUser } from "@/lib/server/networkApi";

export async function GET(request: NextRequest): Promise<Response> {
  const limitParam = Number(request.nextUrl.searchParams.get("limit") ?? "30");
  const pageSize = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 30;

  return withAuthenticatedUser(
    request,
    async (uid) => {
      const items = await listAcceptedConnections(uid, pageSize);
      return { items };
    },
    "api/network/connections:get",
  );
}
