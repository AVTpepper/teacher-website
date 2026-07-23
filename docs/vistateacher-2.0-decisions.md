# VistaTeacher 2.0 - Architecture Decision Log

Date: 2026-07-23

## Decision
Keep Follow as one-way subscription and add separate Connections model.

## Status
Accepted (established by Phase 1 conclusions).

## Context
Follow is deeply integrated in discovery/profile counters and notifications. Networking requires mutual relationship semantics.

## Options considered
- Replace Follow with Connection-only.
- Keep Follow and add Connections.
- Evolve Follow into a two-state relation.

## Recommendation
Keep Follow unchanged for content subscription and implement Connections as a separate mutual model.

## Consequences
- Lower migration risk.
- Clear separation between content following and professional relationship permissions.

## Migration impact
- Add new data model and APIs.
- Preserve existing follow routes, helpers, and counters.

---

## Decision
Add /discover as primary discovery route while preserving /educators compatibility.

## Status
Accepted (established by Phase 1 conclusions).

## Context
Current user-facing terminology and IA should move from Educators-first to Discover-first without breaking links.

## Options considered
- Hard rename /educators to /discover.
- Alias-first migration.
- Keep /educators only.

## Recommendation
Use alias-first migration: add /discover, keep /educators active.

## Consequences
- No immediate link breakage.
- Gradual migration possible through nav relabeling.

## Migration impact
- Add route alias and update navigation labels.
- Keep old route accessible during transition.

---

## Decision
Add /network as a first-class authenticated product surface.

## Status
Accepted (established by Phase 1 conclusions).

## Context
Relationship management is currently fragmented across profile, discovery, and notifications.

## Options considered
- Keep distributed entry points only.
- Add dedicated /network.

## Recommendation
Introduce /network with sections for connections, requests, suggestions, and follow graph links.

## Consequences
- Better relationship management clarity.
- New API and page complexity.

## Migration impact
- New route and component layer.
- Existing follow/follower routes remain available.

---

## Decision
Add /messages and /messages/[conversationId] as first-class authenticated surfaces.

## Status
Accepted (established by Phase 1 conclusions).

## Context
Messaging CTA exists but is disabled; no conversation model or route exists.

## Options considered
- Keep no messaging.
- Add direct messaging between all users.
- Add messaging restricted to accepted connections.

## Recommendation
Add messaging MVP for one-to-one conversations with accepted-connection eligibility.

## Consequences
- Requires new data model, APIs, and moderation controls.

## Migration impact
- New routes and guarded middleware coverage.
- No impact to existing content routes.

---

## Decision
Message eligibility policy.

## Status
Accepted.

## Context
Needs product clarity on who can message whom before launch.

## Options considered
- Any authenticated user can message any user.
- Only accepted connections can message.
- Follow relationship enables messaging.

## Recommendation
Only accepted connections can message in MVP.

## Consequences
- Lower abuse risk.
- Stronger reason to connect.

## Migration impact
- Connection checks required in conversation creation and message send APIs.

---

## Decision
Monthly quota period for free-tier limits.

## Status
Accepted.

## Context
Business rules require free limits for connection requests and sent messages.

## Options considered
- Calendar month.
- Subscription billing cycle.
- Rolling 30-day window.

## Recommendation
Calendar month in UTC for initial release.

## Consequences
- Easier implementation and support communication.
- Less billing-cycle precision for plus users.

## Migration impact
- Introduce usageCounters/{uid}/monthly/{yyyyMM} structure.

---

## Decision
Quota counters must be server-authoritative.

## Status
Accepted (established by Phase 1 conclusions).

## Context
Client counters can be manipulated; race conditions can bypass limits.

## Options considered
- Client-side counters.
- Server-side transactional counters.

## Recommendation
Use server-side transactional increments and checks in API endpoints.

## Consequences
- Reliable enforcement.
- Slightly higher backend complexity.

## Migration impact
- New counter documents and transactional logic in network/messaging APIs.

---

## Decision
Conversation data structure.

## Status
Proposed.

## Context
Need scalable 1:1 conversation model with unread and preview support.

## Options considered
- Flat messages collection.
- Conversation root + messages subcollection + participants subcollection.

## Recommendation
Use conversation root with messages and participant state subcollections.

## Consequences
- Efficient thread-level pagination and metadata updates.
- Requires carefully designed indexes and listener strategy.

## Migration impact
- New collections and security rules.

---

## Decision
Profile field migration strategy for networking metadata.

## Status
Proposed.

## Context
Future discovery/recommendation features need richer profile data, but existing users must not break.

## Options considered
- Make new fields required immediately.
- Add optional fields with progressive completion.

## Recommendation
Add optional fields with backward-compatible defaults and progressive onboarding prompts.

## Consequences
- Lower migration friction.
- Slower initial coverage of recommendation inputs.

## Migration impact
- Schema extension only; no destructive data migration.

---

## Decision
Communities vs Forums terminology.

## Status
Accepted for UI terminology, route strategy proposed.

## Context
Product terminology should use Communities while existing implementation uses /forums.

## Options considered
- Rename route immediately.
- Relabel UI only initially.
- Keep Forums terminology.

## Recommendation
Relabel UI to Communities first, retain /forums route initially, optionally add /communities alias later.

## Consequences
- Minimal routing risk.
- Temporary terminology split in code vs UI.

## Migration impact
- Copy updates first; route alias optional in later phase.

---

## Decision
Placement of Lesson Builder in target IA.

## Status
Proposed.

## Context
Primary nav must prioritize networking loop without removing existing capabilities.

## Options considered
- Keep Lesson Builder in primary nav.
- Move to secondary Collaborate/Create navigation.

## Recommendation
Move Lesson Builder to secondary navigation after Discover/Network/Messages are introduced.

## Consequences
- Cleaner primary nav for networking goals.
- Requires discoverability safeguards.

## Migration impact
- Navigation placement and shortcut updates only.

---

## Decision
Placement of Inspiration in target IA.

## Status
Proposed.

## Context
Inspiration is valuable but secondary to the core networking loop.

## Options considered
- Keep in primary nav.
- Move to secondary Explore navigation.

## Recommendation
Move Inspiration to secondary navigation and preserve search/home entry points.

## Consequences
- Reduced primary-nav crowding.
- Risk of reduced traffic if discoverability is not maintained.

## Migration impact
- Navigation placement updates only.

---

## Decision
Free vs Plus entitlement boundaries for networking and messaging.

## Status
Proposed.

## Context
Target business rules specify limits for free and unlimited for plus in core communication actions.

## Options considered
- Keep all networking features free.
- Enforce quota-based differentiators.
- Enforce hard feature locks by tier.

## Recommendation
Use quota-based differentiators first:
- Free: 5 outgoing connection requests/month, 10 sent messages/month.
- Plus: unlimited outgoing requests and sent messages.

## Consequences
- Monetization aligned to communication volume.
- Requires robust counter and downgrade behavior.

## Migration impact
- Add entitlement checks to server APIs and usage counters.
