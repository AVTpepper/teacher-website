# VistaTeacher 2.0 - Implementation Blueprint and Jira-Style Backlog

Date: 2026-07-23
Phase: 2 (Planning only, no feature implementation)

## 0. Scope and Validation Delta

This document is based on:
- docs/vistateacher-current-state-audit.md
- docs/vistateacher-route-map.md
- docs/vistateacher-networking-architecture.md
- docs/vistateacher-2.0-roadmap.md
- Current codebase validation pass on routing, navigation, auth, profile, follow, notifications, rules, API routes, Stripe, account deletion, shared components, and test config.

### Verified mismatches from Phase 1 docs

1. Account route paths are partially inaccurate in the Phase 1 route map.
- Current routes are /account, /account/plans, /account/upgrade.
- /account/plan, /account/profile, /account/password, /account/delete do not exist as separate routes.

2. Internal account deletion route path is inaccurate in the Phase 1 route map.
- Current route is /api/internal/account-deletion/process.
- /api/internal/process-account-deletions does not exist.

3. Admin reset-password path naming differs from Phase 1 route map.
- Current route is /api/admin/users/[uid]/password-reset.

4. Authentication redirect behavior detail drift.
- Unauthenticated protected-route redirects currently go to /auth/login?redirect=... (not landing root route).

5. Signup default redirect behavior detail drift.
- Current signup default redirect is /profile/edit.

### Validation confirmations (important for this backlog)

- Follow is one-way and materially implemented through users/{uid}/followers and users/{uid}/following.
- Profile Message button exists and is currently disabled.
- No messages app routes or conversation/message data model exist.
- Stripe webhook synchronizes tier and subscription state into users docs.
- Billing cancel endpoint also sets tier to free directly.
- Account deletion has dual pathways (client-side direct deletion and queued server-side processor).
- Firestore rules are broad-read for profiles and lessons; notifications are recipient-only read.
- Security headers (CSP/HSTS/X-Frame-Options) are not configured in next.config.ts.
- No automated test script is configured in package.json.

## 1. Product Terminology (Authoritative)

### Follow
A one-way relationship to subscribe to an educator's public content and activity.

Following does not grant by itself:
- Messaging permissions
- Contact information access
- Connection status
- Private-profile access

### Connection
A mutual professional relationship with lifecycle:
- Request
- Acceptance
- Decline
- Cancellation
- Removal

Accepted connection may grant in future:
- Messaging permissions
- Connection-only profile information
- Contact information request eligibility
- Collaboration functionality

### Network
Authenticated workspace for relationship management:
- Accepted connections
- Incoming requests
- Sent requests
- Suggested connections
- Network activity

### Discover
Primary educator discovery experience:
- Search
- Filters
- Recommendations
- Shared attributes
- Networking goals

### Community
Broader collaboration space:
- Discussions
- Forums
- Topic-focused educator groups

### Current naming conflicts to resolve in UI copy (not code rename yet)

| Current Label/Name | Conflicts With | Proposed Product Terminology |
|---|---|---|
| Educators | Discover-first framing | Discover |
| Forums | Community umbrella | Communities |
| Following/Followers used as relationship proxy | Connection semantics | Keep as Follow metrics, add Connections separately |
| Disabled Message button on profile | Implies capability not available | Keep disabled until connection/messaging policy is active |

## 2. Target Information Architecture

## 2.1 Authenticated navigation target

Target primary navigation:
- Home
- Discover
- Network
- Messages
- Communities
- Resources
- Jobs
- Profile

### Authenticated navigation mapping table

| Nav Item | Target Route | Existing Source | New Route Needed | Alias Needed | Original Route Stays | Desktop Nav | Mobile Nav | Secondary Nav |
|---|---|---|---|---|---|---|---|---|
| Home | /home | Current Home | No | No | Yes | Yes | Yes | No |
| Discover | /discover | /educators | Yes (alias phase) | Yes (/educators -> /discover canonical) | Yes | Yes | Yes | No |
| Network | /network | None | Yes | No | N/A | Yes | Yes | No |
| Messages | /messages | None | Yes | No | N/A | Yes | Yes | No |
| Communities | /forums (phase 1), optional /communities (later) | /forums | No (phase 1) | Optional later | Yes | Yes | Yes | No |
| Resources | /resources | /resources | No | No | Yes | Yes | Yes | No |
| Jobs | /jobs | /jobs | No | No | Yes | Yes | Yes | No |
| Profile | /profile | /profile | No | No | Yes | Yes | Yes | No |

## 2.2 Public navigation target

Target public navigation:
- Discover
- Communities
- Resources
- Jobs
- Log In
- Join Free

### Public navigation mapping table

