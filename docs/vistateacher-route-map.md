# VistaTeacher 2.0 - Route Map

Date: 2026-07-23
Scope: Existing route inventory and migration decisions. No implementation changes.

## Legend
- Auth: Public, Authenticated, Admin
- Decision:
  - Keep = retain current route and IA placement.
  - Rename in IA = keep route path initially, relabel in navigation/UX.
  - Alias = keep route but add new canonical alias later.
  - New IA Surface = move prominence/entry point in information architecture.
  - Deprecate = reduce visibility and sunset after migration.

## App Routes (Pages)

| Route | Purpose | Auth | Main Components / Behaviors | Data Sources | Primary Actions | Secondary Actions | Decision |
|---|---|---|---|---|---|---|---|
| / | Root entry | Public+Auth aware | Landing page for guests, redirect for authenticated users to /home | Auth context | Start/signup | Sign in, browse landing sections | Keep |
| /auth/login | Email/Google login | Public | Login form, redirect support | Firebase Auth, user profile lookup | Sign in | OAuth login | Keep |
| /auth/signup | Account creation | Public | Signup form and OAuth | Firebase Auth | Create account | OAuth signup | Keep |
| /auth/forgot-password | Password reset | Public | Reset flow | Firebase Auth | Request reset email | Return to login | Keep |
| /home | Main feed | Public for browsing, richer for auth | Feed list, post composer, post filters, linked post pin | posts, users, follows | Create post, interact with feed | Filter posts, load more | New IA Surface |
| /educators | Educator discovery | Public browse, follow needs auth | Search/filter/pagination educator cards | users, follows | Discover educators | Follow/unfollow, open profile | Alias to /discover |
| /educators/[id] | Educator profile detail | Public browse, social actions auth | Profile header, tabs, follow CTA, disabled message button | users, follows, posts/resources/lessons/forums | Follow/unfollow | Browse educator content | Keep |
| /educators/[id]/followers | Followers list | Public | List of followers for profile | users/{id}/followers + user docs | View followers | Navigate to educator profiles | New IA Surface |
| /educators/[id]/following | Following list | Public | List of following users | users/{id}/following + user docs | View following | Navigate profiles | New IA Surface |
| /search | Universal search results | Public | Tabbed results (educators/resources/forums/lessons/jobs) | users/resources/forums/lessons/jobs | Search across content | Open result details | Keep (reposition) |
| /notifications | Full notifications inbox | Authenticated | Read/unread filters, batch mark/delete | notifications/{uid}/items | Manage notifications | Navigate via links | Keep |
| /profile | Own profile entry | Authenticated | Wrapper/redirect to own educator profile | users | View profile | Navigate to edit | Keep |
| /profile/edit | Edit own profile | Authenticated | Profile editor form and save flow | users | Update profile | Upload profile image | Keep |
| /account | Account dashboard | Authenticated | Account home, plan summary, shortcuts | users, auth | Manage account | Navigate to subpages | Keep |
| /account/plans | Plan overview | Authenticated | Tier comparison and upgrade CTA | users.tier | Compare plans | Start upgrade | Keep |
| /account/upgrade | Upgrade checkout host | Authenticated | Embedded/hosted checkout integration page | /api/billing/checkout | Start Stripe checkout | Return to plan | Keep |
| /forums | Forums index/categories | Public | Category list and latest activity | forums collections | Explore communities | Open threads | Rename in IA to Communities |
| /forums/new | Create discussion thread | Authenticated | Thread creation form | forums collections | Publish discussion | Cancel | Keep |
| /forums/[id] | Thread detail | Public read, actions auth | Thread view, comments, upvotes | forums thread/comments/upvotes | Comment/upvote | Follow links to profiles | Keep |
| /resources | Resource library | Public | Search/filter/list resources | resources, users | Discover resources | Save/rate/open detail | Keep |
| /resources/upload | Upload resource | Authenticated | Resource upload form | resources, storage | Publish resource | Save draft-like metadata | Keep |
| /resources/[id] | Resource detail | Public read, actions auth | Resource content + comments/ratings/share/download/save | resources/comments/ratings/bookmarks | Download, save, comment | Rate/share | Keep |
| /lesson-builder | Lesson library/index | Public browse, actions auth | Lesson list and filters | lessons | Discover lessons | Open detail | Keep |
| /lesson-builder/new | Lesson authoring wizard | Authenticated | Multi-step builder, AI assist path, save draft/publish | lessons, /api/ai/lesson | Create lesson | Save draft, AI complete | Keep |
| /lesson-builder/drafts | Draft management | Authenticated | Draft list with edit/delete/AI complete | lessons | Continue draft | Delete draft | Keep |
| /lesson-builder/[id] | Lesson detail | Public read, actions auth | Lesson details, comments, ratings, save/share/download | lessons/comments/ratings/bookmarks | Use/save lesson | Comment/rate/share | Keep |
| /lesson-builder/[id]/preview | Lesson preview | Authenticated (protected) | Printable/preview mode | lessons | Preview lesson | Return/edit | Keep |
| /inspiration | Inspiration feed | Public | Inspiration list and cards | inspiration | Browse inspiration | Open detail | Keep |
| /inspiration/new | Create inspiration item | Authenticated | Create form | inspiration | Publish inspiration | Cancel | Keep |
| /inspiration/[id] | Inspiration detail | Public read, actions auth | Detail + comments/reactions | inspiration/comments | Interact/comment | Share | Keep |
| /jobs | Jobs board | Public | Job listing/search/filter | jobs | Browse jobs | Open job detail | Keep |
| /jobs/new | Post job | Admin | Job posting form | jobs | Publish listing | Cancel | Keep |
| /jobs/[id] | Job detail | Public | Job details and owner close action | jobs | View/apply externally | Admin/owner close | Keep |
| /about | Informational page | Public | Static page | static | Learn platform | Navigate | Keep |
| /contact | Informational/contact | Public | Contact form/info | static | Send inquiry | Navigate | Keep |
| /careers | Informational page | Public | Careers content | static | View opportunities | Navigate | Keep |
| /privacy | Legal page | Public | Privacy policy | static | Read policy | Navigate | Keep |
| /terms | Legal page | Public | Terms | static | Read terms | Navigate | Keep |
| /cookies | Legal page | Public | Cookies info | static | Read cookie policy | Navigate | Keep |

