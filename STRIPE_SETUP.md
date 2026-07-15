# Stripe + Billing Setup Guide

This project now supports:

- Embedded Stripe Checkout for upgrading to Plus inside the site
- Stripe Billing Portal for managing subscription
- Stripe webhook-driven tier sync in Firestore (`tier: free|plus`)

---

## 1) Install and configure Stripe products

1. In Stripe Dashboard, create a **Product** for Plus.
2. Create a recurring **Price** for that product.
3. Copy the price ID (looks like `price_...`) for `STRIPE_PLUS_PRICE_ID`.

---

## 2) Add environment variables

Add these to `.env.local` for local development:

```env
# App URL used for Stripe redirects
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe keys
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PLUS_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Firebase Admin credentials (server-only)
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Internal job auth for background deletions
ACCOUNT_DELETION_JOB_SECRET=choose-a-strong-random-secret
```

Notes:
- Keep `FIREBASE_ADMIN_PRIVATE_KEY` quoted and preserve `\\n` escapes in `.env.local`.
- Never expose `STRIPE_SECRET_KEY`, webhook secret, admin credentials, or job secret to client code.

---

## 3) Configure Stripe webhook

1. Install Stripe CLI and log in.
2. Forward webhook events to local app:

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

3. Copy the webhook signing secret from Stripe CLI output into `STRIPE_WEBHOOK_SECRET`.
4. Trigger test events:

```bash
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

---

## 4) Verify billing flow

1. Sign in as a normal user.
2. Open `/account` and click **Upgrade to Plus**.
3. Complete the embedded checkout form with Stripe test card `4242 4242 4242 4242`.
   - Expiry: any future date
   - CVC: any 3 digits
   - ZIP/postcode: any value
   - In sandbox mode, this is suitable for early-access users to self-activate Plus without a real charge.
4. Confirm Firestore `users/{uid}` updates:
   - `stripeCustomerId`
   - `stripeSubscriptionId`
   - `stripeSubscriptionStatus`
   - `tier: "plus"`
5. Open `/account` again and verify **Manage Billing** is shown.
6. Use **Cancel Subscription** in Account Management for an immediate cancellation, or **Manage Billing** to open Stripe Customer Portal.

---

## 5) Manual Plus grants (admin free access)

You can still grant Plus manually for feedback users by setting `users/{uid}.tier = "plus"` in the Firebase console/admin tools.

Because client rules now block user writes to billing fields, regular users cannot self-upgrade by editing Firestore directly.

---

## 6) Production checklist

1. Create live Stripe product/price and set live env vars.
2. Add production webhook endpoint in Stripe Dashboard:
   - `https://your-domain.com/api/billing/webhook`
3. Restrict Firebase service-account credentials to minimum required permissions.
4. Rotate secrets regularly.
5. Add alerts for repeated webhook failures.