| Nav Item | Target Route | Existing Source | New Route Needed | Alias Needed | Original Route Stays | Desktop Nav | Mobile Nav | Secondary Nav |
|---|---|---|---|---|---|---|---|---|
| Discover | /discover | /educators | Yes (alias phase) | Yes | Yes | Yes | Yes | No |
| Communities | /forums | /forums | No | Optional later | Yes | Yes | Yes | No |
| Resources | /resources | /resources | No | No | Yes | Yes | Yes | No |
| Jobs | /jobs | /jobs | No | No | Yes | Yes | Yes | No |
| Log In | /auth/login | /auth/login | No | No | Yes | Yes | Yes | No |
| Join Free | /auth/signup | /auth/signup | No | No | Yes | Yes | Yes | No |

## 2.3 Placement of currently primary items moved out of primary nav

Lesson Builder recommendation:
- Keep fully accessible.
- Move to secondary Create/Collaborate menu and profile dropdown shortcuts.
- Keep deep links in Discover, profile tabs, and search results.

Inspiration recommendation:
- Keep accessible via secondary Explore menu and dashboard modules.
- Keep discoverability from Home feed blocks and search.

Search recommendation:
- Keep global top-level search input across shells.
- Keep /search route as dedicated results page.

Billing/settings/notifications/profile editing:
- Billing: Account area (/account, /account/plans, /account/upgrade).
- Settings: Account area (phase 2 may split into dedicated settings route later).
- Notifications: keep utility icon + /notifications page.
- Profile editing: keep /profile/edit.

## 3. Route Migration Rules and Matrix

Migration principles:
- Additive only in early phases.
- Alias-first before redirects.
- Preserve bookmarked and indexed routes.
- Avoid destructive route removals.
- Keep existing internal links functional while incrementally updating nav.

### Route migration matrix

| Existing Route | Future Route | Action | Redirect or Alias | Navigation Label | Compatibility Risk |
|---|---|---|---|---|---|
| /educators | /discover | Add new canonical route and keep existing | Alias, no forced redirect initially | Discover | Low |
| /educators/[id] | /educators/[id] (phase 1), optional /discover/[id] alias later | Preserve route to avoid deep-link breakage | Optional alias later | Profile | Low |
| /educators/[id]/followers | /network/followers (surface), keep existing detail route | Keep existing and cross-link | No redirect | Network (secondary) | Low |
| /educators/[id]/following | /network/following (surface), keep existing detail route | Keep existing and cross-link | No redirect | Network (secondary) | Low |
| /forums | /forums (phase 1), optional /communities alias later | Relabel UI only first | Optional alias later | Communities | Low |
| /search | /search | Keep | None | Search utility | Low |
| /notifications | /notifications | Keep | None | Notifications utility | Low |
| /account | /account | Keep | None | Account | Low |
| /account/plans | /account/plans | Keep | None | Plans | Low |
| /account/upgrade | /account/upgrade | Keep | None | Upgrade | Low |
| /network | /network | New | N/A | Network | N/A |
| /messages | /messages | New | N/A | Messages | N/A |
| /messages/[conversationId] | /messages/[conversationId] | New | N/A | Messages | N/A |

Safe approach for /educators and /discover:
- Implement /discover first as equivalent surface.
- Keep /educators route active indefinitely during migration.
- Update nav labels to Discover without breaking old links.

Safe approach for /forums and /communities:
- Change UI label to Communities first.
- Optionally introduce /communities alias after analytics confirms low confusion.
- Keep /forums as canonical for initial migration window.

## 4. Connection System Implementation Backlog

## 4.1 Data model

Recommended collection strategy:
- Primary request ledger: connections/{pairKey}
- User-oriented inbox projection: users/{uid}/connectionRequests/{requestId} (optional materialized view)
- Accepted relationship projection: users/{uid}/connections/{otherUid}
- Block list: users/{uid}/blocked/{otherUid}

Recommended request fields:
- connectionId
- pairKey (sorted uid pair: minUid__maxUid)
- requesterId
- recipientId
- status: pending, accepted, declined, canceled, removed
- reasonCode (enum)
- introMessage (optional)
- createdAt
- updatedAt
- acceptedAt (nullable)
- declinedAt (nullable)
- removedAt (nullable)
- canceledAt (nullable)
- lastActionBy
- reRequestCount

Recommended connection projection fields:
- uid (other user)
- connectedAt
- initiatedBy
- lastInteractionAt
- status (connected)

Quota metadata location:
- usageCounters/{uid}/monthly/{yyyyMM}.connectionRequestsSent
- Keep quota counters separate from relationship docs.

### Duplicate/reversal prevention strategy

Uniqueness rules:
- Use deterministic pairKey for every pair.
- Only one active pending/connected record per pair.

Case handling:
- A sends to B twice:
  - If pending by A exists, return existing pending state.
- A sends to B while B already sent to A:
  - Resolve by accepting/merging existing reverse pending into accepted connection, or present incoming request state without creating duplicate.
- Simultaneous requests:
  - Transaction on pairKey doc with create-if-not-exists semantics.
- Re-request after removed:
  - Allow with cooldown (configurable), increment reRequestCount, status to pending.

