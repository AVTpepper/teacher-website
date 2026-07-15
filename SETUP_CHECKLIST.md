# Setup Checklist

Maintained alongside the project. Mark items `[x]` when complete — do not delete entries.

---

## Summary

- [x] OpenAI API Key — needed for US-01: Secure Server-Side OpenAI API Route
- [ ] Stripe Billing + Webhook secrets — needed for paid Plus subscriptions
- [ ] Firebase Admin service account credentials — needed for secure server-side tier sync and background account deletion
- [ ] Account deletion job secret — needed to process queued deletion requests safely

---

## OpenAI API Key

**Needed for**: US-01 — Secure Server-Side OpenAI API Route  
**What it is**: A secret key that authenticates server-side requests to OpenAI's chat completions API. It is read exclusively from `process.env` and never sent to the browser.

### Setup Steps

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys) and sign in (or create an account).
2. Click **Create new secret key**, give it a name (e.g. `educonnect-dev`), and copy the key immediately — it is only shown once.
3. Ensure your account has access to `gpt-4o-mini` (available on any paid tier).
4. Add the key to your local environment file (see below).

### Add to your `.env.local` file

```
OPENAI_API_KEY=sk-...your_key_here
```

> **Important**: `.env.local` is git-ignored. Never commit this file or paste the key anywhere in the codebase.

### Checklist

- [x] OpenAI account created / signed in
- [x] API key generated and copied
- [x] `OPENAI_API_KEY` added to `.env.local`
- [x] Verification: start the dev server (`npm run dev`) and POST to `/api/ai/lesson` with a valid auth token — you should receive a 200 response, not a 503

---

## Stripe Billing + Webhook

**Needed for**: paid Plus subscriptions and self-service billing management.

### Setup Steps

1. Create a Stripe product and recurring price for Plus.
2. Copy these env vars into `.env.local`:

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PLUS_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

3. Start webhook forwarding:

```
stripe listen --forward-to localhost:3000/api/billing/webhook
```

4. Test webhook events:

```
stripe trigger checkout.session.completed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
```

### Checklist

- [ ] Stripe product and recurring price created
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` added to `.env.local`
- [ ] `STRIPE_SECRET_KEY` added to `.env.local`
- [ ] `STRIPE_PLUS_PRICE_ID` added to `.env.local`
- [ ] `STRIPE_WEBHOOK_SECRET` added to `.env.local`
- [ ] Verification: successful checkout sets `users/{uid}.tier` to `plus` via webhook
- [ ] Verification: direct account cancellation returns the user to `tier: free`

---

## Firebase Admin Credentials

**Needed for**: server-only billing sync, monitoring writes, and queued account deletion processing.

### Add to `.env.local`

```
FIREBASE_ADMIN_PROJECT_ID=your-project-id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-...@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Checklist

- [ ] Service account JSON created in Firebase/GCP console
- [ ] `FIREBASE_ADMIN_PROJECT_ID` set
- [ ] `FIREBASE_ADMIN_CLIENT_EMAIL` set
- [ ] `FIREBASE_ADMIN_PRIVATE_KEY` set with escaped newlines

---

## Account Deletion Job Secret

**Needed for**: authorizing internal queue processing endpoint (`/api/internal/account-deletion/process`).

### Add to `.env.local`

```
ACCOUNT_DELETION_JOB_SECRET=choose-a-strong-random-secret
```

### Checklist

- [ ] `ACCOUNT_DELETION_JOB_SECRET` configured
- [ ] Verification: `npm run process-account-deletions` returns processed/succeeded counts

---
