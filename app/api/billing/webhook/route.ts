import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";
import { captureServerError } from "@/lib/server/monitoring";
import { getStripeClient } from "@/lib/server/stripe";

export const runtime = "nodejs";

function isPlusStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return status === "active" || status === "trialing" || status === "past_due";
}

async function findUserByCustomerId(customerId: string): Promise<string | null> {
  const db = getFirebaseAdminDb();
  const snap = await db
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();

  if (snap.empty) return null;
  return snap.docs[0]!.id;
}

async function syncTierFromSubscription(
  customerId: string,
  subscriptionId: string,
  status: string,
  subscription: Stripe.Subscription,
): Promise<void> {
  const uid = await findUserByCustomerId(customerId);
  if (!uid) return;

  const subscriptionRecord = subscription as unknown as Record<string, unknown>;
  const currentPeriodEnd =
    typeof subscriptionRecord.current_period_end === "number"
      ? subscriptionRecord.current_period_end
      : null;
  const cancelAt =
    typeof subscriptionRecord.cancel_at === "number" ? subscriptionRecord.cancel_at : null;
  const cancelAtPeriodEnd = Boolean(subscriptionRecord.cancel_at_period_end);
  const canceledAt =
    typeof subscriptionRecord.canceled_at === "number" ? subscriptionRecord.canceled_at : null;

  const db = getFirebaseAdminDb();
  await db.doc(`users/${uid}`).set(
    {
      tier: isPlusStatus(status) ? "plus" : "free",
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionStatus: status,
      stripeCurrentPeriodEnd: currentPeriodEnd,
      stripeCancelAt: cancelAt,
      stripeCancelAtPeriodEnd: cancelAtPeriodEnd,
      stripeCanceledAt: canceledAt,
      stripeLastSyncedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function attachCustomerToUser(checkoutSession: Stripe.Checkout.Session): Promise<void> {
  const uid = checkoutSession.metadata?.firebaseUid;
  const customerId =
    typeof checkoutSession.customer === "string" ? checkoutSession.customer : null;

  if (!uid || !customerId) return;

  const db = getFirebaseAdminDb();
  await db.doc(`users/${uid}`).set(
    {
      stripeCustomerId: customerId,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export async function POST(request: NextRequest): Promise<Response> {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return Response.json(
      { error: "Missing STRIPE_WEBHOOK_SECRET environment variable." },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature header." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    await captureServerError(error, {
      source: "api/billing/webhook/construct",
      context: { signaturePresent: Boolean(signature) },
    });
    return Response.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await attachCustomerToUser(session);

        if (
          session.customer &&
          typeof session.customer === "string" &&
          session.subscription &&
          typeof session.subscription === "string"
        ) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await syncTierFromSubscription(session.customer, subscription.id, subscription.status, subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === "string" ? subscription.customer : null;
        if (customerId) {
          await syncTierFromSubscription(customerId, subscription.id, subscription.status, subscription);
        }
        break;
      }
      default:
        break;
    }

    return Response.json({ received: true });
  } catch (error) {
    await captureServerError(error, {
      source: "api/billing/webhook/handler",
      context: { eventType: event.type, eventId: event.id },
    });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