## 4.2 Application services

Required helpers and services:
- lib/firestore/connections.ts
- lib/firestore/connectionRequests.ts
- lib/firestore/networkSuggestions.ts
- lib/firestore/usageCounters.ts (extension)

Required API routes (server-authoritative):
- POST/GET /api/network/requests
- PATCH /api/network/requests/[requestId]
- GET /api/network/connections
- DELETE /api/network/connections/[otherUid]
- POST /api/network/block

Validation schemas:
- Zod or equivalent schema validation at API boundary.
- Validate uid formats, self-target prevention, enum statuses, message lengths.

Authorization checks:
- Request creation requires auth and non-self target.
- Status transitions restricted to involved users and valid transition graph.
- Removal only by participant.

Notification integration:
- Create notification on incoming request.
- Create notification on acceptance.
- Optional silent update on decline/cancel.

Query patterns:
- Incoming requests by recipientId + status pending + createdAt desc.
- Sent requests by requesterId + status pending + createdAt desc.
- Connections by uid projection subcollection ordered by connectedAt desc.

Firestore index requirements (expected):
- connections: requesterId + status + createdAt desc.
- connections: recipientId + status + createdAt desc.
- connections: pairKey unique lookup.
- users/{uid}/connections: connectedAt desc.

Security rules requirements:
- Deny client direct writes for primary connection ledger.
- Allow read to owning participants only.
- Optionally allow projection reads to owner only.

## 4.3 Connection states and transitions

Required states:
- not-connected
- incoming-request
- outgoing-request
- connected
- declined
- canceled
- removed
- blocked (planned now, enforce before messaging launch)

Transition rules:
- not-connected -> outgoing-request
- incoming-request -> connected or declined
- outgoing-request -> canceled
- connected -> removed
- any -> blocked (safety override)

## 4.4 UI surfaces requiring connection-state integration

Discover cards:
- Add Connect action next to Follow.
- Show state badges: Requested, Incoming, Connected.

Educator profile:
- Add Connect stateful button.
- Keep Follow button independent.
- Message button enabled only when policy allows.

Network page:
- Request inbox and sent views.
- Connections management actions.

Notifications:
- Add connection request and acceptance notification types.

Dashboard/Home modules:
- Suggested educators and pending request summary.

Search results:
- Show connection state chips and connect action in educator results.

## 5. Network Page Backlog (/network)

Initial production scope:
- Accepted connections
- Incoming requests
- Sent requests
- Suggested educators
- Following
- Followers

Recommended structure:
- Tabs for Connections, Requests, Suggestions.
- Secondary sections/links for Following and Followers.
- Keep existing follower/following routes and deep link from Network.

Page component structure:
- NetworkPageShell
- NetworkTabs
- ConnectionsList
- RequestsPanel (Incoming/Sent)
- SuggestionsList
- FollowGraphPanel (following/followers links)
- NetworkActivityPanel (notifications subset)

Required queries:
- Connections projection list with pagination cursor.
- Incoming pending requests with pagination.
- Sent pending requests with pagination.
- Suggestions endpoint with explainable reasons.
- Existing following/followers counts from users profile.

States to support:
- Loading skeleton for each tab.
- Empty states with CTA guidance.
- Error states with retry actions.
- Action-in-progress states for accept/decline/cancel/remove/follow/unfollow.

Mobile layout:
- Sticky tab bar with horizontally scrollable tabs.
- Cards optimized for one-column actions.
- Bottom-sheet filters if needed.

Actions:
- Accept
- Decline
- Cancel request
- Remove connection
- Follow
- Unfollow

Reusability from current app:
- Reuse educator card visual patterns from Educators page.
- Reuse follow/unfollow helper and button logic from users helpers/profile cards.
- Reuse Notification utility patterns for network activity slices.

## 6. Messaging Implementation Backlog

Smallest production-ready messaging release:
- 1:1 conversations only.
- Eligibility limited to accepted connections.
- Conversation list page.
- Conversation thread page.
- Unread and read state.
- Timestamps.
- Real-time updates for active list/thread.
- Pagination for history.
- Notification integration.
- Message limit hooks and reporting/blocking extension points.

Excluded from MVP:
- Group chat
- Attachments
- Voice/video
- Reactions
- Editing
- End-to-end encryption
- AI replies

## 6.1 Data architecture

Collections:
- conversations/{conversationId}
- conversations/{conversationId}/messages/{messageId}
- conversations/{conversationId}/participants/{uid}

Conversation fields:
- conversationId
- participants [uidA, uidB]
- participantSetKey (sorted uid pair)
- createdBy
- createdAt
- lastMessageAt
- lastMessagePreview
- lastMessageSenderUid
- status

Message fields:
- senderUid
- body
- createdAt
- messageType (text)
- idempotencyKey
- deletedAt (optional for moderation and future delete UX)

Participant fields:
- uid
- unreadCount
- lastReadMessageId
- lastReadAt
- muted (future)

