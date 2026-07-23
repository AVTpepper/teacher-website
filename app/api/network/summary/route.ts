import type { NextRequest } from "next/server";
import { getNetworkSummary } from "@/lib/server/connections";
import { withAuthenticatedUser } from "@/lib/server/networkApi";

export async function GET(request: NextRequest): Promise<Response> {
  return withAuthenticatedUser(
    request,
    async (uid) => {
      const summary = await getNetworkSummary(uid);
      return { summary };
    },
    "api/network/summary",
  );
}
