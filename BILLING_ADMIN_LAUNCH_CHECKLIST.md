# Billing + Admin Launch Checklist

Use this checklist to track environment setup, deployment, and Stripe webhook configuration.

## 1) Collect Required Values

### Stripe
- [ ] Decide mode first: use **Test mode** for setup/testing, then repeat in **Live mode** for production
- [ ] Open Stripe Dashboard -> Developers -> API keys
- [ ] Review existing secret keys
	- [ ] If keys are old (for example, from 2023) and you are unsure where they are used, create a new key for this project
	- [ ] Keep old key temporarily during cutover, then delete old key after confirming new key works
	- [ ] Do not share secret keys in chat, screenshots, or client-side code
- [ ] Create a new secret key (recommended)
	- [ ] In API keys, click **Create secret key**
	- [ ] Name it something clear, for example `vistateacher-local` or `vistateacher-prod`
	- [ ] Copy it once and store as `STRIPE_SECRET_KEY`
- [ ] Create/find the Plus product and recurring price for `STRIPE_PLUS_PRICE_ID`
	- [ ] Go to Product catalog -> Add product (or open existing Plus product)
	- [ ] Set pricing model to **Recurring**
	- [ ] Choose billing interval (for example monthly)
	- [ ] Save and copy the **Price ID** (starts with `price_`)
	- [ ] Paste into env var `STRIPE_PLUS_PRICE_ID`
- [ ] Create webhook endpoint and copy `STRIPE_WEBHOOK_SECRET`
	- [ ] Go to Developers -> Webhooks -> Add endpoint
	- [ ] Endpoint URL should be `https://<your-domain>/api/billing/webhook`
	- [ ] Add events:
		- [ ] `checkout.session.completed`
		- [ ] `customer.subscription.updated`
		- [ ] `customer.subscription.deleted`
	- [ ] Save endpoint
	- [ ] Open the endpoint details and reveal **Signing secret**
	- [ ] Copy signing secret (starts with `whsec_`) into `STRIPE_WEBHOOK_SECRET`

#### Stripe Key Rotation Notes (Recommended)

- [ ] Prefer creating new keys now if current keys are old or reused by other projects
- [ ] Use separate keys for local/test and production/live
- [ ] Rotate on any suspicion of exposure
- [ ] After successful cutover, delete unused old keys

### Firebase Admin Service Account
- [ ] Open Google Cloud Console -> IAM & Admin -> Service Accounts
- [ ] Create/select service account with Firebase Admin access
- [ ] Generate/download JSON key
- [ ] Copy `FIREBASE_ADMIN_PROJECT_ID` from JSON
- [ ] Copy `FIREBASE_ADMIN_CLIENT_EMAIL` from JSON
- [ ] Copy `FIREBASE_ADMIN_PRIVATE_KEY` from JSON

## 1A) Mode Plan: Test Now, Live Later

Use this project strategy:
- [ ] Local development uses Stripe **Test mode** values only
- [ ] Production launch will switch to Stripe **Live mode** values
- [ ] Keep the same env variable names in code; only values change by environment

### What to name things in Stripe

#### Test mode naming
- [ ] Secret key name: `vistateacher-test-server`
- [ ] Product name: `VistaTeacher Plus (Test)`
- [ ] Price nickname: `plus-monthly-test` (or `plus-annual-test`)
- [ ] Webhook endpoint description: `VistaTeacher Test Webhook`

#### Live mode naming
- [ ] Secret key name: `vistateacher-live-server`
- [ ] Product name: `VistaTeacher Plus`
- [ ] Price nickname: `plus-monthly-live` (or `plus-annual-live`)
- [ ] Webhook endpoint description: `VistaTeacher Live Webhook`

### What to enter in your project now (Test mode)

- [ ] In local `.env.local`, set `STRIPE_SECRET_KEY` to your **test** secret key (`sk_test_...`)
- [ ] Set `STRIPE_PLUS_PRICE_ID` to your **test** recurring price ID (`price_...` from Test mode product)
- [ ] Set `STRIPE_WEBHOOK_SECRET` to your **test** webhook signing secret (`whsec_...`)
- [ ] Keep `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- [ ] Keep `STRIPE_BILLING_PORTAL_RETURN_URL=http://localhost:3000/account`

### What to enter at launch (Live mode)

- [ ] In production environment settings, replace Stripe values with **live** values:
	- [ ] `STRIPE_SECRET_KEY=sk_live_...`
	- [ ] `STRIPE_PLUS_PRICE_ID=price_...` from Live mode product
	- [ ] `STRIPE_WEBHOOK_SECRET=whsec_...` from Live webhook endpoint
