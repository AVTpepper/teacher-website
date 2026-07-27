import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/apiAuth";
import { getUserBillingEntitlements } from "@/lib/server/billing";
import { getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";
import { captureServerError } from "@/lib/server/monitoring";
import { getStripeClient } from "@/lib/server/stripe";

interface CheckoutBody {
  priceId?: string;
  uiMode?: "hosted" | "embedded";
  flow?: "account" | "pricing";
}

function getAppOrigin(request: NextRequest): string {
  const origin = request.headers.get("origin");
  if (origin) return origin;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  return "http://localhost:3000";
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { uid } = await requireAuthenticatedUser(request);
    const body = (await request.json().catch(() => ({}))) as CheckoutBody;
    const uiMode = body.uiMode === "embedded" ? "embedded" : "hosted";
    const flow = body.flow === "pricing" ? "pricing" : "account";

    const configuredPriceId = process.env.STRIPE_PLUS_PRICE_ID;
    const priceId = configuredPriceId ?? null;
    if (!priceId) {
      return Response.json(
        { error: "Billing is not configured yet. Missing STRIPE_PLUS_PRICE_ID." },
        { status: 503 },
      );
    }

    if (body.priceId && body.priceId !== priceId) {
      return Response.json({ error: "Invalid billing price." }, { status: 400 });
    }

    const entitlements = await getUserBillingEntitlements(uid);
    if (entitlements.plusAccessActive) {
      return Response.json(
        { error: "You already have an active Plus subscription." },
        { status: 409 },
      );
    }

    const stripe = getStripeClient();
    const db = getFirebaseAdminDb();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return Response.json({ error: "User profile not found." }, { status: 404 });
    }

    const userData = userSnap.data() as Record<string, unknown>;
    const email = typeof userData.email === "string" ? userData.email : null;
    const displayName = typeof userData.displayName === "string" ? userData.displayName : null;

    let stripeCustomerId =
      typeof userData.stripeCustomerId === "string" ? userData.stripeCustomerId : null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        name: displayName ?? undefined,
        metadata: { firebaseUid: uid },
      });
      stripeCustomerId = customer.id;

      await userRef.set(
        {
          stripeCustomerId,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const origin = getAppOrigin(request);
    const successUrl =
      flow === "pricing"
        ? `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/account?billing=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = flow === "pricing" ? `${origin}/pricing?billing=cancelled` : `${origin}/account?billing=cancelled`;

    const baseParams: Pick<
      Stripe.Checkout.SessionCreateParams,
      "mode" | "customer" | "line_items" | "allow_promotion_codes" | "metadata" | "subscription_data"
    > = {
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      metadata: { firebaseUid: uid },
      subscription_data: {
        metadata: {
          firebaseUid: uid,
        },
      },
    };

    const sessionParams: Stripe.Checkout.SessionCreateParams =
      uiMode === "embedded"
        ? {
            ...baseParams,
            ui_mode: "embedded_page" as unknown as Stripe.Checkout.SessionCreateParams.UiMode,
            return_url: successUrl,
          }
        : {
            ...baseParams,
            success_url: successUrl,
            cancel_url: cancelUrl,
          };

    const session = await stripe.checkout.sessions.create(sessionParams);

    if (uiMode === "embedded") {
      if (!session.client_secret) {
        return Response.json({ error: "Failed to create embedded checkout session." }, { status: 502 });
      }

      return Response.json({ clientSecret: session.client_secret });
    }

    if (!session.url) {
      return Response.json({ error: "Failed to create checkout session." }, { status: 502 });
    }

    return Response.json({ url: session.url });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    await captureServerError(error, {
      source: "api/billing/checkout",
      context: { method: "POST" },
    });
    return Response.json({ error: "Unable to start checkout session." }, { status: 500 });
  }
}
