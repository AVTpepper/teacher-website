# Security Headers Baseline (Phase A1)

Date: 2026-07-23
Scope: Initial low-risk baseline for response security headers in Next.js config.

## Summary
A conservative security baseline was added in [next.config.ts](next.config.ts) using Next.js `headers()` configuration for all routes (`/:path*`).

This phase intentionally avoids an aggressive Content Security Policy rollout to reduce risk of breaking Firebase auth flows, Stripe checkout surfaces, and other runtime integrations.

## Headers Added

1. `X-Content-Type-Options: nosniff`
- Purpose: Prevent MIME-type sniffing and reduce content-type confusion attacks.
- Environment behavior: Enabled in all environments.

2. `Referrer-Policy: strict-origin-when-cross-origin`
- Purpose: Limit referrer leakage while preserving useful same-origin analytics and navigation behavior.
- Environment behavior: Enabled in all environments.

3. `X-Frame-Options: SAMEORIGIN`
- Purpose: Mitigate clickjacking by preventing third-party framing while allowing same-origin framing.
- Environment behavior: Enabled in all environments.

4. `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`
- Purpose: Disable unused sensitive browser capabilities by default.
- Environment behavior: Enabled in all environments.

5. `Strict-Transport-Security: max-age=31536000` (production only)
- Purpose: Enforce HTTPS on supported browsers for subsequent requests.
- Environment behavior: Enabled only when `NODE_ENV=production`.

## External Domains and Integrations Considered

Current app and deployment behavior was reviewed against:
- Firebase Auth and Firebase client SDK usage.
- Firestore and Firebase Storage usage.
- Google profile image hosting (`lh3.googleusercontent.com`).
- Firebase Storage image hosting (`firebasestorage.googleapis.com`).
- Stripe checkout and portal API usage.
- App Router + proxy routing behavior in Next.js 16.

These integrations influenced the decision to defer strict CSP in Phase A1.

## Headers Deferred (and why)

1. `Content-Security-Policy` (deferred)
- Why deferred now:
  - A strict CSP in this app likely requires per-request nonces and dynamic-rendering considerations documented by Next.js.
  - Stripe and Firebase auth/payment flows require careful `script-src`, `frame-src`, and `connect-src` allowlists.
  - Introducing CSP prematurely risks production regressions.
- Planned next step:
  - Add CSP in report-only mode first.
  - Capture violations in staging.
  - Move to enforced CSP after allowlist validation.

2. `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, `Cross-Origin-Resource-Policy` (deferred)
- Why deferred now:
  - These can affect third-party scripts, embeds, and document-sharing behavior.
  - No compatibility test matrix exists yet for existing integrations.

3. `Permissions-Policy` expansion (deferred)
- Why deferred now:
  - Keep initial policy minimal and safe.
  - Expand directives after feature-by-feature review.

## Manual Verification Steps

1. Header presence checks
- Open app pages and confirm these headers exist in responses:
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `X-Frame-Options`
  - `Permissions-Policy`
- In production-like environment, confirm `Strict-Transport-Security` is present.

2. Auth checks
- Verify email login and signup still function.
- Verify Google sign-in still functions.
- Verify redirects through `/auth/login?redirect=...` remain correct.

3. Stripe checks
- Verify `/account/upgrade` checkout initiation still works.
- Verify billing portal navigation still works.

4. Firebase data and media checks
- Verify educator avatars from Firebase/Google still load.
- Verify resources/forums/jobs pages still load and fetch data normally.

5. Route/system checks
- Verify proxy-based route protection behavior remains unchanged.

## Notes
- This baseline is intentionally incremental and non-disruptive.
- CSP rollout is planned as a separate hardening step with explicit integration testing.