Uniqueness strategy:
- participantSetKey unique check in server endpoint.

Unread strategy:
- Increment recipient unreadCount on message send transaction.
- Reset for current user on read-mark action.

Read receipt strategy:
- lastReadMessageId and lastReadAt per participant.

Pagination:
- Use createdAt desc with cursor (startAfter).

Listener lifecycle:
- Subscribe to conversation list metadata only.
- Subscribe to active thread latest page only.
- Load older pages on demand.

## 6.2 Server-authoritative message creation

Endpoints:
- POST /api/messages/conversations (find-or-create)
- GET /api/messages/conversations
- POST /api/messages/send
- POST /api/messages/read

Authorization requirements:
- Sender must be participant.
- Participants must be accepted connections (or approved policy state).
- Block checks required before write.

Security rules requirements:
- Direct client writes to message docs denied for MVP.
- Reads limited to participants.
- Participant state writes restricted to owner or API-only strategy.

Firestore index requirements (expected):
- conversations by participants/updated ordering strategy.
- messages by createdAt desc within subcollection.
- participant projections by uid and lastMessageAt desc if materialized.

Notification integration:
- Create recipient notification with linkURL /messages/{conversationId}.
- Suppress notification when recipient currently active in same conversation session (best effort).

Account deletion cleanup:
- Remove participant from conversations and apply retention policy to messages authored by deleted account.
- Option 1: tombstone sender identity.
- Option 2: hard delete only if legal policy permits.
- Decision deferred pending compliance requirements.

## 6.3 Monthly message limits

Business rule target:
- Free: 10 sent messages per month.
- Plus: unlimited sent messages.

Quota period options:
- Calendar month.
- Subscription billing cycle.
- Rolling 30-day.

Recommendation:
- Calendar month in UTC for initial release.

Tradeoff summary:
- Calendar month:
  - Pros: simple, predictable, easy to explain for free and plus users.
  - Cons: less personalized than billing-cycle alignment.
- Billing cycle:
  - Pros: aligns with paid subscription cycles.
  - Cons: complex for free users and mixed-cycle edge cases.
- Rolling 30-day:
  - Pros: smooth distribution.
  - Cons: least explainable and most complex query/accounting model.

Trusted counter architecture:
- usageCounters/{uid}/monthly/{yyyyMM}
  - messagesSent
  - connectionRequestsSent
  - updatedAt
- Enforce and increment in a single server transaction during send.
- Never trust client-reported counters.

## 7. Profile Data Changes Backlog

### Field classification matrix

| Field | Current Status | Classification | Requirement | Visibility Recommendation | Notes |
|---|---|---|---|---|---|
| professionalRole | Not present | New field | Optional initially | Public | Examples: Teacher, Coach, Curriculum Lead |
| subjects | Exists as subjects[] | Already exists | Required (already practical) | Public | Keep existing structure |
| gradeLevels | Exists as gradeLevel string | Needs extension | Optional now, required for richer matching later | Public | Migrate to gradeLevels[] while preserving gradeLevel |
| curriculum | Not present | New field | Optional | Public/Connections-only selectable | Useful for Version 1 recommendations |
| country | Exists as country | Already exists | Optional currently | Public (privacy configurable later) | Keep |
| city | Not present | New field | Optional | Connections-only by default | Privacy-sensitive |
| schoolType | Not present | New field | Optional | Public | Enum recommended |
| yearsOfExperience | Exists | Already exists | Optional currently | Public | Keep |
| languages | Not present | New field | Optional | Public | Multi-select |
| professionalInterests | Not present | New field | Optional | Public | Used in recommendations |
| networkingGoals | Not present | New field | Optional | Public/Connections-only | Used for discovery intent |
| mentorAvailability | Not present | New field | Optional | Public | Boolean or enum |
| collaborationAvailability | Not present | New field | Optional | Public | Boolean or enum |
| profileVisibility | Not present | New field | Optional | Private setting | Controls discoverability levels |
| contactPreferences | Not present | New field | Optional | Private/Connections-only | Includes contact request policy |
| onboardingCompletion | Not present | New field | Required system-managed | Private | Progress milestones |
| profileCompletionScore | Not present | New field | Required system-managed | Private (with user-visible summary) | Numeric score |

Backwards-compatible migration approach:
- Add fields as optional with safe defaults.
- Do not block reads/writes for existing profiles missing new fields.
- Compute profileCompletionScore server-side or client-derived fallback.
- Preserve old gradeLevel while introducing gradeLevels[] bridge.
- Progressive prompts instead of hard validation failures for legacy users.

## 8. Recommendation System Versions

## 8.1 Version 1 - Shared attributes (deterministic)

Required fields:
- subjects
- gradeLevel/gradeLevels
- curriculum (when available)
- country
- professionalInterests (when available)
- networkingGoals (when available)

