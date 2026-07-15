import type { NextRequest } from "next/server";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/apiAuth";
import { getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";
import { captureServerError } from "@/lib/server/monitoring";
import { getStripeClient } from "@/lib/server/stripe";

function getAppOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { uid } = await requireAuthenticatedUser(request);
    const db = getFirebaseAdminDb();
    const userSnap = await db.doc(`users/${uid}`).get();

    if (!userSnap.exists) {
      return Response.json({ error: "User profile not found." }, { status: 404 });
    }

    const userData = userSnap.data() as Record<string, unknown>;
    const stripeCustomerId =
      typeof userData.stripeCustomerId === "string" ? userData.stripeCustomerId : null;

    if (!stripeCustomerId) {
      return Response.json(
        { error: "No billing customer is associated with this account yet." },
        { status: 400 },
      );
    }

    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${getAppOrigin(request)}/account`,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    await captureServerError(error, {
      source: "api/billing/portal",
      context: { method: "POST" },
    });
    return Response.json({ error: "Unable to open billing portal." }, { status: 500 });
  }
}
