import type { NextRequest } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import type Stripe from "stripe";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { getFirebaseAdminDb } from "@/lib/server/firebaseAdmin";
import { captureServerError } from "@/lib/server/monitoring";
import { getStripeClient } from "@/lib/server/stripe";

export const runtime = "nodejs";

const BILLING_EVENT_COLLECTION = "billingWebhookEvents";

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

function toSubscriptionRecord(subscription: Stripe.Subscription): Record<string, unknown> {
  return subscription as unknown as Record<string, unknown>;
}

function parseEventCreatedAt(event: Stripe.Event): number {
  return typeof event.created === "number" ? event.created : 0;
}

async function claimWebhookEvent(event: Stripe.Event): Promise<boolean> {
  const db = getFirebaseAdminDb();
  const eventRef = db.collection(BILLING_EVENT_COLLECTION).doc(event.id);

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(eventRef);
    const status = typeof snap.data()?.status === "string" ? snap.data()?.status : null;

    if (status === "processed" || status === "processing") {
      return false;
    }

    transaction.set(
      eventRef,
      {
        eventId: event.id,
        eventType: event.type,
        created: parseEventCreatedAt(event),
        status: "processing",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    return true;
  });
}

async function markWebhookEventProcessed(event: Stripe.Event, status: "processed" | "failed"): Promise<void> {
  const db = getFirebaseAdminDb();
  await db.collection(BILLING_EVENT_COLLECTION).doc(event.id).set(
    {
      eventId: event.id,
      eventType: event.type,
      created: parseEventCreatedAt(event),
      status,
      processedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function currentUserEventCreatedAt(uid: string): Promise<number> {
  const snap = await getFirebaseAdminDb().doc(`users/${uid}`).get();
  const data = snap.data() as Record<string, unknown> | undefined;
  return typeof data?.stripeLastBillingEventCreatedAt === "number"
    ? data.stripeLastBillingEventCreatedAt
    : 0;
}

async function writeBillingSnapshot(input: {
  uid: string;
  eventId: string;
  eventCreated: number;
  customerId: string;
  subscriptionId: string;
  subscription: Stripe.Subscription;
}): Promise<void> {
  const { uid, eventId, eventCreated, subscription, customerId, subscriptionId } = input;
  const subscriptionRecord = toSubscriptionRecord(subscription);
  const userData = (await getFirebaseAdminDb().doc(`users/${uid}`).get()).data() as Record<string, unknown> | undefined;
  const existingEventCreated = typeof userData?.stripeLastBillingEventCreatedAt === "number"
    ? userData.stripeLastBillingEventCreatedAt
    : 0;

  if (eventCreated < existingEventCreated) {
    return;
  }

  const currentPeriodEnd =
    typeof subscriptionRecord.current_period_end === "number" ? subscriptionRecord.current_period_end : null;
  const cancelAt = typeof subscriptionRecord.cancel_at === "number" ? subscriptionRecord.cancel_at : null;
  const cancelAtPeriodEnd = Boolean(subscriptionRecord.cancel_at_period_end);
  const canceledAt = typeof subscriptionRecord.canceled_at === "number" ? subscriptionRecord.canceled_at : null;
  const status = typeof subscriptionRecord.status === "string" ? subscriptionRecord.status : "unknown";

  const profile = {
    ...(userData ?? {}),
    uid,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripeSubscriptionStatus: status,
    stripeCurrentPeriodEnd: currentPeriodEnd,
    stripeCancelAt: cancelAt,
    stripeCancelAtPeriodEnd: cancelAtPeriodEnd,
    stripeCanceledAt: canceledAt,
    billingStatus: status,
  } as Record<string, unknown>;

  const entitlements = getUserEntitlements({
    uid,
    displayName: typeof profile.displayName === "string" ? profile.displayName : "",
    email: typeof profile.email === "string" ? profile.email : "",
    photoURL: typeof profile.photoURL === "string" ? profile.photoURL : null,
    gradeLevel: typeof profile.gradeLevel === "string" ? profile.gradeLevel : "",
    subjects: Array.isArray(profile.subjects) ? (profile.subjects as string[]) : [],
    school: typeof profile.school === "string" ? profile.school : "",
    yearsOfExperience: typeof profile.yearsOfExperience === "number" ? profile.yearsOfExperience : 0,
    bio: typeof profile.bio === "string" ? profile.bio : "",
    isVerified: Boolean(profile.isVerified),
    createdAt: profile.createdAt ?? null,
    badges: Array.isArray(profile.badges) ? (profile.badges as string[]) : [],
    followerCount: typeof profile.followerCount === "number" ? profile.followerCount : 0,
    followingCount: typeof profile.followingCount === "number" ? profile.followingCount : 0,
    tier: profile.tier === "plus" ? "plus" : "free",
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripeSubscriptionStatus: status,
    stripeCurrentPeriodEnd: currentPeriodEnd,
    stripeCancelAt: cancelAt,
    stripeCancelAtPeriodEnd: cancelAtPeriodEnd,
    stripeCanceledAt: canceledAt,
    billingStatus: status,
  } as never);

  await getFirebaseAdminDb().doc(`users/${uid}`).set(
    {
      tier: entitlements.plusAccessActive ? "plus" : "free",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripeSubscriptionStatus: status,
      stripeCurrentPeriodEnd: currentPeriodEnd,
      stripeCancelAt: cancelAt,
      stripeCancelAtPeriodEnd: cancelAtPeriodEnd,
      stripeCanceledAt: canceledAt,
      stripeLastSyncedAt: FieldValue.serverTimestamp(),
      stripeLastBillingEventId: eventId,
      stripeLastBillingEventCreatedAt: eventCreated,
      billingStatus: status,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function syncSubscriptionFromStripe(input: {
  customerId: string;
  subscriptionId: string;
  event: Stripe.Event;
  fallbackSubscription?: Stripe.Subscription;
}): Promise<void> {
  const uid = await findUserByCustomerId(input.customerId);
  if (!uid) return;

  const eventCreated = parseEventCreatedAt(input.event);
  const existingEventCreated = await currentUserEventCreatedAt(uid);
  if (eventCreated < existingEventCreated) return;

  const stripe = getStripeClient();
  let subscription = input.fallbackSubscription ?? null;

  if (!subscription) {
    try {
      subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
    } catch {
      subscription = null;
    }
  }

  if (!subscription) {
    return;
  }

  await writeBillingSnapshot({
    uid,
    eventId: input.event.id,
    eventCreated,
    customerId: input.customerId,
    subscriptionId: input.subscriptionId,
    subscription,
  });
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

  const claimed = await claimWebhookEvent(event);
  if (!claimed) {
    return Response.json({ received: true });
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
          await syncSubscriptionFromStripe({
            customerId: session.customer,
            subscriptionId: session.subscription,
            event,
          });
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
          await syncSubscriptionFromStripe({
            customerId,
            subscriptionId: subscription.id,
            event,
            fallbackSubscription: subscription,
          });
        }
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        const invoiceRecord = invoice as unknown as Record<string, unknown>;
        const subscriptionId =
          typeof invoiceRecord.subscription === "string" ? invoiceRecord.subscription : null;
        if (customerId && subscriptionId) {
          await syncSubscriptionFromStripe({
            customerId,
            subscriptionId,
            event,
          });
        }
        break;
      }
      case "checkout.session.expired": {
        break;
      }
      default:
        break;
    }

    await markWebhookEventProcessed(event, "processed");
    return Response.json({ received: true });
  } catch (error) {
    await markWebhookEventProcessed(event, "failed").catch(() => {});
    await captureServerError(error, {
      source: "api/billing/webhook/handler",
      context: { eventType: event.type, eventId: event.id },
    });
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