Query strategy:
- Candidate retrieval with broad filters and pagination.
- Exclude self, blocked users, already connected users, existing pending states.
- Initial candidate sets by shared subject and grade level, optionally same country.

Scoring logic (explainable):
- +4 per shared subject (cap)
- +3 same grade band
- +2 same curriculum
- +1 same country
- +2 shared professional interest
- +2 shared networking goal
- Tie-breaker: recent activity recency and profile completeness.

Explainable reason output examples:
- You both teach mathematics.
- You both use the IB curriculum.
- You are both interested in EdTech.

Privacy considerations:
- Do not expose private attributes as reasons.
- Respect profileVisibility and contact preferences.

Pagination:
- Cursor-based response with stable sort by score then uid.

Performance constraints:
- Keep candidate set bounded per request.
- Cache short-lived suggestion results per user.

Index requirements:
- users by gradeLevel/createdAt as needed.
- users array-contains indexes for subjects/interests.
- Additional composites for selected deterministic filters.

## 8.2 Version 2 - Weighted matching

Add configurable weights by attribute category.
- Admin-tunable weight table.
- Keep reason generation tied to strongest matched attributes.
- Maintain deterministic fallback when data sparse.

## 8.3 Version 3 - Behavioral signals (deferred)

Potential signals:
- Profile views
- Follow behavior
- Resource saves
- Community participation
- Connection acceptance patterns

Status:
- Deferred.
- Not part of initial implementation phases.

## 9. Monetization Hooks (No paywalls implemented in this phase)

Tier source of truth:
- users.tier synchronized via Stripe lifecycle (webhook + cancellation path).

### Feature gate matrix

| Feature Gate | Free Policy | Plus Policy | UI Entry Point | Server Enforcement Point | Required Counter/Entitlement | Upgrade Prompt | Failure Behavior | Cancellation Behavior | Readiness |
|---|---|---|---|---|---|---|---|---|---|
| Outgoing connection requests | 5/month | Unlimited | Discover card, profile connect, network requests | /api/network/requests create | usageCounters.connectionRequestsSent | Connect button modal and network request CTA | Show limit-reached message and upgrade CTA | Revert to free limits immediately after tier change | Requires implementation |
| Incoming connection requests | Unlimited | Unlimited | Network inbox | None (no limit) | None | None | N/A | N/A | Should remain free |
| Sent messages | 10/month | Unlimited | Message thread composer | /api/messages/send | usageCounters.messagesSent | Composer inline upgrade CTA | Reject send with clear limit message | Revert to free limits immediately | Requires implementation |
| Basic discovery/search | Included | Included | Discover and search pages | Existing read paths | None | None | N/A | N/A | Already live |
| Advanced search/filters | Not included | Included | Discover filter drawer | /api/network/suggestions and advanced search API | Tier entitlement | Filter gating module | Disable advanced filters with upsell | Disable advanced controls | Requires implementation |
| Personalized recommendations | Basic deterministic | Enhanced personalized | Discover recommendations | /api/network/suggestions | Tier + feature flag | Recommendation card upsell | Fallback to basic deterministic list | Fallback to basic | Requires implementation |
| Profile viewer insights | Not included | Included | Profile analytics panel | Future profile-insights API | Tier + event data | Insights panel upgrade card | Hide insights and prompt upgrade | Hide insights | Requires implementation |
| Saved profiles | Included (initially) | Included (expanded later if needed) | Discover/profile save action | Future saved-profiles API | None initially | Optional upgrade nudges only for future enhanced capabilities | Standard validation/error handling | No tier lock on baseline saved profiles | Requires implementation |
| Enhanced profile features | Limited | Extended fields | Profile edit | Profile update API validation | Tier entitlements | Profile settings upsell | Hide/lock premium fields | Downgrade preserves data but may hide | Requires implementation |
| Contact-information requests | Not included | Included | Profile contact section | Future contact-request API | Tier + connection state | Contact request CTA | Disallow with upgrade CTA | Disallow new requests | Requires implementation |

### Features ready to gate now
- None in networking/messaging scope (features are not yet implemented).

### Features requiring implementation before gating
- Connections quotas
- Messaging quotas
- Advanced discover/search
- Personalized recommendations
- Saved profiles
- Insights
- Contact requests

### Features that should remain free
- Incoming connection requests
- Basic discovery
- Basic search
- Core follow and profile browsing
- Baseline recommendations
- Baseline saved profiles

### Features that should not be promised yet
- Viewer insights timeline detail
- Contact info exchange automation
- Behavioral recommendation AI quality claims

## 10. Security and Privacy Work Checklist

## Required before connection launch
- Least-privilege rules for connection collections.
- Server-side authorization for request transitions.
- User ID validation and self-target prevention.
- Duplicate/reversal prevention via pairKey transaction.
- Basic blocking model and checks in connection requests.
- Notification permission constraints for new connection events.
- Rate limiting for request creation.
- Logging that excludes intro message content.

