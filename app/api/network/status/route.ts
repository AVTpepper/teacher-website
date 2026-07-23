import type { NextRequest } from "next/server";
import { getConnectionStatuses } from "@/lib/server/connections";
import { withAuthenticatedUser } from "@/lib/server/networkApi";

export async function GET(request: NextRequest): Promise<Response> {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .slice(0, 100);

  return withAuthenticatedUser(
    request,
    async (uid) => {
      const statuses = await getConnectionStatuses(uid, ids);
      return { statuses };
    },
    "api/network/status",
  );
}
