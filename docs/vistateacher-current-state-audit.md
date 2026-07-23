# VistaTeacher 2.0 - Current State Audit

Date: 2026-07-23
Scope: Product and architecture audit only. No application behavior changes.

## Method
- Audited all current app routes under app, API routes under app/api, key UI components, data helpers in lib/firestore, auth/session handling, billing handlers, and Firestore/Storage rules.
- Focused on real implemented behavior, not roadmap assumptions.

## Part 1 - Current User Experience Audit

### 1) New visitor flow

Flow:
Landing page -> Sign up or Sign in -> Auth form -> Redirect

Current behavior:
- Visiting / as signed-out user renders landing experience with two main CTAs: Get Started and Sign In.
- Get Started routes to /auth/signup.
- Sign In routes to /auth/login.
- If user is already authenticated and visits /, app redirects to /home or /home?post=... when deep link exists.

Primary CTA:
- Get Started (signup).

Where user is sent next:
- Signup default redirect is /profile/edit.
- Login default redirect is /home unless redirect query exists.
- Google auth checks profile existence and routes to /profile/edit if missing.

Where users can get lost:
- Landing page previews multiple product areas (lessons/resources/forums/inspiration) before clarifying networking-first action.
- No explicit narrative that first success equals making a professional connection.

Return loop signals:
- Public social proof sections and content previews encourage exploration.
- No explicit visitor prompt for find relevant educators now.

Why connect signal quality:
- Present but secondary. Copy emphasizes planning/sharing more than relationship intent.

### 2) New user flow

Flow:
Signup -> Profile edit -> Profile completion -> Discover educators

Current behavior:
- Email signup creates Firebase auth account and sets displayName.
- User is redirected to /profile/edit by default.
- Profile form captures displayName, gradeLevel, subjects, country, school, yearsOfExperience, bio, photo.
- Save creates users/{uid} document if absent, otherwise updates.
- After save, user is redirected to /profile.
- Next discovery step is manual: user must navigate to /educators or use search.

Primary CTA:
- Save profile.

Where user is sent next:
- /profile, not directly to /educators.

Where users can get lost:
- No onboarding checklist that explicitly sequences Discover -> Follow -> Engage.
- No post-profile prompt for recommended educators.

Return loop signals:
- Profile tabs show own content production opportunities.

Why connect signal quality:
- Weak after profile completion. The journey does not strongly transition into people discovery.

### 3) Educator discovery flow

Flow:
Educators page -> Name search / filters -> Pagination -> Profile -> Follow

Current behavior:
- /educators supports:
  - Debounced name search (displayNameLower prefix).
  - Grade Level, Subject, Country filters.
  - Load More pagination.
- Educator cards show avatar, name, verification state, grade level, country, subject badges, follower count.
- Follow/unfollow works from cards with optimistic UI and follower notification.
- Card body navigates to /educators/{id}; follow button does not navigate.

Primary CTA:
- Follow.

Where user is sent next:
- User remains on /educators after follow.
- User can navigate to profile details and follower/following lists.

Where users can get lost:
- No sorting control (for relevance/newness/mutual overlap).
- No recommendation buckets (similar interests/new nearby/etc).
- No next step after follow (for example, invite to message or suggest another relevant person).

Return loop signals:
- Follow graph growth and notifications indirectly drive return.

Why connect signal quality:
- Moderate. Follow action exists, but context for why this educator is relevant is limited.

### 4) Existing user flow

Flow:
Login -> Home -> Search or Educators/Profile -> Follow -> Notifications

Current behavior:
- Login supports email/password, Google OAuth, redirect query parameter.
- /home is post-login anchor with content feed, post creation, filters, and load more.
- Top nav includes search and notification dropdown globally.
- Users can follow from educators list and profile pages.
- Notifications are available via dropdown and full /notifications page with read/unread management.

Primary CTA:
- On home: create post.
- On educators/profile: follow.

Where users can get lost:
- Multiple equally weighted nav items can fragment attention across tools.
- No dedicated network workspace to manage professional relationships.