## Required before messaging launch
- Message-participant authorization on every send/read.
- Server-only message creation path.
- Quota manipulation prevention with transactional counters.
- Spam prevention with per-user send throttles.
- Blocking/reporting enforcement.
- Private contact information boundaries.
- Account deletion cleanup policy for conversation data.
- Security headers baseline configured (CSP, HSTS, X-Frame-Options).

## Required before monetization launch
- Tier entitlement enforcement in all gated endpoints.
- Robust downgrade behavior handling.
- Counter reset semantics and auditability.
- Abuse controls around upgrade-prompt bypass attempts.

## Recommended later
- Fine-grained profile visibility per field.
- Moderation tooling for report review queues.
- Advanced anomaly detection for messaging abuse.
- Data retention policy automation and export/delete support.

## 11. Shared UI Component Backlog

| Component | Existing Reusable Base | Action | Pages | Required States | Accessibility Requirements |
|---|---|---|---|---|---|
| Educator card | Existing educator cards and SearchResultCard | Extend | Discover, Network suggestions, Search | default, loading, connected/requested, error action | keyboard-focus CTAs, descriptive labels |
| Match reason list | None | New | Discover, Network suggestions | populated, empty | semantic list, screen-reader readable reason text |
| Connection button | Existing Button | New composite | Discover cards, profile, search | connect, requested, incoming, connected, disabled | aria-pressed/state text, min 44x44 tap target |
| Connection-request modal | ConfirmDialog | Extend/new | Discover, profile, search | open, validating, submitted, error | focus trap, escape close, labeled fields |
| Follow button | Existing profile/discovery actions | Reuse with minor extension | Discover, profile, network follow panel | follow/following/loading/error | announce state changes |
| Network tabs | Tabs | Extend | /network | active/inactive/loading | keyboard tablist support |
| Request card | Card + Avatar + Button | New | /network requests | incoming/sent/loading/error | clear action labeling |
| Conversation list item | None | New | /messages | unread/read/active/loading | accessible timestamp and unread count labels |
| Message bubble | None | New | /messages/[conversationId] | mine/theirs/pending/failed | semantic grouping and contrast |
| Empty state | Existing patterns in app | Reuse | Discover, Network, Messages | empty with CTA | descriptive headline/body and actionable control |
| Loading skeleton | Spinner exists | New skeleton variants | Discover, Network, Messages | initial/load-more | aria-busy and reduced motion consideration |
| Upgrade prompt | Existing plan compare flows | Extend | Network, Messages, Discover filters | inline/modal/locked state | clear entitlement explanation |
| Profile-completion indicator | None | New | Profile edit, dashboard | complete/partial/missing | progress semantics via aria-valuenow |
| Professional tag | Badge/Tag | Extend | Profile, Discover, Search | default/truncated | readable label text |
| Privacy badge | Badge | New | Profile and settings | public/connections/private | tooltips with non-color cues |
| Page header | DiscoveryShell/PageHeader | Reuse | New feature pages | with/without actions | proper heading hierarchy |
| Filter drawer | Existing filters in pages | New shared component | Discover, Search | closed/open/apply/error | keyboard and screen-reader controls |
| Mobile navigation | Existing Navbar mobile menu | Extend | Global | expanded/collapsed | aria-expanded/controls and focus order |

## 12. Jira-Style Epic Backlog

Legend:
- Complexity: S, M, L, XL
- Data change: Yes/No
- Migration required: Yes/No
- Security-rule changes: Yes/No

## Epic 1 - Platform hardening

Objective:
- Establish safe infrastructure baseline for networking and messaging.

User value:
- Trustworthy and stable platform behavior.

Dependencies:
- None.

Technical risks:
- Header policy breakages and auth edge cases.

Stories:
1. As a platform operator, I can add baseline security headers in Next config so that browser-level protections are enforced.
2. As an authenticated user, I can rely on a single account deletion orchestration path so that my data is removed consistently.
3. As a developer, I can verify guard behavior for protected routes so that auth redirects are predictable.

Acceptance criteria:
- Security headers present on targeted responses and compatibility-tested.
- Account deletion path documented and one path designated authoritative.
- Auth redirect behavior covered by regression checks.

Suggested order:
- First.

Complexity:
- L

Data change:
- Possible

Migration required:
- No

Security-rule changes:
- No

## Epic 2 - Navigation and route migration

Objective:
- Introduce Discover/Network/Messages IA without breaking existing links.

User value:
- Clearer path to networking actions.

Dependencies:
- Epic 1 baseline.

Technical risks:
- Link regressions and user confusion during relabeling.

Stories:
1. As a user, I can access Discover from primary nav while legacy Educators links still work.
2. As a user, I can access Communities label while forums routes remain functional.
3. As a user, I can still reach Lesson Builder and Inspiration from secondary navigation after primary-nav changes.

Acceptance criteria:
- Route aliases resolve correctly.
- Existing bookmarks and internal links remain valid.
- Mobile and desktop navigation parity maintained.