## Missing but Required for VistaTeacher 2.0

| Route | Why Needed | Candidate Auth | Decision |
|---|---|---|---|
| /discover | Networking-first discovery home replacing educators-only framing | Public browse, richer authenticated | New (with /educators alias) |
| /network | Central professional relationship workspace | Authenticated | New |
| /network/requests | Connection request inbox and sent queue | Authenticated | New |
| /messages | Conversation list and entry point | Authenticated | New |
| /messages/[conversationId] | 1:1 conversation thread | Authenticated | New |
| /connections/[id] (optional) | Relationship context/timeline view | Authenticated | Optional new |

## API Route Inventory

| API Route | Purpose | Auth | Core Behavior | Decision |
|---|---|---|---|---|
| /api/account/delete | Queue/delete account path | Authenticated | Validates token, queues deletion job | Keep |
| /api/admin/users | Admin user listing | Admin | List/manage users | Keep |
| /api/admin/users/[uid] | Admin user actions | Admin | Update/delete user | Keep |
| /api/admin/users/[uid]/password-reset | Admin password reset helper | Admin | Initiate reset flow | Keep |
| /api/ai/lesson | AI lesson generation/completion | Authenticated | AI plan assist endpoint | Keep |
| /api/billing/checkout | Stripe checkout session | Authenticated | Create checkout session | Keep |
| /api/billing/portal | Stripe customer portal session | Authenticated | Create portal URL | Keep |
| /api/billing/cancel | Cancel subscription | Authenticated | Cancel sub and sync tier | Keep |
| /api/billing/webhook | Stripe webhook receiver | Stripe signed | Sync customer/subscription/tier | Keep |
| /api/internal/account-deletion/process | Batch deletion processor | Internal secret | Process queued account deletions | Keep |
| /api/monitoring/error | Client error ingestion | Mixed | Receive/report error events | Keep |

## Required New API Surfaces for 2.0

| API Route | Purpose |
|---|---|
| /api/network/requests | Create/list/respond to connection requests |
| /api/network/connections | List/remove connections |
| /api/network/suggestions | Recommendation endpoint with rank reasons |
| /api/messages/conversations | Create/list conversations |
| /api/messages/send | Send message with server-side quota enforcement |
| /api/messages/read | Update read cursor/read receipts |
| /api/network/block | Block/unblock/report operations |

## Middleware/Route Guard Notes

Current guard source:
- proxy.ts checks __session cookie and protects selected prefixes.

Currently protected examples:
- /home, /profile, /admin, /account, /notifications, /forums/new, /resources/upload, /inspiration/new, lesson-builder creation/drafts/preview.

Future guard updates needed:
- Add protection for /network*, /messages*.
- Preserve redirect query behavior for deep links to protected routes.