Return loop signals:
- Notification center is strong for activity awareness.
- Feed and content creation provide repeat use, but network progression is not surfaced as a goal.

Why connect signal quality:
- Inconsistent. Platform supports follow, but primary daily loop can become content-first rather than connection-first.

### 5) Content discovery flow

Flow:
Search -> Resource/Lesson/Forum/Inspiration/Jobs details

Current behavior:
- Universal search at /search and navbar typeahead search educators/resources/discussions/lessons/jobs.
- Results have tabs and route-specific cards.
- Detail pages exist for resources, lessons, forum threads, inspiration items, and jobs.

Primary CTA:
- Open result detail.

Where users can get lost:
- Search does not directly elevate people results as primary professional outcome.
- No explicit people-first recommendation stack across non-people content (for example, users similar to the content author).

Return loop signals:
- High for content consumers, moderate for network building.

Why connect signal quality:
- Low-to-moderate in search context. Content relevance is clearer than relationship relevance.

### 6) Social interaction flow

Flow:
Follow another educator -> Recipient notification -> Profile/content interaction

Current behavior:
- Follow from /educators cards and /educators/{id} profile header.
- New follower notification is generated.
- Recipient can open notification, navigate to follower profile, and interact with posts/resources/lessons/discussions.

Primary CTA:
- Follow.

Where users can get lost:
- Message button on profile is visible but disabled.
- No connection request workflow or relationship state beyond one-way follow.

Return loop signals:
- Notifications for follow, comments, mentions, ratings, downloads, shares.

Why connect signal quality:
- Feature presence is good, relationship depth is missing.

## Fragmentation Summary

Current fragmentation points:
- Relationship actions are spread across educators list, profile, follower/following pages, and notifications with no central network workspace.
- Messaging intent exists in UI (disabled button) but no implemented path.
- Navigation gives equal prominence to content tools and people features, diluting networking-first positioning.

## Part 3 - Current Data Model Audit

### Existing data that supports networking now

User profile and identity:
- users collection includes uid, displayName, displayNameLower, gradeLevel, subjects, country, school, yearsOfExperience, bio, role, tier, followerCount, followingCount.

Relationship graph:
- users/{uid}/followers/{otherUid}
- users/{uid}/following/{otherUid}
- Optional top-level follows collection rule exists for future use.

Social signals:
- notifications/{recipientId}/items stores event feed and linkURL.
- Mention metadata exists on posts and comments via mentionedUsers arrays.

Discovery metadata:
- displayNameLower, gradeLevel, subjects, country support current search/filter behavior.

Subscription and entitlement basis:
- users document stores tier and Stripe linkage fields.

### Missing data for networking 2.0

Missing for connection system:
- No connection request status model (pending/accepted/rejected/withdrawn/blocked).
- No relationship context fields (reason to connect, shared interests snapshot, mutual count cache).
- No relationship timestamps beyond follow followedAt.

Missing for messaging:
- No conversation model.
- No message model.
- No participant read cursors.
- No server-side monthly message counter collection.

Missing for advanced discovery:
- No relevance vectors or recommendation features.
- No explicit profile interests beyond subjects/grade/country/school.
- No profile completeness score and onboarding milestones.

Missing for privacy controls:
- No user-level privacy settings object for discoverability, connection permissions, messaging permissions, or contact visibility preferences.

### Data that should remain unchanged

Keep unchanged:
- users core identity and teaching fields.
- existing follow subcollection paths for backward compatibility.
- notifications model and read/dismiss behavior.
- posts/resources/lessons/forums/jobs content schemas.
- tier and role fields in users.

### Data that should be renamed or clarified

Recommended semantic changes (with migration aliases):
- Educators label -> Discover in IA (route alias first).
- Forums label -> Communities in primary nav while retaining /forums route.
- Consider relation terminology:
  - follow edges remain technical primitive.
  - introduce explicit connection records for professional relationship state.

### Follow vs Connection analysis

One-way follow implications:
- Technical: simple, low-friction writes, no approval path, scales well.
- UX: good for content subscriptions, weak for intentional professional relationships.

