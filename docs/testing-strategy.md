# Testing Strategy (Phase A2a Foundation)

Date: 2026-07-23
Scope: Automated testing foundation only. No Connection, Network, Messaging, quota, or UI feature implementation.

## Test Stack

- Unit and component tests: Vitest + React Testing Library + jest-dom + user-event
- Firestore security rules tests: @firebase/rules-unit-testing against Firebase Firestore emulator
- Static validation: TypeScript + ESLint
- Build validation: Next.js production build

Selected because this repository is a TypeScript Next.js App Router codebase with Firebase rules, and Next.js 16 documentation explicitly supports Vitest for unit/component tests.

## Dependencies Added

Dev dependencies:
- vitest
- @vitejs/plugin-react
- vite-tsconfig-paths
- jsdom
- @testing-library/react
- @testing-library/jest-dom
- @testing-library/user-event
- @firebase/rules-unit-testing
- firebase-tools

## Test Conventions

### File naming
- Unit/component tests: *.test.ts or *.test.tsx
- Firestore rules tests: *.test.ts

### Directory conventions
- Unit/component tests: tests/unit/**
- Rules tests: tests/rules/**
- Rules test helpers: tests/rules/helpers/**

### Config files
- vitest.config.mts: jsdom-based unit/component testing
- vitest.rules.config.mts: node-based Firestore rules testing
- vitest.setup.ts: DOM matchers + cleanup hooks

## Scripts

From package.json:
- npm run typecheck
- npm run lint
- npm run test
- npm run test:unit
- npm run test:unit:watch
- npm run test:rules
- npm run build
- npm run test:ci

Script behavior:
- test: alias to unit tests
- test:unit: one-shot Vitest run for unit/component tests
- test:unit:watch: watch mode for local development
- test:rules: starts local Firestore emulator and runs rules tests inside emulator context
- test:ci: typecheck + lint + unit + rules + build (fails fast on first failure)

## Firestore Rules Test Environment

Rules tests use the repository's actual firestore.rules file and never connect to production Firebase.

Baseline guarantees:
- Emulator-only execution via firebase emulators:exec --only firestore
- Isolated project id for tests (vistateacher-rules-test)
- Data cleared between tests with clearFirestoreData
- Supports authenticated and unauthenticated contexts
- Fails clearly when FIRESTORE_EMULATOR_HOST is not set

Helper utilities included:
- getRulesEnv(): initialize shared rules test environment
- dbAsUser(uid): authenticated Firestore context
- dbAsAnonymous(): unauthenticated Firestore context
- seedUserProfile(uid): seed minimal user profile with rules disabled
- clearRulesData(): clear emulator data between tests
- assertAllowed/assertDenied wrappers

## How To Write Authenticated Rules Tests

1. Seed required documents with rules disabled helper.
2. Obtain context with dbAsUser(uid) or dbAsAnonymous().
3. Execute operation with modular Firestore SDK (setDoc/updateDoc/getDoc).
4. Assert with assertAllowed or assertDenied.
5. Keep assertions tied to current firestore.rules behavior.

## Windows and Emulator Notes

- Required runtime for Firestore emulator: Java (CI workflow installs Java 17).
- On Windows, run scripts through npm scripts to avoid quoting issues.
- Preferred command for rules tests: npm run test:rules

## Current Baseline Coverage Added In Phase A2a

### Unit tests
- Deterministic utility coverage for slug parsing, mention parsing, multiline normalization, preview truncation, and relative time formatting.

### React component tests
- Baseline interaction and disabled/loading behavior coverage for shared Button component.

### Firestore rules tests
- Unauthenticated protected write denied.
- Authenticated owner update allowed for permitted profile fields.
- Authenticated non-owner update denied for another user's protected data.
- Public profile read allowed where intentionally public.
- Protected user fields (tier/role) not writable by owner updates.
- Current broad public read behavior for lessons documented as existing behavior.

## Known Security-Rule Concerns Observed

- Lessons are publicly readable at rules level, including draft-like documents, by explicit current rule design.
- This behavior is intentionally documented by test and should be handled as a separate security/product decision, not changed silently in A2a.

## Recommended Test Pyramid For Phase A2b+

### Unit tests
Required for:
- Validation
- Canonical participant keys
- State transitions
- Quota-period keys
- Match scoring
- Formatting

### Integration tests
Required for:
- Connection request creation
- Accept and decline behavior
- Notifications
- Quota enforcement
- Conversation creation

### Firestore rules tests
Required for:
- Ownership
- Participant access
- Unauthorized access
- Protected fields
- Connection and messaging permissions

### End-to-end tests
Deferred until Connection and Messaging UI surfaces exist.
Playwright is intentionally not introduced in this phase.

## Intentionally Deferred In A2a

- Playwright/browser E2E tests
- Connection lifecycle API integration tests (until APIs exist)
- Messaging integration tests (until messaging routes/data model exist)
- Quota enforcement integration tests (until server-authoritative counters and APIs are implemented)
