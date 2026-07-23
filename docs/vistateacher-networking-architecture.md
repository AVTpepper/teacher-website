# VistaTeacher 2.0 - Networking and Messaging Architecture

Date: 2026-07-23
Scope: Proposed target architecture grounded in current implementation. No code changes in this phase.

## 1) Relationship Model Recommendation

Options considered:
- A. Replace follow with connection-only.
- B. Keep follow and add connections.
- C. Evolve follow into two-state model.

Recommendation:
- B. Keep follow and add connections.

Rationale:
- Existing follow primitives are production-integrated in discovery cards, profile actions, counters, and notifications.
- Follow remains useful for low-friction content subscription.
- Connection layer introduces explicit professional intent, approvals, and stronger trust for messaging.
- Migration risk is lowest because existing flows remain stable while new network experiences are introduced incrementally.

## 2) Target Information Architecture

Primary nav target:
- Discover
- Network
- Messages
- Communities
- Resources
- Jobs
- Profile/Account

Mapping principles:
- Keep existing route paths initially and add aliases where needed.
- Start with IA relabeling and route aliases before removals.

Route anchors:
- /discover (alias to /educators initially)
- /network (new surface)
- /messages (new)

## 3) Data Architecture

### 3.1 Keep existing collections
- users
- users/{uid}/followers
- users/{uid}/following
- notifications/{uid}/items
- posts, resources, lessons, forums, inspiration, jobs

### 3.2 New collections/subcollections

Connection requests (server-authoritative):
- users/{uid}/connectionRequests/{requestId}

Suggested schema:
- requestId: string
- fromUid: string
- toUid: string
- status: "pending" | "accepted" | "rejected" | "withdrawn" | "expired"
- note: string | null
- createdAt: timestamp
- respondedAt: timestamp | null
- expiresAt: timestamp | null
- source: "discover" | "profile" | "network" | "import"

Materialized accepted connections (query optimized):
- users/{uid}/connections/{otherUid}

Suggested schema:
- uid: string (other participant)
- createdAt: timestamp
- initiatorUid: string
- lastInteractionAt: timestamp | null
- mutualConnectionsCountCached: number

Block/report safety:
- users/{uid}/blocked/{blockedUid}
- moderationReports/{reportId}

Conversation model:
- conversations/{conversationId}

Suggested schema:
- conversationId: string
- participants: string[] (size 2 for phase 1)
- participantSetKey: string (sorted uid pair for uniqueness)
- createdBy: string
- createdAt: timestamp
- lastMessageAt: timestamp
- lastMessagePreview: string
- lastMessageSenderUid: string
- status: "active" | "archived"

Participant state:
- conversations/{conversationId}/participants/{uid}

Suggested schema:
- uid: string
- lastReadMessageId: string | null
- lastReadAt: timestamp | null
- unreadCount: number
- muted: boolean

Messages:
- conversations/{conversationId}/messages/{messageId}

Suggested schema:
- senderUid: string
- body: string
- bodySanitized: string
- createdAt: timestamp
- editedAt: timestamp | null
- deletedAt: timestamp | null
- messageType: "text"
- clientIdempotencyKey: string

Entitlement counters (server-managed):
- usageCounters/{uid}/monthly/{yyyyMM}

Suggested fields:
- messagesSent: number
- connectionRequestsSent: number
- updatedAt: timestamp

## 4) Security and Rules Model

Principles:
- All relationship state transitions are server-authoritative via API routes using Firebase Admin.
- Firestore rules should deny direct client writes to sensitive networking state except where explicitly safe.
- Message creation should be validated server-side for:
  - participant membership
  - block status
  - quota/tier
  - payload size and sanitization

Recommended enforcement points:
- /api/network/requests: validate users, duplicates, blocks, quotas.
- /api/network/connections: validate ownership and remove semantics.
- /api/messages/send: validate conversation membership + rate/quota + anti-spam.
- /api/messages/read: only participant can mutate own read cursor.

Abuse controls:
- Global per-user send rate limits.
- Idempotency keys for message send endpoint.
- Optional shadow bans/moderation flags handled by server.

## 5) Discover Architecture

### Reuse immediately
- Existing educator search by name.
- Existing filters (grade, subject, country).
- Existing follow CTA and follower counters.