Mutual connection implications:
- Technical: requires durable state transitions and anti-race semantics.
- UX: stronger trust signal and clearer network meaning.

Connection request implications:
- Technical: request records, acceptance workflow, expiration/withdrawal/blocking logic.
- UX: adds intent and context, potentially lower acceptance if over-frictioned.

Accepted connection implications:
- Technical: materialized bi-directional edge or accepted state query.
- UX: enables first-class Network and message permissions.

Connection removal implications:
- Technical: state transition to removed, optional audit trail.
- UX: gives user control, avoids hard-deleting relationship history where moderation may need events.

Recommendation:
- B. Keep follows and add connections.

Why B is safest in this codebase:
- Follow is deeply integrated in discovery/profile counters and notifications.
- Replacing follow outright would create broad regressions and costly migration risk.
- Adding a connection layer lets VistaTeacher preserve content-follow dynamics while introducing professional, consent-based networking and messaging permissions.

## Part 4 - Current Educator Discovery Audit

### Current capability snapshot

Search capabilities:
- Name prefix search on displayNameLower with 400ms debounce.

Filters:
- gradeLevel exact match.
- subject array-contains.
- country client-side exact normalized match.

Sorting:
- No user-facing sort controls.
- Default backend order by createdAt desc in non-name path.

Pagination:
- Load More with Firestore cursor.
- Name query path returns first PAGE_SIZE and no cursor continuation.

Profile cards:
- Identity: avatar, displayName, verified marker, self badge.
- Professional hints: grade level, country, top subjects.
- Social metric: follower count.
- CTA: Follow/Following.

Follow behavior:
- Optimistic follow/unfollow with counter update and rollback on error.
- notifyNewFollower on new follow.

Empty states:
- No educators found with filter-sensitive messaging.

Loading states:
- Spinner on initial and incremental load.

Error states:
- Query errors logged; UI falls back to empty results, no explicit error banner.

Mobile behavior:
- Responsive card grid.
- Works with top nav mobile drawer.

### Gap vs desired DISCOVER -> PROFILE -> CONNECT -> MESSAGE

Implemented today:
- DISCOVER: yes.
- PROFILE: yes.
- CONNECT: partially (follow only).
- MESSAGE: no (CTA disabled on profile, no route/data model).

What must change:
- Add people relevance ranking and recommendation sections.
- Add connection workflow distinct from follow.
- Enable messaging pathway after accepted connection (or defined policy).
- Add stronger context to explain why connect.

### Proposed future structure for /discover

Sections that can be supported now:
- Search and filters (existing).
- Recommended for You (requires recommendation scoring logic; can bootstrap from shared gradeLevel/subjects/country).
- Similar Interests (can derive from subject overlap and grade level match).
- New to VistaTeacher (can use users.createdAt sorting).

Sections requiring new data:
- People Near You (requires normalized location fields and user privacy opt-in).
- Strong recommendation quality (requires interaction history weights and possibly cached recommendation edges).

## Part 5 - Profile Audit

### Current profile implementation

Header and identity:
- Avatar, name, verification badge, plus badge.
- grade level, school, country, yearsOfExperience metadata.
- Subjects badges.
- follower/following counts with linked lists.

Professional narrative:
- Bio supported.
- No explicit professional title or headline field.
- No curriculum/interests field beyond subjects.

Content proof:
- Tabs for posts, resources shared, lessons created, discussions.
- Badge achievements panel and progress route.

Relationship actions:
- Follow/Following CTA.
- Message button rendered but disabled.

Can current profile answer these questions?
- Who is this person? Partially yes.
- What do they do? Partially yes through content tabs and teaching metadata.
- What do we have in common? Weakly via shared subjects/grade only, not explicitly surfaced.
- Why should I connect with them? Weak. No explicit connect rationale or collaboration intent summary.

### Proposed future profile IA (no implementation)

Primary blocks:
- Professional identity card (name, headline/title, institution, location privacy-aware).
- Teaching focus (grades, subjects, curriculum/interests).
- Collaboration intent (who they want to meet, topics open to collaborate on).
- Shared context module (mutual connections, overlap signals).
- Activity and contributions (existing tabs).
- Network actions (Connect, Follow, Message based on relationship policy).

