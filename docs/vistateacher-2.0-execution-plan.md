# VistaTeacher 2.0 - Execution Plan

Date: 2026-07-23
Phase: 2 planning output

## Execution principles
- Dependency-aware sequencing.
- Additive, non-destructive migration.
- Follow remains intact while Connections and Messaging are added.
- Security and authorization prerequisites land before user-facing communication features.
- Each phase ships independently testable increments.

## Story ID legend (from implementation backlog)
- E1-S1 Platform security headers baseline
- E1-S2 Unified account deletion orchestration
- E1-S3 Auth guard regression verification
- E2-S1 Discover alias and nav relabel
- E2-S2 Communities label migration
- E2-S3 Secondary placement for Lesson Builder and Inspiration
- E3-S1 Profile fields extension
- E3-S2 Visibility and contact preferences
- E3-S3 Backward-compatible profile defaults
- E4-S1 Onboarding milestones
- E4-S2 Post-onboarding recommended educators
- E5-S1 Deterministic recommendations with reasons
- E5-S2 Discover filters evolution
- E5-S3 Follow and Connect actions on Discover cards
- E6-S1 Send connection request
- E6-S2 Accept or decline incoming request
- E6-S3 Cancel outgoing request
- E6-S4 Remove existing connection
- E6-S5 Block-aware request prevention
- E7-S1 Connections list in /network
- E7-S2 Incoming and sent request management in /network
- E7-S3 Suggestions panel in /network
- E7-S4 Follow graph links in /network
- E8-S1 Create/open unique 1:1 conversation
- E8-S2 Authorized message send with quota enforcement
- E8-S3 Unread and read state consistency
- E8-S4 Message notification linking
- E8-S5 Report/block safety entry points
- E9-S1 Dashboard request and unread summaries
- E9-S2 Dashboard suggestion module
- E11-S1 Free connection-request quota
- E11-S2 Free message quota
- E11-S3 Plus unlimited overrides
- E11-S4 Downgrade behavior
- E14-S1 Connection lifecycle integration tests
- E14-S2 Messaging authorization and quota tests
- E14-S3 Rollback runbook validation

## Phase A - Platform prerequisites and route migration foundation

Goal:
- Establish safety, compatibility, and migration scaffolding before networking features.

Included stories:
- E1-S1, E1-S2, E1-S3
- E2-S1, E2-S2
- E14-S3 (initial rollback playbook)

Excluded work:
- No connection or messaging user features.
- No recommendation ranking changes.

Files or systems likely affected:
- next.config.ts
- proxy.ts
- app shell/navigation components
- account deletion server utilities and docs

Data migration requirements:
- None.

Security-rule requirements:
- None in this phase.

Testing requirements:
- Auth guard route-coverage checks.
- Regression checks for existing nav and route accessibility.
- Manual verification for secure-header compatibility.

Definition of done:
- Discover label and alias strategy implemented without link breakage.
- Security baseline merged and verified.
- Account deletion authoritative path documented and selected.

Rollback considerations:
- Revert nav labels and alias wiring without data loss.
- Disable header policy selectively if incompatibility is discovered.

## Phase B - Profile and Discover readiness

Goal:
- Prepare profile signal quality and deterministic recommendation baseline.

Included stories:
- E3-S1, E3-S2, E3-S3
- E4-S1
- E5-S1, E5-S2

Excluded work:
- No connection acceptance workflows yet.
- No messaging routes.

Files or systems likely affected:
- Profile forms and profile render surfaces
- Discover page and query services
- Firestore helpers for recommendation inputs

Data migration requirements:
- Additive profile fields with defaults.
- Backward-compatible handling for legacy user docs.

Security-rule requirements:
- Potential read-scope adjustments for new visibility settings.

Testing requirements:
- Legacy profile compatibility tests.
- Recommendation reason correctness checks.
- Discover pagination and performance smoke tests.

Definition of done:
- New profile fields are optional and non-breaking.
- Deterministic recommendation reasons render correctly.