### Add for networking relevance
- Ranking layers:
  - Shared subjects overlap score.
  - Grade-level match score.
  - Country/school proximity score (privacy aware).
  - Mutual connections count.
  - Freshness/recency score.
- Recommendation reasons surfaced in UI:
  - "Shares your subject focus"
  - "Teaches same grade band"
  - "Connected to 3 educators you follow"

### Suggested endpoint split
- /api/network/suggestions for ranked recommendations.
- Existing search path remains for deterministic query/filter behavior.

## 6) Network Workspace Architecture

Route:
- /network

Sections:
- Connections (accepted)
- Incoming requests
- Sent requests
- Suggested people
- Activity summary (new followers, new connections, accepted requests)

Data composition:
- Connections list from users/{uid}/connections.
- Requests lists from users/{uid}/connectionRequests with status filters.
- Suggestions from /api/network/suggestions.
- Activity summary from notifications + connection events.

State transitions:
- Send request: pending.
- Accept request: accepted + materialize connection docs for both users + notification.
- Reject/withdraw/expire request: update status and timestamps.
- Remove connection: remove both connection docs and optionally retain audit event.

## 7) Messaging Architecture

Routes:
- /messages
- /messages/[conversationId]

Conversation list (/messages):
- Ordered by lastMessageAt desc.
- Shows participant profile, preview, unread count, timestamp.
- Search by participant displayName.

Conversation thread (/messages/[conversationId]):
- Windowed pagination (newest first anchor + older fetch).
- Real-time listener for latest page.
- Read receipt by updating participant cursor when thread focused.

Real-time strategy:
- Active conversation: subscribe to last N messages and append incrementally.
- Back-scroll: cursor pagination fetches older chunks.
- Conversation list: subscribe to participant conversation metadata only.

Performance considerations:
- Do not open listeners for all message subcollections.
- Keep list-level snapshots small through denormalized preview fields.

Notification integration:
- On send, create notification for recipient if not currently active in same thread.
- Notification linkURL pattern: /messages/{conversationId}

Read state model:
- unreadCount per participant doc for fast list rendering.
- lastReadAt/lastReadMessageId for precise read marker.

Moderation hooks:
- Block checks before send.
- Report action per conversation/message.
- Soft-delete message option for sender (UI level) without removing moderation visibility.

## 8) Free Tier Message Limits (Server-authoritative)

Requirement:
- Enforce monthly send limits for free tier without client trust.

Proposed policy example:
- Free: 50 outbound messages/month
- Plus: higher or unlimited (business decision)

Enforcement flow on /api/messages/send:
1. Authenticate user from ID token.
2. Read users.tier.
3. Compute current month key yyyyMM in UTC.
4. Transaction:
   - read usageCounters/{uid}/monthly/{yyyyMM}
   - reject if free limit reached
   - write message
   - update conversation previews and recipient unread
   - increment messagesSent
5. Return updated quota snapshot.

Why this is required:
- Prevents client tampering and race-condition overruns.
- Keeps billing entitlements aligned with server truth.

## 9) Migration Strategy (Low-risk)

Stepwise sequence:
1. Introduce new collections and server APIs in parallel with existing follow.
2. Launch /network read-only sections seeded from follow and requests.
3. Enable connection requests and accept/reject flows.
4. Launch /messages for connected users first.
5. Add premium quotas and advanced suggestion ranking.
6. Rebalance nav prominence (Discover/Network/Messages) while retaining legacy route compatibility.

Back-compat strategy:
- Keep follow actions and counters during all phases.
- Add route aliases before changing primary URLs.
- Use feature flags for network and messaging rollout.

## 10) Risks and Mitigations

Risk: Duplicate or conflicting relationship state.
- Mitigation: server transactions + unique compound keys (pair key).

Risk: Conversation duplication for same participant pair.
- Mitigation: participantSetKey uniqueness checks in server create endpoint.

Risk: Abuse/spam in messaging.
- Mitigation: quotas, rate limits, block/report, content limits.

Risk: Rules complexity drift.
- Mitigation: keep critical writes API-only and minimize client direct mutation surface.

Risk: Notification overload.
- Mitigation: suppress message notifications when recipient is active in thread; batch digest option later.
