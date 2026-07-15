import type { NextRequest } from "next/server";
import { processQueuedAccountDeletions } from "@/lib/server/accountDeletion";
import { captureServerError } from "@/lib/server/monitoring";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ACCOUNT_DELETION_JOB_SECRET;
  if (!secret) return false;
  const incoming = request.headers.get("x-job-secret");
  return incoming === secret;
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const batchParam = Number(request.nextUrl.searchParams.get("batch") ?? "1");
  const batchSize = Number.isFinite(batchParam) ? batchParam : 1;

  try {
    const result = await processQueuedAccountDeletions(batchSize);
    return Response.json(result);
  } catch (error) {
    await captureServerError(error, {
      source: "api/internal/account-deletion/process",
      context: { batchSize },
    });
    return Response.json({ error: "Deletion processing failed." }, { status: 500 });
  }
}
