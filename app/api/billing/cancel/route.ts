import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/apiAuth";
import { getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";
import { captureServerError } from "@/lib/server/monitoring";
import { getStripeClient } from "@/lib/server/stripe";

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { uid } = await requireAuthenticatedUser(request);
    const db = getFirebaseAdminDb();
    const userRef = db.doc(`users/${uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return Response.json({ error: "User profile not found." }, { status: 404 });
    }

    const userData = userSnap.data() as Record<string, unknown>;
    const stripe = getStripeClient();

    let subscriptionId =
      typeof userData.stripeSubscriptionId === "string" ? userData.stripeSubscriptionId : null;

    if (!subscriptionId) {
      const stripeCustomerId =
        typeof userData.stripeCustomerId === "string" ? userData.stripeCustomerId : null;

      if (!stripeCustomerId) {
        return Response.json({ error: "No active billing subscription found." }, { status: 400 });
      }

      const subscriptions = await stripe.subscriptions.list({
        customer: stripeCustomerId,
        status: "all",
        limit: 10,
      });

      const activeSubscription = subscriptions.data.find((subscription) => {
        return ["trialing", "active", "past_due", "unpaid"].includes(subscription.status);
      });

      subscriptionId = activeSubscription?.id ?? null;
    }

    if (!subscriptionId) {
      return Response.json({ error: "No active billing subscription found." }, { status: 400 });
    }

    const canceled = await stripe.subscriptions.cancel(subscriptionId);
    const canceledRecord = canceled as unknown as Record<string, unknown>;

    const currentPeriodEnd =
      typeof canceledRecord.current_period_end === "number"
        ? canceledRecord.current_period_end
        : null;
    const cancelAt =
      typeof canceledRecord.cancel_at === "number" ? canceledRecord.cancel_at : null;
    const cancelAtPeriodEnd = Boolean(canceledRecord.cancel_at_period_end);
    const canceledAt =
      typeof canceledRecord.canceled_at === "number" ? canceledRecord.canceled_at : null;
    const canceledId = typeof canceledRecord.id === "string" ? canceledRecord.id : subscriptionId;
    const canceledStatus =
      typeof canceledRecord.status === "string" ? canceledRecord.status : "canceled";

    await userRef.set(
      {
        tier: "free",
        stripeSubscriptionId: canceledId,
        stripeSubscriptionStatus: canceledStatus,
        stripeCurrentPeriodEnd: currentPeriodEnd,
        stripeCancelAt: cancelAt,
        stripeCancelAtPeriodEnd: cancelAtPeriodEnd,
        stripeCanceledAt: canceledAt,
        stripeLastSyncedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return Response.json({ ok: true, status: canceledStatus });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return Response.json({ error: error.message }, { status: 401 });
    }

    await captureServerError(error, {
      source: "api/billing/cancel",
      context: { method: "POST" },
    });
    return Response.json({ error: "Unable to cancel subscription right now." }, { status: 500 });
  }
}