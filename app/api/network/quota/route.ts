import type { NextRequest } from "next/server";
import { getConnectionQuota } from "@/lib/server/connections";
import { withAuthenticatedUser } from "@/lib/server/networkApi";

export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedUser(
    request,
    async (uid) => {
      const quota = await getConnectionQuota(uid);
      return { quota };
    },
    "api/network/quota",
  );
}