Suggested order:
- Second.

Complexity:
- M

Data change:
- No

Migration required:
- Yes (routing labels/aliases)

Security-rule changes:
- No

## Epic 3 - Profile-data extension

Objective:
- Expand profile schema for better discoverability and connection intent.

User value:
- Better matching and clearer professional identity.

Dependencies:
- Epic 1.

Technical risks:
- Backwards compatibility and form complexity.

Stories:
1. As an educator, I can add curriculum, interests, and networking goals so recommendations are more relevant.
2. As an educator, I can set profile visibility and contact preferences so I control exposure.
3. As a returning user, I can continue using my profile even if new fields are missing.

Acceptance criteria:
- New fields optional with defaults.
- Existing profiles remain valid.
- Visibility settings enforced in read/presentation logic.

Suggested order:
- Parallel with Epics 4 and 5.

Complexity:
- L

Data change:
- Yes

Migration required:
- Yes (schema extension)

Security-rule changes:
- Possibly

## Epic 4 - Onboarding

Objective:
- Guide new users through Discover -> Connect -> Network -> Message readiness.

User value:
- Faster time-to-value and clearer next steps.

Dependencies:
- Epics 2 and 3.

Technical risks:
- Funnel drop-offs if prompts are too intrusive.

Stories:
1. As a new user, I can see onboarding milestones after profile save so I know the next networking actions.
2. As a new user, I can receive recommended educators immediately after onboarding.
3. As a user, I can resume onboarding later from dashboard reminders.

Acceptance criteria:
- Milestones track completion states.
- CTA links are valid and role-aware.
- Onboarding state survives sessions.

Suggested order:
- After basic Discover improvements begin.

Complexity:
- M

Data change:
- Yes

Migration required:
- No

Security-rule changes:
- No

## Epic 5 - Discover experience

Objective:
- Evolve educator discovery into networking-first Discover.

User value:
- Better matches and clearer reasons to connect.

Dependencies:
- Epics 2 and 3.

Technical risks:
- Query performance and ranking transparency.

Stories:
1. As an educator, I can see deterministic recommendations with explainable reasons.
2. As an educator, I can filter Discover by core teaching attributes and interests.
3. As an educator, I can initiate Follow or Connect directly from Discover cards.

Acceptance criteria:
- Explainable reason strings are shown.
- Pagination is stable.
- Existing follow behavior remains intact.

Suggested order:
- Before Network and Messaging launches.

Complexity:
- L

Data change:
- Possible

Migration required:
- No

Security-rule changes:
- Possibly

## Epic 6 - Connection system

Objective:
- Add mutual connection lifecycle while preserving follow.

User value:
- Intentional professional relationships.

Dependencies:
- Epics 1, 3, 5.

Technical risks:
- State machine bugs and duplicate requests.

Stories:
1. As an authenticated educator, I can send one pending connection request to another educator so that I can express professional networking intent.
2. As a recipient, I can accept or decline an incoming connection request so I control my network.
3. As a requester, I can cancel my pending request so I can undo accidental sends.
4. As a connected educator, I can remove a connection so I can curate my professional network.
5. As a blocked user target, I cannot receive new requests from users I blocked.

Acceptance criteria:
- Pair uniqueness enforced in transactions.
- Valid state transitions only.
- Notifications fire for request and acceptance.

Suggested order:
- Core phase before messaging.

Complexity:
- XL

Data change:
- Yes

Migration required:
- Yes

Security-rule changes:
- Yes

## Epic 7 - Network page

Objective:
- Launch /network as a first-class relationship workspace.

User value:
- One place to manage connections and requests.

Dependencies:
- Epic 6.

Technical risks:
- Query fan-out and tab-state complexity.

Stories:
1. As an educator, I can view accepted connections in a paginated list.
2. As an educator, I can manage incoming and sent requests from one page.
3. As an educator, I can view suggested educators with reasons and connect actions.
4. As an educator, I can access my Following and Followers from Network without merging data models.

Acceptance criteria:
- Connections, requests, and suggestions each have loading/empty/error states.
- Follow graph links work and remain separate from connections.
- Mobile layout keeps actions reachable.

Suggested order:
- Immediately after core connection APIs.

Complexity:
- L

Data change:
- No (consumes new data)

Migration required:
- No

Security-rule changes:
- No additional if APIs already secured

## Epic 8 - Messaging

Objective:
- Deliver production-ready 1:1 messaging for accepted connections.

User value:
- Direct professional communication.

Dependencies:
- Epics 6 and 7.

Technical risks:
- Abuse, unread consistency, and quota race conditions.

Stories:
1. As a connected educator, I can create or open a unique conversation with another connected educator.
2. As a participant, I can send messages with server-side authorization and quota enforcement.
3. As a participant, I can see unread counts and read state updates across list and thread.
4. As a recipient, I can receive message notifications that link to the correct conversation.
5. As a user, I can report or block from a conversation safety action entry point.