- [ ] Set `NEXT_PUBLIC_APP_URL` to your real domain
- [ ] Set `STRIPE_BILLING_PORTAL_RETURN_URL` to your real account page URL
- [ ] Redeploy after updating production env vars

### Important: Do not create separate env var names for test/live in code

- [ ] Use the same variable names your API expects:
	- [ ] `STRIPE_SECRET_KEY`
	- [ ] `STRIPE_PLUS_PRICE_ID`
	- [ ] `STRIPE_WEBHOOK_SECRET`
- [ ] Only values should differ by environment (local test vs production live)

## 2) Local Environment Variables (.env.local)

- [ ] Open/create `.env.local` in project root
- [ ] Add the following variables:

```env
STRIPE_SECRET_KEY=
STRIPE_PLUS_PRICE_ID=
STRIPE_WEBHOOK_SECRET=
STRIPE_BILLING_PORTAL_RETURN_URL=http://localhost:3000/account
NEXT_PUBLIC_APP_URL=http://localhost:3000
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

- [ ] Confirm `FIREBASE_ADMIN_PRIVATE_KEY` remains quoted
- [ ] Confirm private key newlines are escaped as `\n`
- [ ] Restart local dev server after env changes

## 3) Production Environment Variables

- [ ] Add all 8 variables in your hosting platform production env settings
- [ ] Set `NEXT_PUBLIC_APP_URL` to your production domain (e.g. `https://yourdomain.com`)
- [ ] Set `STRIPE_BILLING_PORTAL_RETURN_URL` to production account page (e.g. `https://yourdomain.com/account`)
- [ ] Redeploy after saving production env vars

## 4) Deploy Firestore Rules

- [ ] Confirm rules changes are present in `firestore.rules`
- [ ] Run `firebase login`
- [ ] Run `firebase use <your-project-id>`
- [ ] Run `firebase deploy --only firestore:rules`
- [ ] Verify admin-only job posting is enforced
- [ ] Verify protected fields (`tier`, `role`, billing fields) cannot be client-written

## 5) Configure Stripe Webhook Endpoint

- [ ] Open Stripe Dashboard -> Developers -> Webhooks -> Add endpoint
- [ ] Set endpoint URL to `https://<your-domain>/api/billing/webhook`
- [ ] Subscribe to event: `checkout.session.completed`
- [ ] Subscribe to event: `customer.subscription.updated`
- [ ] Subscribe to event: `customer.subscription.deleted`
- [ ] Save webhook endpoint
- [ ] Copy webhook signing secret into `STRIPE_WEBHOOK_SECRET` in production env
- [ ] Redeploy if required by your host

## 6) Local Webhook Testing (Recommended)

- [ ] Install Stripe CLI
- [ ] Run `stripe login`
- [ ] Run `stripe listen --forward-to http://localhost:3000/api/billing/webhook`
- [ ] Copy CLI webhook signing secret and set local `STRIPE_WEBHOOK_SECRET`
- [ ] Trigger `stripe trigger checkout.session.completed`
- [ ] Trigger `stripe trigger customer.subscription.updated`
- [ ] Trigger `stripe trigger customer.subscription.deleted`

## 7) End-to-End Verification

### Upgrade and Billing
- [ ] As free user, open `/account/upgrade` and click Upgrade
- [ ] Confirm checkout session starts
- [ ] Confirm success return state displays on `/account/upgrade?status=success`
- [ ] Confirm cancel return state displays on `/account/upgrade?status=cancel`
- [ ] Complete test checkout and confirm user `tier` updates to `plus`
- [ ] Cancel/delete subscription and confirm user `tier` reverts to `free`
- [ ] As plus user, confirm Manage Billing opens billing portal

### Admin and Permissions
- [ ] Confirm admin user sees Admin Console in profile dropdown
- [ ] Confirm non-admin users do not see Admin Console entry
- [ ] Confirm admin page loads user list and actions
- [ ] Confirm admin can update tier (free/plus)
- [ ] Confirm admin can update role (user/admin)
- [ ] Confirm admin can disable/enable accounts
- [ ] Confirm admin can generate password reset link
- [ ] Confirm admin can delete user account

### Jobs Access Control
- [ ] Confirm non-admin users do not see Post Job action
- [ ] Confirm non-admin users cannot access posting flow
- [ ] Confirm admins can post jobs normally
- [ ] Confirm Firestore rules block non-admin write attempts to jobs
