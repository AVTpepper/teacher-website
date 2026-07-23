# VistaTeacher 2.0 - Roadmap (Phase Planning)

Date: 2026-07-23
Scope: Sequenced product and architecture roadmap derived from current state. No implementation in this phase.

## Objectives
- Reposition VistaTeacher around DISCOVER -> CONNECT -> COLLABORATE.
- Preserve existing working surfaces while introducing networking core.
- Deliver messaging and network capabilities with low migration risk.

## Part 9 - IA Migration Strategy

### Current primary IA
- Home
- Educators
- Forums
- Resources
- Lesson Builder
- Inspiration
- Jobs

### Target primary IA
- Discover
- Network
- Messages
- Communities
- Resources
- Jobs
- Profile/Account

### Migration principles
- No destructive removals in early phases.
- Prefer relabel + alias before route/path replacement.
- Keep existing deep links functional.
- Feature-flag net-new surfaces.

### IA migration map

| Current Label/Route | Target Label/Route | Migration Type | Notes |
|---|---|---|---|
| Educators (/educators) | Discover (/discover) | Alias + relabel | Keep /educators for compatibility; /discover becomes canonical |
| Followers/Following subpages | Network subsections | New IA Surface | Keep profile-linked lists and mirror in /network |
| Notifications (/notifications) | Notifications (utility) | Keep | Keep global utility role |
| Forums (/forums) | Communities (/forums) | Relabel only | Route can remain /forums initially |
| Home (/home) | Home feed under Discover context | Reposition | Reduce as sole post-login anchor |
| Message button on profile (disabled) | Active entry to /messages | Activate new route | Depends on connection/messaging backend |
| Search (/search) | Search within Discover/Global | Reposition | Keep route, improve people-first weighting later |
| Lesson Builder | Collaborate tooling (secondary) | Reposition | Keep intact; reduce top-level dominance |
| Inspiration | Secondary content surface | Reposition | Keep route intact |
| Jobs | Jobs | Keep | No major IA change |

### Navigation rollout recommendation
1. Add Discover label pointing to /discover alias.
2. Add Network nav item with basic list sections.
3. Add Messages nav item once conversation list is stable.
4. Rename Forums to Communities in UI labels.
5. Keep Resources and Jobs unchanged.
6. Move Lesson Builder and Inspiration to secondary placement if needed after adoption metrics.

## Part 11 - Phased Implementation Plan (A/B/C/D)

## Phase A - Foundation and Safety

Goal:
- Prepare data contracts, route aliases, and backend safeguards without breaking current behavior.

Scope:
- Introduce /discover alias routing to current educators behavior.
- Define and deploy networking/messaging schemas.
- Create API shells for connections and messaging (server-authoritative).
- Add/adjust rules for new collections with least privilege.
- Add middleware guards for future /network and /messages.
- Add security headers baseline in Next configuration.

Dependencies:
- Existing auth/session + Firebase Admin + Stripe tier field.

Risks:
- Rules misconfiguration and unauthorized writes.

Acceptance criteria:
- No regressions in existing follow, discovery, and notification flows.
- New schemas available and read/write validated via tests.
- Feature flags can disable new surfaces safely.

## Phase B - Discover and Network MVP

Goal:
- Make professional relationship management first-class while preserving follow.

Scope:
- Launch /discover as canonical IA entry for educator discovery.
- Add recommendation sections backed by deterministic overlap scoring.
- Launch /network with:
  - accepted connections list
  - incoming/sent request queues
  - suggested educators
- Implement connection request lifecycle endpoints and notifications.
- Keep follow actions live in profile/discover.

Dependencies:
- Phase A schemas/APIs/rules.

Risks:
- User confusion between follow vs connect semantics.

Mitigation:
- Explicit copy and tooltip guidance:
  - Follow = content updates
  - Connect = professional relationship + messaging eligibility

Acceptance criteria:
- Users can send/accept/reject/withdraw connection requests.
- Accepted connections render correctly in /network.
- Existing follow interactions continue unaffected.

## Phase C - Messaging MVP

Goal:
- Enable reliable direct messaging tied to connection/trust policy.

Scope:
- Launch /messages list and /messages/[conversationId] thread.
- Create conversation creation endpoint with participant uniqueness enforcement.
- Add message send endpoint with tier/quota checks and rate limiting.
- Add read cursors and unread counts.
- Integrate notifications linking into conversations.
- Add block/report controls and send-time enforcement.

Dependencies:
- Phase B connection states and network APIs.

Risks:
- Spam and moderation gaps.

Mitigation:
- Server quotas, throttles, idempotency keys, block list checks.

Acceptance criteria:
- Connected users can exchange messages.
- Free-tier monthly limits are enforced server-side.
- Read/unread state remains consistent across list and thread.

## Phase D - Optimization, Monetization, and IA Cleanup

Goal:
- Improve relevance, conversion, and long-term maintainability.

Scope:
- Improve recommendation quality and ranking explanations.
- Add premium feature differentiation for advanced network/search/messaging limits.
- Add onboarding checklist with explicit Discover -> Connect -> Message milestones.
- Rebalance nav prominence based on adoption metrics.
- Deprecate redundant entry points after stable migration period.

Dependencies:
- Stable usage telemetry from phases B/C.

Risks:
- Over-aggressive IA changes harming established user routines.

Mitigation:
- Gradual exposure with telemetry-driven decisions.

Acceptance criteria:
- Measurable lift in connection creation and message activation.
- Retention and engagement no worse than baseline during migration.

## Delivery Backlog by Workstream

### Product/UX
- Define follow vs connect language system-wide.
- Design /network information hierarchy.
- Add profile modules for collaboration intent and shared context.
- Define messaging empty/loading/error states.

### Backend/Data
- Add connection request and connection materialization models.
- Add conversation/message models and indices.
- Build quota counters and monthly reset semantics.
- Add moderation/report stores and auditing.

### Frontend
- Add /discover alias + IA relabels.
- Build /network page sections and request actions.
- Build /messages list + thread UI.
- Update profile action bar from disabled message to active conditional CTA.

### Security/Compliance
- Harden rules for new collections.
- Add CSP/HSTS/X-Frame-Options and verify compatibility.
- Add abuse controls (rate limits, block/report).

### QA/Observability
- Add integration tests for connection and messaging lifecycles.
- Add telemetry for discover -> connect -> message funnel.
- Add alerting for webhook failures and quota endpoint errors.

## Top 5 Highest-Priority Changes

1. Introduce dedicated connection model while preserving follow.
2. Launch /network as first-class relationship workspace.
3. Implement production-ready /messages architecture with strict server authorization and quotas.
4. Reframe educators as discover with people-first recommendation context.
5. Unify account deletion and strengthen security baselines (headers + sensitive-path controls).

## Success Metrics

Activation metrics:
- % of new users who follow at least 3 educators in first 7 days.
- % of new users who send at least 1 connection request.
- % of accepted connections that produce first message within 7 days.

Engagement metrics:
- Weekly active users in /network.
- Weekly active users in /messages.
- D30 retention among users with >=1 accepted connection vs none.

Business metrics:
- Plus conversion among users hitting free-tier messaging limit.
- Churn delta after introducing networking-first IA.