Acceptance criteria:
- Conversation uniqueness via participantSetKey.
- Free tier message limit enforced server-side.
- Read/unread state remains coherent under concurrent usage.

Suggested order:
- After connection and network MVP.

Complexity:
- XL

Data change:
- Yes

Migration required:
- Yes

Security-rule changes:
- Yes

## Epic 9 - Personalized dashboard

Objective:
- Surface relationship-centric actions on Home/dashboard.

User value:
- Better retention and faster next action discovery.

Dependencies:
- Epics 4, 5, 6, 7, 8.

Technical risks:
- Widget sprawl and relevance quality.

Stories:
1. As an educator, I can see pending request and unread message summaries on Home.
2. As an educator, I can see suggested connections and quick actions from dashboard modules.

Acceptance criteria:
- Modules are role/tier aware.
- No regression to feed performance.

Suggested order:
- After Network and Messaging MVP.

Complexity:
- M

Data change:
- No

Migration required:
- No

Security-rule changes:
- No

## Epic 10 - Design system

Objective:
- Prevent duplicate, page-specific implementations for network/messaging UI.

User value:
- Consistent and accessible interactions.

Dependencies:
- Epics 2 and 11.

Technical risks:
- Fragmented component states if delayed.

Stories:
1. As a developer, I can use a shared ConnectionButton across Discover/Profile/Network.
2. As a developer, I can use shared request cards and conversation list items with standard states.
3. As a user, I can rely on consistent loading, empty, and error states across network features.

Acceptance criteria:
- Components documented and reused in at least two surfaces.
- Accessibility checks pass for keyboard and screen-reader essentials.

Suggested order:
- In parallel with Epics 5 to 8.

Complexity:
- M

Data change:
- No

Migration required:
- No

Security-rule changes:
- No

## Epic 11 - Monetization

Objective:
- Add entitlement hooks for free vs plus networking capabilities.

User value:
- Clear value differentiation without breaking core functionality.

Dependencies:
- Epics 6 and 8 for request/message limits.

Technical risks:
- Inconsistent enforcement between UI and server.

Stories:
1. As a free user, I can send up to 5 outgoing connection requests per calendar month.
2. As a free user, I can send up to 10 messages per calendar month.
3. As a plus user, I can send unlimited requests and messages.
4. As a downgraded user, I retain existing history but new sends follow free limits.

Acceptance criteria:
- Enforcement at API level only.
- Counters are transactional and auditable.
- Upgrade prompts appear at decision points.

Suggested order:
- After base connection/messaging APIs are stable.

Complexity:
- L

Data change:
- Yes

Migration required:
- No

Security-rule changes:
- Possibly (if counter writes client-visible)

## Epic 12 - Ecosystem integration

Objective:
- Ensure integrations (Stripe, notifications, account lifecycle) remain coherent with new features.

User value:
- Reliable billing and lifecycle behavior.

Dependencies:
- Epics 1, 8, 11.

Technical risks:
- Tier drift and orphaned data on deletion.

Stories:
1. As a system, I can keep tier in sync across webhook and cancellation flows.
2. As a system, I can clean up or tombstone connection/messaging data during account deletion.
3. As an operator, I can process background cleanup jobs reliably.

Acceptance criteria:
- Deletion policy documented and verified.
- Tier edge cases tested around cancellation timing.

Suggested order:
- Parallel with Epics 8 and 11.

Complexity:
- L

Data change:
- Yes

Migration required:
- Possible

Security-rule changes:
- No

## Epic 13 - Analytics

Objective:
- Instrument Discover -> Connect -> Message funnel.

User value:
- Better product iteration and prioritization.

Dependencies:
- Epics 5 to 8.

Technical risks:
- Event over-collection and privacy concerns.

Stories:
1. As a product team, I can measure connection-request send/accept rates.
2. As a product team, I can measure message activation after accepted connection.
3. As a product team, I can compare retention by network participation.

Acceptance criteria:
- Event taxonomy approved and documented.
- No message body content logged.

Suggested order:
- Start with Epics 6 and 8 rollout.

Complexity:
- M

Data change:
- No

Migration required:
- No

Security-rule changes:
- No

## Epic 14 - QA and security

Objective:
- Introduce test coverage and release safety for networking stack.

User value:
- Fewer regressions and safer launches.

Dependencies:
- Epics 1 through 8.

Technical risks:
- Current lack of test harness increases release risk.

Stories:
1. As a developer, I can run automated integration tests for connection lifecycle states.
2. As a developer, I can run messaging authorization and quota tests.
3. As a release manager, I can verify rollback plans for each phase.

Acceptance criteria:
- Test command exists in package scripts.
- Critical flows covered for auth, state transitions, and quotas.

Suggested order:
- Start in Phase A and expand each phase.

Complexity:
- L

Data change:
- No

Migration required:
- No

Security-rule changes:
- No