Rollback considerations:
- Hide new profile fields via feature flags.
- Revert recommendation modules to existing search/filter behavior.

## Phase C - Connection system MVP and Network page

Goal:
- Launch Connect lifecycle and /network as first-class relationship management area.

Included stories:
- E6-S1, E6-S2, E6-S3, E6-S4, E6-S5
- E7-S1, E7-S2, E7-S3, E7-S4
- E14-S1

Excluded work:
- Messaging send/read flows.
- Paid quota enforcement for messages.

Files or systems likely affected:
- New /network route and related components
- New network APIs and data model helpers
- Notification integration for connection events
- Firestore rules and indexes for connection data

Data migration requirements:
- Introduce connection collections and optional user projections.

Security-rule requirements:
- Required for connection collections and blocked lists.

Testing requirements:
- Transition validity tests for all connection states.
- Duplicate/reversed request race tests.
- Network page loading/empty/error/action UI tests.

Definition of done:
- Users can send/accept/decline/cancel/remove connections.
- /network exposes accepted, incoming, sent, suggestions, and follow-graph links.
- Follow model remains unchanged and functional.

Rollback considerations:
- Feature-flag disable /network and connection actions.
- Preserve underlying connection records for forward retry if rollback is UI/API only.

## Phase D - Messaging MVP and quotas

Goal:
- Deliver trusted 1:1 messaging for accepted connections with server-side limits.

Included stories:
- E8-S1, E8-S2, E8-S3, E8-S4, E8-S5
- E11-S2, E11-S3, E11-S4
- E14-S2

Excluded work:
- Group messaging.
- Attachments, reactions, editing, E2E encryption.

Files or systems likely affected:
- New /messages and /messages/[conversationId] pages
- Messaging API endpoints and helper services
- Notification wiring for message events
- Usage counters and entitlement logic
- Firestore rules and indexes for conversation/message access

Data migration requirements:
- Add conversations/messages/participants collections.
- Add usage counter docs by month key.

Security-rule requirements:
- Required before launch.
- Participant-only reads and API-authoritative writes.

Testing requirements:
- Messaging authorization tests.
- Quota transaction tests including race conditions.
- Unread/read consistency tests.

Definition of done:
- Accepted connections can create/open conversations.
- Free-tier monthly message limit enforced server-side.
- Unread and read state remains consistent in list and thread.

Rollback considerations:
- Disable messaging routes and composer via feature flag.
- Keep conversation data intact for relaunch after fixes.

## Phase E - Monetization extensions and dashboard optimization

Goal:
- Add request quotas, plus entitlements, and relationship-centric dashboard improvements.

Included stories:
- E11-S1, E11-S3, E11-S4
- E9-S1, E9-S2
- E4-S2

Excluded work:
- Behavioral recommendation Version 3.
- Advanced profile-insights productization not yet implemented.

Files or systems likely affected:
- Network and discover CTA components
- Dashboard modules
- Tier gating middleware in APIs

Data migration requirements:
- None beyond counters already in place.

Security-rule requirements:
- Minimal, assuming API-authoritative writes already established.

Testing requirements:
- Tier-change and downgrade behavior tests.
- Upgrade prompt and failure-state UX tests.

Definition of done:
- Free and plus quotas enforced for outgoing requests and messages.
- Dashboard highlights relationship actions and unread communication.

Rollback considerations:
- Feature-flag disable entitlement checks while preserving data.
- Fallback to ungated connection request limits if needed.

## Functioning user-loop mapping by phase
- Onboarding: Phase B
- Discover: Phase A (label/alias) + Phase B (recommendations)
- Profile: Phase B
- Connect: Phase C
- Network: Phase C
- Message: Phase D

## Recommended first phase for application-code changes
- Phase A should contain the first application-code changes.

Rationale:
- It unlocks safe migration scaffolding and security posture improvements required by all downstream user-facing networking features.