## Part 8 - Billing and Premium Audit

### Existing Stripe implementation

Checkout flow:
- Client requests /api/billing/checkout with ID token.
- Server ensures authenticated user and profile exists.
- Creates/reuses Stripe customer.
- Creates subscription checkout session (hosted or embedded mode).

Customer creation:
- On first checkout when stripeCustomerId missing.
- Customer metadata stores firebaseUid.

Subscription lifecycle:
- Webhook handles checkout.session.completed and customer.subscription.* events.
- Syncs users tier and Stripe subscription status fields.

Customer portal:
- /api/billing/portal creates Stripe billing portal session for known stripeCustomerId.

Cancellation:
- /api/billing/cancel cancels active subscription, syncs tier to free and status fields.

Tier logic:
- users.tier set to plus when subscription status in active/trialing/past_due.
- Downgrade to free otherwise.

Current premium feature gating status:
- Some UI and AI behavior references tier.
- Networking-related premium gates (connection/message quotas, advanced network search) do not yet exist.

Safest existing location for future gating:
- Server API boundaries that perform privileged actions:
  - future connection request creation endpoint
  - future message send endpoint
  - future advanced discover/search endpoints
- Tier source of truth should remain users.tier synchronized by webhook.

Feature availability against target model:

Already exists:
- Professional profile
- Basic educator discovery
- Basic search
- Communities/forums
- Resources
- Jobs

Not yet implemented:
- Connection request quotas
- Dedicated messaging and message quotas
- Advanced educator search/filter tiering
- Personalized recommendations
- Profile viewer insights
- Saved educator profiles
- Enhanced profile features set
- Contact information request workflow

## Part 10 - Product Gap Analysis

| Product Area | Current State | Reusable | Needs Redesign | Needs New Build | Priority |
|---|---|---|---|---|---|
| Homepage | Content feed + post creation | Yes | Partial | No | High |
| Onboarding | Signup -> profile edit exists | Yes | Yes | Partial | High |
| Profiles | Strong base identity + content tabs | Yes | Yes | Partial | High |
| Educator discovery | Search/filters/pagination/follow | Yes | Yes | Partial | High |
| Search | Global and tabbed content search | Yes | Yes | No | Medium |
| Follow system | One-way graph + counters + notifications | Yes | Yes | No | High |
| Connection system | Not implemented | No | N/A | Yes | Critical |
| Network | No first-class surface | Partial | N/A | Yes | Critical |
| Messaging | No direct messaging | No | N/A | Yes | Critical |
| Notifications | Real-time + full inbox | Yes | Partial | No | Medium |
| Communities | Forums implemented | Yes | IA relabeling | No | Medium |
| Forums | Category/thread/comment flows live | Yes | Partial | No | Medium |
| Resources | Library + detail + interactions live | Yes | Partial | No | Medium |
| Lesson Builder | Robust creation and AI assist flows | Yes | IA positioning | No | Medium |
| Inspiration | Feed + detail + comments live | Yes | IA positioning | No | Low |
| Jobs | Board + detail + admin posting live | Yes | Partial | No | Medium |
| Billing | Checkout/webhook/portal/cancel live | Yes | Partial | No | High |
| Premium model | Tier data exists, limited gating | Partial | Yes | Yes | High |
| Privacy | Baseline profile/privacy rules exist | Yes | Yes | Partial | High |
| Mobile UX | Responsive patterns broadly present | Yes | Partial | No | Medium |

## Highest-risk technical findings
- Account deletion is split between client-side direct deletion in account page and server-side queued deletion APIs, creating inconsistent deletion paths.
- No dedicated connections/messages data model means networking core loop cannot complete.
- Firestore rules allow broad public reads for user profiles and lessons; privacy granularity is limited.
- No explicit CSP/HSTS/frame headers configured in Next config.
- Discovery relevance is mostly filter/search based, not recommendation driven.
