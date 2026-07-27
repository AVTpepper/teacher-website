# VistaTeacher Master QA Checklist (Desktop + Mobile)

Use this file as the single source of truth for QA.
For each line item:
- Check both Desktop and Mobile.
- Add comments directly on the same line after `Comment:`.
- If a test is not applicable, write `N/A` in Comment.

Suggested device matrix:
- Desktop: 1366x768 (or 1440x900), Chrome + one secondary browser
- Mobile: iPhone 12/13 width (390), Android width (360)

Suggested test accounts/data:
- Account A: normal user with content
- Account B: normal user with minimal content
- Account C: admin user
- Account D: new user with incomplete onboarding

---

## 1) Global Shell, Navigation, and Layout

- [ ] GLB-001 Desktop | [ ] GLB-001 Mobile | Landing shell loads without console/runtime errors. | Comment:
- [ ] GLB-002 Desktop | [ ] GLB-002 Mobile | Primary nav appears and all labels are readable. | Comment:
- [ ] GLB-003 Desktop | [ ] GLB-003 Mobile | Logo click returns to home/landing expected route. | Comment:
- [ ] GLB-004 Desktop | [ ] GLB-004 Mobile | Page does not horizontally overflow at initial load. | Comment:
- [ ] GLB-005 Desktop | [ ] GLB-005 Mobile | Footer renders correctly and links are clickable. | Comment:
- [ ] GLB-006 Desktop | [ ] GLB-006 Mobile | Sticky header behavior is stable while scrolling. | Comment:
- [ ] GLB-007 Desktop | [ ] GLB-007 Mobile | Back button behavior is logical from key pages. | Comment:
- [ ] GLB-008 Desktop | [ ] GLB-008 Mobile | Forward button behavior is logical from key pages. | Comment:
- [ ] GLB-009 Desktop | [ ] GLB-009 Mobile | Browser refresh on dynamic routes does not crash. | Comment:
- [ ] GLB-010 Desktop | [ ] GLB-010 Mobile | 404 route shows a usable not-found state. | Comment:

- [ ] NAV-001 Desktop | [ ] NAV-001 Mobile | Open and close mobile menu from every main shell route. | Comment:
- [ ] NAV-002 Desktop | [ ] NAV-002 Mobile | Active nav state highlights correct current section. | Comment:
- [ ] NAV-003 Desktop | [ ] NAV-003 Mobile | All top-level nav links route correctly. | Comment:
- [ ] NAV-004 Desktop | [ ] NAV-004 Mobile | Authenticated nav utilities (notifications/profile) appear only when signed in. | Comment:
- [ ] NAV-005 Desktop | [ ] NAV-005 Mobile | Signed-out nav hides auth-only utilities. | Comment:
- [ ] NAV-006 Desktop | [ ] NAV-006 Mobile | Navbar controls are keyboard reachable (Tab/Enter/Space). | Comment:
- [ ] NAV-007 Desktop | [ ] NAV-007 Mobile | No clipped text in navbar at narrow widths. | Comment:
- [ ] NAV-008 Desktop | [ ] NAV-008 Mobile | Dropdown menus close on outside click and Escape. | Comment:
- [ ] NAV-009 Desktop | [ ] NAV-009 Mobile | Dropdown menu action routing is correct. | Comment:
- [ ] NAV-010 Desktop | [ ] NAV-010 Mobile | Sign out action clears auth state and routes correctly. | Comment:

- [ ] PERF-001 Desktop | [ ] PERF-001 Mobile | First contentful paint feels reasonable on landing. | Comment:
- [ ] PERF-002 Desktop | [ ] PERF-002 Mobile | Route transitions avoid long blank/flash states. | Comment:
- [ ] PERF-003 Desktop | [ ] PERF-003 Mobile | Loading skeletons appear where expected. | Comment:
- [ ] PERF-004 Desktop | [ ] PERF-004 Mobile | No infinite spinners on any tested route. | Comment:
- [ ] PERF-005 Desktop | [ ] PERF-005 Mobile | Retry flows recover from recoverable errors. | Comment:

---

## 2) Public Trust and Marketing Pages

Routes: /about, /blog, /careers, /contact, /cookies, /privacy, /terms, /pricing, /pricing/success

- [ ] PUB-001 Desktop | [ ] PUB-001 Mobile | /about loads and all sections are readable. | Comment:
- [ ] PUB-002 Desktop | [ ] PUB-002 Mobile | /blog loads and card/list interactions work. | Comment:
- [ ] PUB-003 Desktop | [ ] PUB-003 Mobile | /careers loads and CTA links work. | Comment:
- [ ] PUB-004 Desktop | [ ] PUB-004 Mobile | /contact loads and contact interaction works. | Comment:
- [ ] PUB-005 Desktop | [ ] PUB-005 Mobile | /cookies legal text is readable and complete. | Comment:
- [ ] PUB-006 Desktop | [ ] PUB-006 Mobile | /privacy legal text is readable and complete. | Comment:
- [ ] PUB-007 Desktop | [ ] PUB-007 Mobile | /terms legal text is readable and complete. | Comment:
- [ ] PUB-008 Desktop | [ ] PUB-008 Mobile | /pricing plan cards and CTAs render correctly. | Comment:
- [ ] PUB-009 Desktop | [ ] PUB-009 Mobile | /pricing/success state loads correctly after checkout return. | Comment:
- [ ] PUB-010 Desktop | [ ] PUB-010 Mobile | Trust pages do not expose auth-only controls by mistake. | Comment:

- [ ] PUB-011 Desktop | [ ] PUB-011 Mobile | Link integrity on each trust page (all links clickable, no dead links). | Comment:
- [ ] PUB-012 Desktop | [ ] PUB-012 Mobile | Typography contrast passes quick visual check on trust pages. | Comment:
- [ ] PUB-013 Desktop | [ ] PUB-013 Mobile | Images/illustrations scale correctly without distortion. | Comment:
- [ ] PUB-014 Desktop | [ ] PUB-014 Mobile | No layout jump when fonts finish loading. | Comment:
- [ ] PUB-015 Desktop | [ ] PUB-015 Mobile | CTA button focus/hover/active states are visible. | Comment:

---

## 3) Auth and Session Flows

Routes: /auth/login, /auth/signup, /auth/action

- [ ] AUTH-001 Desktop | [ ] AUTH-001 Mobile | /auth/login loads without flashing wrong state. | Comment:
- [ ] AUTH-002 Desktop | [ ] AUTH-002 Mobile | /auth/signup loads without flashing wrong state. | Comment:
- [ ] AUTH-003 Desktop | [ ] AUTH-003 Mobile | Login email/password success flow routes correctly. | Comment:
- [ ] AUTH-004 Desktop | [ ] AUTH-004 Mobile | Login invalid credentials shows clear error message. | Comment:
- [ ] AUTH-005 Desktop | [ ] AUTH-005 Mobile | Signup validation blocks bad input and shows field errors. | Comment:
- [ ] AUTH-006 Desktop | [ ] AUTH-006 Mobile | Signup success routes to expected onboarding/profile path. | Comment:
- [ ] AUTH-007 Desktop | [ ] AUTH-007 Mobile | OAuth sign-in works and returns to expected route. | Comment:
- [ ] AUTH-008 Desktop | [ ] AUTH-008 Mobile | Redirect query param after auth is honored. | Comment:
- [ ] AUTH-009 Desktop | [ ] AUTH-009 Mobile | Authenticated user opening auth pages gets redirected correctly. | Comment:
- [ ] AUTH-010 Desktop | [ ] AUTH-010 Mobile | Session expiry messaging is clear and actionable. | Comment:

- [ ] AUTH-011 Desktop | [ ] AUTH-011 Mobile | Sign out immediately restricts auth-only pages. | Comment:
- [ ] AUTH-012 Desktop | [ ] AUTH-012 Mobile | Refresh after sign in remains signed in correctly. | Comment:
- [ ] AUTH-013 Desktop | [ ] AUTH-013 Mobile | Refresh after sign out remains signed out correctly. | Comment:
- [ ] AUTH-014 Desktop | [ ] AUTH-014 Mobile | Protected route redirect loops do not occur. | Comment:
- [ ] AUTH-015 Desktop | [ ] AUTH-015 Mobile | Multiple tabs keep auth state in sync. | Comment:

---

## 4) Landing and Home Dashboard

Routes: /, /home

- [ ] HOME-001 Desktop | [ ] HOME-001 Mobile | / landing page loads with all primary sections. | Comment:
- [ ] HOME-002 Desktop | [ ] HOME-002 Mobile | Landing primary CTAs route to intended destinations. | Comment:
- [ ] HOME-003 Desktop | [ ] HOME-003 Mobile | Guest vs auth landing behavior is correct. | Comment:
- [ ] HOME-004 Desktop | [ ] HOME-004 Mobile | Feature cards/widgets on landing load without broken content. | Comment:
- [ ] HOME-005 Desktop | [ ] HOME-005 Mobile | Landing scroll performance remains smooth. | Comment:

- [ ] DASH-001 Desktop | [ ] DASH-001 Mobile | /home private dashboard loads without long blank state. | Comment:
- [ ] DASH-002 Desktop | [ ] DASH-002 Mobile | Dashboard hero section renders correctly. | Comment:
- [ ] DASH-003 Desktop | [ ] DASH-003 Mobile | Attention module renders accurate counts. | Comment:
- [ ] DASH-004 Desktop | [ ] DASH-004 Mobile | Activation tasks render and links route correctly. | Comment:
- [ ] DASH-005 Desktop | [ ] DASH-005 Mobile | Recommendations module loads and cards are interactive. | Comment:
- [ ] DASH-006 Desktop | [ ] DASH-006 Mobile | Conversations summary module loads and links open messages. | Comment:
- [ ] DASH-007 Desktop | [ ] DASH-007 Mobile | Network summary module loads and links open network tabs. | Comment:
- [ ] DASH-008 Desktop | [ ] DASH-008 Mobile | Community/resources/jobs modules load and route correctly. | Comment:
- [ ] DASH-009 Desktop | [ ] DASH-009 Mobile | Profile completion CTA is shown only when needed. | Comment:
- [ ] DASH-010 Desktop | [ ] DASH-010 Mobile | Quick actions all route correctly. | Comment:

- [ ] DASH-011 Desktop | [ ] DASH-011 Mobile | Follow/unfollow in recommendation cards works and updates UI. | Comment:
- [ ] DASH-012 Desktop | [ ] DASH-012 Mobile | Connection actions from dashboard work and show correct states. | Comment:
- [ ] DASH-013 Desktop | [ ] DASH-013 Mobile | Dashboard error states are readable and recoverable. | Comment:
- [ ] DASH-014 Desktop | [ ] DASH-014 Mobile | Dashboard does not require manual refresh to show core data. | Comment:
- [ ] DASH-015 Desktop | [ ] DASH-015 Mobile | Dashboard module ordering/visibility is coherent per user type. | Comment:

---

## 5) Discover and Educators

Routes: /discover, /educators, /explore-educators, /educators/[id], /educators/[id]/followers, /educators/[id]/following, /educators/[id]/achievements

- [ ] EDU-001 Desktop | [ ] EDU-001 Mobile | /discover loads with filters and educator results. | Comment:
- [ ] EDU-002 Desktop | [ ] EDU-002 Mobile | /educators alias route behavior is correct. | Comment:
- [ ] EDU-003 Desktop | [ ] EDU-003 Mobile | /explore-educators guest access behavior is correct. | Comment:
- [ ] EDU-004 Desktop | [ ] EDU-004 Mobile | Filter by grade/subject/role updates results correctly. | Comment:
- [ ] EDU-005 Desktop | [ ] EDU-005 Mobile | Search query updates result list correctly. | Comment:
- [ ] EDU-006 Desktop | [ ] EDU-006 Mobile | Clear/reset filters restores expected result set. | Comment:
- [ ] EDU-007 Desktop | [ ] EDU-007 Mobile | Pagination/load-more works without duplicate cards. | Comment:
- [ ] EDU-008 Desktop | [ ] EDU-008 Mobile | Educator card actions are visible and clickable. | Comment:
- [ ] EDU-009 Desktop | [ ] EDU-009 Mobile | Card avatar fallback and badges render correctly. | Comment:
- [ ] EDU-010 Desktop | [ ] EDU-010 Mobile | Clicking educator card opens correct profile. | Comment:

- [ ] EDU-011 Desktop | [ ] EDU-011 Mobile | /educators/[id] profile header data is accurate. | Comment:
- [ ] EDU-012 Desktop | [ ] EDU-012 Mobile | Tabs switch correctly: overview/posts/resources/lessons/discussions. | Comment:
- [ ] EDU-013 Desktop | [ ] EDU-013 Mobile | Follow button toggles correctly and updates counts. | Comment:
- [ ] EDU-014 Desktop | [ ] EDU-014 Mobile | Message/connection CTA states are correct by relationship state. | Comment:
- [ ] EDU-015 Desktop | [ ] EDU-015 Mobile | Share profile action works. | Comment:
- [ ] EDU-016 Desktop | [ ] EDU-016 Mobile | Profile completion prompt visibility is correct for owner. | Comment:
- [ ] EDU-017 Desktop | [ ] EDU-017 Mobile | Achievements preview and link to full achievements page works. | Comment:
- [ ] EDU-018 Desktop | [ ] EDU-018 Mobile | Missing profile state is handled gracefully. | Comment:
- [ ] EDU-019 Desktop | [ ] EDU-019 Mobile | Follower/following counts match list lengths (spot check). | Comment:
- [ ] EDU-020 Desktop | [ ] EDU-020 Mobile | Guest restrictions/prompts on sensitive profile fields are correct. | Comment:

- [ ] EDU-021 Desktop | [ ] EDU-021 Mobile | Followers modal/list opens reliably. | Comment:
- [ ] EDU-022 Desktop | [ ] EDU-022 Mobile | Following modal/list opens reliably. | Comment:
- [ ] EDU-023 Desktop | [ ] EDU-023 Mobile | Followers/following list rows navigate to selected profile. | Comment:
- [ ] EDU-024 Desktop | [ ] EDU-024 Mobile | Follow/unfollow actions inside follow lists work. | Comment:
- [ ] EDU-025 Desktop | [ ] EDU-025 Mobile | Deep link /educators/[id]?list=followers works. | Comment:
- [ ] EDU-026 Desktop | [ ] EDU-026 Mobile | Deep link /educators/[id]?list=following works. | Comment:
- [ ] EDU-027 Desktop | [ ] EDU-027 Mobile | /educators/[id]/followers page route renders correctly. | Comment:
- [ ] EDU-028 Desktop | [ ] EDU-028 Mobile | /educators/[id]/following page route renders correctly. | Comment:
- [ ] EDU-029 Desktop | [ ] EDU-029 Mobile | /educators/[id]/achievements loads and displays correctly. | Comment:
- [ ] EDU-030 Desktop | [ ] EDU-030 Mobile | Mobile long names/headlines truncate gracefully. | Comment:

---

## 6) Feed

Route: /feed

- [ ] FEED-001 Desktop | [ ] FEED-001 Mobile | Feed page loads with expected post list. | Comment:
- [ ] FEED-002 Desktop | [ ] FEED-002 Mobile | Composer loads for signed-in users only. | Comment:
- [ ] FEED-003 Desktop | [ ] FEED-003 Mobile | Composer validations work (required fields, limits). | Comment:
- [ ] FEED-004 Desktop | [ ] FEED-004 Mobile | Create post success inserts post without full refresh. | Comment:
- [ ] FEED-005 Desktop | [ ] FEED-005 Mobile | Edit post flow works for owner. | Comment:
- [ ] FEED-006 Desktop | [ ] FEED-006 Mobile | Delete post flow works for owner. | Comment:
- [ ] FEED-007 Desktop | [ ] FEED-007 Mobile | Like/unlike toggles and count updates are correct. | Comment:
- [ ] FEED-008 Desktop | [ ] FEED-008 Mobile | Comment add/edit/delete flows work. | Comment:
- [ ] FEED-009 Desktop | [ ] FEED-009 Mobile | Mention/link parsing in content works as expected. | Comment:
- [ ] FEED-010 Desktop | [ ] FEED-010 Mobile | Feed pagination/infinite load works without duplicates. | Comment:

---

## 7) Forums

Routes: /forums, /forums/new, /forums/[id]

- [ ] FOR-001 Desktop | [ ] FOR-001 Mobile | /forums category/index page loads with expected categories. | Comment:
- [ ] FOR-002 Desktop | [ ] FOR-002 Mobile | Category cards open expected views/threads. | Comment:
- [ ] FOR-003 Desktop | [ ] FOR-003 Mobile | New discussion CTA enforces auth correctly. | Comment:
- [ ] FOR-004 Desktop | [ ] FOR-004 Mobile | /forums/new form validation works (title/content/etc). | Comment:
- [ ] FOR-005 Desktop | [ ] FOR-005 Mobile | Create thread success routes to new thread detail. | Comment:
- [ ] FOR-006 Desktop | [ ] FOR-006 Mobile | /forums/[id] thread loads with author and metadata. | Comment:
- [ ] FOR-007 Desktop | [ ] FOR-007 Mobile | Upvote/downvote interactions work and persist. | Comment:
- [ ] FOR-008 Desktop | [ ] FOR-008 Mobile | Reply/comment/reply-to-reply interactions work. | Comment:
- [ ] FOR-009 Desktop | [ ] FOR-009 Mobile | Thread sharing and permalink behavior works. | Comment:
- [ ] FOR-010 Desktop | [ ] FOR-010 Mobile | Missing thread route shows proper not-found state. | Comment:

---

## 8) Resources Library

Routes: /resources, /resources/upload, /resources/[id]

- [ ] RES-001 Desktop | [ ] RES-001 Mobile | /resources initial list load works. | Comment:
- [ ] RES-002 Desktop | [ ] RES-002 Mobile | Grade filter works. | Comment:
- [ ] RES-003 Desktop | [ ] RES-003 Mobile | Subject filter works. | Comment:
- [ ] RES-004 Desktop | [ ] RES-004 Mobile | Type filter works. | Comment:
- [ ] RES-005 Desktop | [ ] RES-005 Mobile | Sort options (newest/oldest/rating/downloads/bookmarks) work. | Comment:
- [ ] RES-006 Desktop | [ ] RES-006 Mobile | Search query filters as expected. | Comment:
- [ ] RES-007 Desktop | [ ] RES-007 Mobile | Combined filter + search + sort stays stable. | Comment:
- [ ] RES-008 Desktop | [ ] RES-008 Mobile | Resource cards render metadata and actions correctly. | Comment:
- [ ] RES-009 Desktop | [ ] RES-009 Mobile | Lesson/resource mixed display behaves correctly when type filters change. | Comment:
- [ ] RES-010 Desktop | [ ] RES-010 Mobile | Empty state appears correctly when no matches. | Comment:

- [ ] RES-011 Desktop | [ ] RES-011 Mobile | /resources/upload enforces auth correctly. | Comment:
- [ ] RES-012 Desktop | [ ] RES-012 Mobile | Upload form field validation is correct. | Comment:
- [ ] RES-013 Desktop | [ ] RES-013 Mobile | File attach control works (valid type/size). | Comment:
- [ ] RES-014 Desktop | [ ] RES-014 Mobile | Suggested tags interactions work. | Comment:
- [ ] RES-015 Desktop | [ ] RES-015 Mobile | Upload submit success creates resource and routes correctly. | Comment:
- [ ] RES-016 Desktop | [ ] RES-016 Mobile | Upload failure path shows actionable error. | Comment:

- [ ] RES-017 Desktop | [ ] RES-017 Mobile | /resources/[id] detail loads all metadata correctly. | Comment:
- [ ] RES-018 Desktop | [ ] RES-018 Mobile | Download action works and count updates. | Comment:
- [ ] RES-019 Desktop | [ ] RES-019 Mobile | Save/bookmark action works and persists. | Comment:
- [ ] RES-020 Desktop | [ ] RES-020 Mobile | Rating action works and aggregates update. | Comment:
- [ ] RES-021 Desktop | [ ] RES-021 Mobile | Comment thread on resource works fully. | Comment:
- [ ] RES-022 Desktop | [ ] RES-022 Mobile | Related resources block renders relevant items. | Comment:
- [ ] RES-023 Desktop | [ ] RES-023 Mobile | Share action works. | Comment:
- [ ] RES-024 Desktop | [ ] RES-024 Mobile | Missing resource route handled gracefully. | Comment:

---

## 9) Lesson Builder and Lesson Detail

Routes: /lesson-builder, /lesson-builder/new, /lesson-builder/drafts, /lesson-builder/[id], /lesson-builder/[id]/preview

- [ ] LES-001 Desktop | [ ] LES-001 Mobile | /lesson-builder list/index loads correctly. | Comment:
- [ ] LES-002 Desktop | [ ] LES-002 Mobile | Filters (grade/subject/sort/modification) work correctly. | Comment:
- [ ] LES-003 Desktop | [ ] LES-003 Mobile | My lessons tabs (drafts/published/bookmarked) load correctly. | Comment:
- [ ] LES-004 Desktop | [ ] LES-004 Mobile | Drafts expand/collapse behavior works. | Comment:
- [ ] LES-005 Desktop | [ ] LES-005 Mobile | Published expand/collapse behavior works. | Comment:
- [ ] LES-006 Desktop | [ ] LES-006 Mobile | Bookmarked expand/collapse behavior works. | Comment:
- [ ] LES-007 Desktop | [ ] LES-007 Mobile | Card actions from list route correctly. | Comment:
- [ ] LES-008 Desktop | [ ] LES-008 Mobile | Auth prompts/guards for create/edit paths are correct. | Comment:

- [ ] LES-009 Desktop | [ ] LES-009 Mobile | /lesson-builder/new wizard opens and step navigation works. | Comment:
- [ ] LES-010 Desktop | [ ] LES-010 Mobile | Basic info step validation works. | Comment:
- [ ] LES-011 Desktop | [ ] LES-011 Mobile | Objectives add/edit/remove works. | Comment:
- [ ] LES-012 Desktop | [ ] LES-012 Mobile | Materials add/edit/remove works. | Comment:
- [ ] LES-013 Desktop | [ ] LES-013 Mobile | Lesson steps add/edit/remove works. | Comment:
- [ ] LES-014 Desktop | [ ] LES-014 Mobile | Step reorder up/down works correctly. | Comment:
- [ ] LES-015 Desktop | [ ] LES-015 Mobile | Assessments section behavior is correct. | Comment:
- [ ] LES-016 Desktop | [ ] LES-016 Mobile | Check-for-understanding section behavior is correct. | Comment:
- [ ] LES-017 Desktop | [ ] LES-017 Mobile | AI generate/refine interactions work (if available). | Comment:
- [ ] LES-018 Desktop | [ ] LES-018 Mobile | Save draft works and draft appears in drafts surfaces. | Comment:
- [ ] LES-019 Desktop | [ ] LES-019 Mobile | Publish works and lesson appears in public list if expected. | Comment:
- [ ] LES-020 Desktop | [ ] LES-020 Mobile | Cancel/back from wizard behaves safely (no data loss surprises). | Comment:

- [ ] LES-021 Desktop | [ ] LES-021 Mobile | /lesson-builder/drafts page lists expected drafts. | Comment:
- [ ] LES-022 Desktop | [ ] LES-022 Mobile | Draft open/edit actions route correctly. | Comment:
- [ ] LES-023 Desktop | [ ] LES-023 Mobile | Draft delete action works with confirmation. | Comment:

- [ ] LES-024 Desktop | [ ] LES-024 Mobile | /lesson-builder/[id] detail loads without error. | Comment:
- [ ] LES-025 Desktop | [ ] LES-025 Mobile | Lesson metadata, tags, author block show correctly. | Comment:
- [ ] LES-026 Desktop | [ ] LES-026 Mobile | Comments section works fully on lesson detail. | Comment:
- [ ] LES-027 Desktop | [ ] LES-027 Mobile | Rating controls work and aggregate updates. | Comment:
- [ ] LES-028 Desktop | [ ] LES-028 Mobile | Download lesson action works and count updates. | Comment:
- [ ] LES-029 Desktop | [ ] LES-029 Mobile | Remix action creates expected prefilled draft/new flow. | Comment:
- [ ] LES-030 Desktop | [ ] LES-030 Mobile | Edit action for owner opens correct edit experience. | Comment:
- [ ] LES-031 Desktop | [ ] LES-031 Mobile | Share action works correctly. | Comment:
- [ ] LES-032 Desktop | [ ] LES-032 Mobile | Not-found lesson route shows proper fallback. | Comment:

- [ ] LES-033 Desktop | [ ] LES-033 Mobile | In-page preview modal opens from lesson detail. | Comment:
- [ ] LES-034 Desktop | [ ] LES-034 Mobile | Preview modal close, escape, focus trap works. | Comment:
- [ ] LES-035 Desktop | [ ] LES-035 Mobile | Preview modal visual style has no tint/contrast issue. | Comment:
- [ ] LES-036 Desktop | [ ] LES-036 Mobile | Preview modal print action works. | Comment:
- [ ] LES-037 Desktop | [ ] LES-037 Mobile | Preview modal download PDF action works. | Comment:
- [ ] LES-038 Desktop | [ ] LES-038 Mobile | /lesson-builder/[id]/preview standalone route loads. | Comment:

---

## 10) Inspiration and Jobs

Routes: /inspiration, /inspiration/new, /inspiration/[id], /jobs, /jobs/new, /jobs/[id]

- [ ] INS-001 Desktop | [ ] INS-001 Mobile | /inspiration list/grid loads correctly. | Comment:
- [ ] INS-002 Desktop | [ ] INS-002 Mobile | Category filters/tabs switch content correctly. | Comment:
- [ ] INS-003 Desktop | [ ] INS-003 Mobile | Featured card interactions open detail correctly. | Comment:
- [ ] INS-004 Desktop | [ ] INS-004 Mobile | Owner edit action works. | Comment:
- [ ] INS-005 Desktop | [ ] INS-005 Mobile | Owner delete action works with confirmation. | Comment:
- [ ] INS-006 Desktop | [ ] INS-006 Mobile | /inspiration/new creation form validation works. | Comment:
- [ ] INS-007 Desktop | [ ] INS-007 Mobile | Inspiration creation success routes correctly. | Comment:
- [ ] INS-008 Desktop | [ ] INS-008 Mobile | /inspiration/[id] detail loads correctly. | Comment:
- [ ] INS-009 Desktop | [ ] INS-009 Mobile | Detail comments/interactions work as expected. | Comment:
- [ ] INS-010 Desktop | [ ] INS-010 Mobile | Missing inspiration detail handled gracefully. | Comment:

- [ ] JOB-001 Desktop | [ ] JOB-001 Mobile | /jobs list page loads correctly. | Comment:
- [ ] JOB-002 Desktop | [ ] JOB-002 Mobile | Filters (grade/subject/type/location) work. | Comment:
- [ ] JOB-003 Desktop | [ ] JOB-003 Mobile | Pagination/load more works without duplicate entries. | Comment:
- [ ] JOB-004 Desktop | [ ] JOB-004 Mobile | /jobs/new is restricted to proper role and loads for admin. | Comment:
- [ ] JOB-005 Desktop | [ ] JOB-005 Mobile | Job creation form validation works. | Comment:
- [ ] JOB-006 Desktop | [ ] JOB-006 Mobile | Job creation success appears in listings. | Comment:
- [ ] JOB-007 Desktop | [ ] JOB-007 Mobile | /jobs/[id] detail loads and Apply action works. | Comment:
- [ ] JOB-008 Desktop | [ ] JOB-008 Mobile | Owner/admin close/remove job action works if present. | Comment:
- [ ] JOB-009 Desktop | [ ] JOB-009 Mobile | Missing job detail handled gracefully. | Comment:
- [ ] JOB-010 Desktop | [ ] JOB-010 Mobile | Job cards are readable and non-overlapping on small screens. | Comment:

---

## 11) Network

Route: /network

- [ ] NET-001 Desktop | [ ] NET-001 Mobile | /network loads without error state under valid session. | Comment:
- [ ] NET-002 Desktop | [ ] NET-002 Mobile | Session-expired state message and recovery path are correct. | Comment:
- [ ] NET-003 Desktop | [ ] NET-003 Mobile | Summary counts match visible lists (spot-check). | Comment:
- [ ] NET-004 Desktop | [ ] NET-004 Mobile | Tabs/segments switch between connections/requests/sent/followers as intended. | Comment:
- [ ] NET-005 Desktop | [ ] NET-005 Mobile | Incoming request accept works and updates state. | Comment:
- [ ] NET-006 Desktop | [ ] NET-006 Mobile | Incoming request decline works and updates state. | Comment:
- [ ] NET-007 Desktop | [ ] NET-007 Mobile | Sent request cancel works and updates state. | Comment:
- [ ] NET-008 Desktop | [ ] NET-008 Mobile | Remove connection works and updates lists. | Comment:
- [ ] NET-009 Desktop | [ ] NET-009 Mobile | Open conversation from network row works quickly. | Comment:
- [ ] NET-010 Desktop | [ ] NET-010 Mobile | Row loading states show per-action progress correctly. | Comment:

- [ ] NET-011 Desktop | [ ] NET-011 Mobile | Error fallback and retry reload data correctly. | Comment:
- [ ] NET-012 Desktop | [ ] NET-012 Mobile | Empty states are clear for each network tab. | Comment:
- [ ] NET-013 Desktop | [ ] NET-013 Mobile | Connection request dialog opens and closes correctly. | Comment:
- [ ] NET-014 Desktop | [ ] NET-014 Mobile | Connection request dialog textarea usability on mobile is good (no disruptive zoom). | Comment:
- [ ] NET-015 Desktop | [ ] NET-015 Mobile | Intro message length/validation in request dialog works. | Comment:

---

## 12) Messages

Routes: /messages, /messages/[conversationId]

- [ ] MSG-001 Desktop | [ ] MSG-001 Mobile | /messages list loads without errors under valid session. | Comment:
- [ ] MSG-002 Desktop | [ ] MSG-002 Mobile | Session-expired state and recovery prompt are correct. | Comment:
- [ ] MSG-003 Desktop | [ ] MSG-003 Mobile | Conversation cards show participant, preview, unread count, time. | Comment:
- [ ] MSG-004 Desktop | [ ] MSG-004 Mobile | Opening conversation from list is responsive. | Comment:
- [ ] MSG-005 Desktop | [ ] MSG-005 Mobile | Search/filter in messages list works if present. | Comment:
- [ ] MSG-006 Desktop | [ ] MSG-006 Mobile | Empty state when no conversations is correct. | Comment:

- [ ] MSG-007 Desktop | [ ] MSG-007 Mobile | /messages/[conversationId] loads thread correctly. | Comment:
- [ ] MSG-008 Desktop | [ ] MSG-008 Mobile | Send message works and appends immediately. | Comment:
- [ ] MSG-009 Desktop | [ ] MSG-009 Mobile | Read/unread behavior updates correctly. | Comment:
- [ ] MSG-010 Desktop | [ ] MSG-010 Mobile | Long messages wrap correctly without overflow. | Comment:
- [ ] MSG-011 Desktop | [ ] MSG-011 Mobile | Attachment/link handling works if supported. | Comment:
- [ ] MSG-012 Desktop | [ ] MSG-012 Mobile | Missing/unauthorized conversation route handled safely. | Comment:

---

## 13) Notifications

Routes: navbar popup + /notifications

- [ ] NOT-001 Desktop | [ ] NOT-001 Mobile | Navbar notification bell appears for signed-in users only. | Comment:
- [ ] NOT-002 Desktop | [ ] NOT-002 Mobile | Popup opens/closes reliably. | Comment:
- [ ] NOT-003 Desktop | [ ] NOT-003 Mobile | Popup list shows latest notifications correctly. | Comment:
- [ ] NOT-004 Desktop | [ ] NOT-004 Mobile | Unread badge count appears and updates correctly. | Comment:
- [ ] NOT-005 Desktop | [ ] NOT-005 Mobile | Mark all as read works. | Comment:
- [ ] NOT-006 Desktop | [ ] NOT-006 Mobile | Remove all works. | Comment:
- [ ] NOT-007 Desktop | [ ] NOT-007 Mobile | Single mark-as-read works. | Comment:
- [ ] NOT-008 Desktop | [ ] NOT-008 Mobile | Single dismiss works. | Comment:
- [ ] NOT-009 Desktop | [ ] NOT-009 Mobile | Clicking notification routes quickly to target page. | Comment:
- [ ] NOT-010 Desktop | [ ] NOT-010 Mobile | View all notifications CTA is visible and readable in popup. | Comment:

- [ ] NOT-011 Desktop | [ ] NOT-011 Mobile | /notifications page loads notifications list. | Comment:
- [ ] NOT-012 Desktop | [ ] NOT-012 Mobile | Filter all/unread works. | Comment:
- [ ] NOT-013 Desktop | [ ] NOT-013 Mobile | Bulk select works. | Comment:
- [ ] NOT-014 Desktop | [ ] NOT-014 Mobile | Bulk mark read/unread works. | Comment:
- [ ] NOT-015 Desktop | [ ] NOT-015 Mobile | Bulk delete works with confirmation. | Comment:
- [ ] NOT-016 Desktop | [ ] NOT-016 Mobile | Single delete works. | Comment:
- [ ] NOT-017 Desktop | [ ] NOT-017 Mobile | Notification navigation from full page is fast and accurate. | Comment:
- [ ] NOT-018 Desktop | [ ] NOT-018 Mobile | Load-more pagination works. | Comment:
- [ ] NOT-019 Desktop | [ ] NOT-019 Mobile | Empty state is correct when no notifications. | Comment:
- [ ] NOT-020 Desktop | [ ] NOT-020 Mobile | No visual overlap/clipping in popup footer on small screens. | Comment:

---

## 14) Profile and Onboarding

Routes: /profile, /profile/edit, /onboarding

- [ ] PRO-001 Desktop | [ ] PRO-001 Mobile | /profile routes to own profile experience correctly. | Comment:
- [ ] PRO-002 Desktop | [ ] PRO-002 Mobile | /profile/edit loads with prefilled current data. | Comment:
- [ ] PRO-003 Desktop | [ ] PRO-003 Mobile | All editable fields accept valid input. | Comment:
- [ ] PRO-004 Desktop | [ ] PRO-004 Mobile | Validation and required fields messaging is clear. | Comment:
- [ ] PRO-005 Desktop | [ ] PRO-005 Mobile | Profile photo upload/change/remove works. | Comment:
- [ ] PRO-006 Desktop | [ ] PRO-006 Mobile | Multi-select fields (subjects/interests/etc) behave correctly. | Comment:
- [ ] PRO-007 Desktop | [ ] PRO-007 Mobile | Save profile persists after refresh. | Comment:
- [ ] PRO-008 Desktop | [ ] PRO-008 Mobile | Cancel/back from edit does not create partial corruption. | Comment:
- [ ] PRO-009 Desktop | [ ] PRO-009 Mobile | Profile completion indicators update after save. | Comment:
- [ ] PRO-010 Desktop | [ ] PRO-010 Mobile | /onboarding flow gates and completion behavior are correct. | Comment:

---

## 15) Account, Plans, and Billing

Routes: /account, /account/plans, /account/upgrade, /pricing, /pricing/success

- [ ] ACC-001 Desktop | [ ] ACC-001 Mobile | /account summary loads with current user/account data. | Comment:
- [ ] ACC-002 Desktop | [ ] ACC-002 Mobile | Account shortcuts route to expected destinations. | Comment:
- [ ] ACC-003 Desktop | [ ] ACC-003 Mobile | /account/plans shows correct current tier and available plans. | Comment:
- [ ] ACC-004 Desktop | [ ] ACC-004 Mobile | Upgrade CTA starts checkout flow correctly. | Comment:
- [ ] ACC-005 Desktop | [ ] ACC-005 Mobile | /account/upgrade route loads and handles checkout init states. | Comment:
- [ ] ACC-006 Desktop | [ ] ACC-006 Mobile | Billing portal action opens expected portal flow. | Comment:
- [ ] ACC-007 Desktop | [ ] ACC-007 Mobile | Cancel subscription flow works with confirmation. | Comment:
- [ ] ACC-008 Desktop | [ ] ACC-008 Mobile | Post-billing return updates tier indicators correctly. | Comment:
- [ ] ACC-009 Desktop | [ ] ACC-009 Mobile | Billing error states are clear and recoverable. | Comment:
- [ ] ACC-010 Desktop | [ ] ACC-010 Mobile | /pricing and account plan information are consistent. | Comment:

---

## 16) Admin

Route: /admin

- [ ] ADM-001 Desktop | [ ] ADM-001 Mobile | /admin is blocked for non-admin users. | Comment:
- [ ] ADM-002 Desktop | [ ] ADM-002 Mobile | /admin loads successfully for admin users. | Comment:
- [ ] ADM-003 Desktop | [ ] ADM-003 Mobile | User search/filter by name/email/uid works. | Comment:
- [ ] ADM-004 Desktop | [ ] ADM-004 Mobile | User tier change works and persists. | Comment:
- [ ] ADM-005 Desktop | [ ] ADM-005 Mobile | User role change works and persists. | Comment:
- [ ] ADM-006 Desktop | [ ] ADM-006 Mobile | Disable/enable user action works and persists. | Comment:
- [ ] ADM-007 Desktop | [ ] ADM-007 Mobile | Generate password reset link action works. | Comment:
- [ ] ADM-008 Desktop | [ ] ADM-008 Mobile | Delete user flow works with confirmation. | Comment:
- [ ] ADM-009 Desktop | [ ] ADM-009 Mobile | Backfill user profile action works and reports result. | Comment:
- [ ] ADM-010 Desktop | [ ] ADM-010 Mobile | Admin error messaging and retry paths are usable. | Comment:

- [ ] ADM-011 Desktop | [ ] ADM-011 Mobile | Featured educators add/remove/reorder works. | Comment:
- [ ] ADM-012 Desktop | [ ] ADM-012 Mobile | Featured lessons add/remove/reorder works. | Comment:
- [ ] ADM-013 Desktop | [ ] ADM-013 Mobile | Featured resources add/remove/reorder works. | Comment:
- [ ] ADM-014 Desktop | [ ] ADM-014 Mobile | Featured forum posts add/remove/reorder works. | Comment:
- [ ] ADM-015 Desktop | [ ] ADM-015 Mobile | Featured inspiration add/remove/reorder works. | Comment:
- [ ] ADM-016 Desktop | [ ] ADM-016 Mobile | Featured feed posts add/remove/reorder works. | Comment:
- [ ] ADM-017 Desktop | [ ] ADM-017 Mobile | Showcase IDs normalize correctly from pasted URLs. | Comment:
- [ ] ADM-018 Desktop | [ ] ADM-018 Mobile | Missing referenced IDs are surfaced clearly in admin UI. | Comment:
- [ ] ADM-019 Desktop | [ ] ADM-019 Mobile | Showcase saves persist after reload. | Comment:
- [ ] ADM-020 Desktop | [ ] ADM-020 Mobile | Admin page remains usable on mobile widths. | Comment:

---

## 17) Search

Route: /search

- [ ] SRCH-001 Desktop | [ ] SRCH-001 Mobile | /search loads with no query and expected default state. | Comment:
- [ ] SRCH-002 Desktop | [ ] SRCH-002 Mobile | Query submission updates URL and results. | Comment:
- [ ] SRCH-003 Desktop | [ ] SRCH-003 Mobile | Tabs/categories (educators/resources/forums/lessons/jobs) switch correctly. | Comment:
- [ ] SRCH-004 Desktop | [ ] SRCH-004 Mobile | Result cards route to correct destination pages. | Comment:
- [ ] SRCH-005 Desktop | [ ] SRCH-005 Mobile | No-results state appears correctly per tab and globally. | Comment:
- [ ] SRCH-006 Desktop | [ ] SRCH-006 Mobile | Long queries/special chars do not break layout or route. | Comment:
- [ ] SRCH-007 Desktop | [ ] SRCH-007 Mobile | Back/forward navigation preserves query and tab state. | Comment:
- [ ] SRCH-008 Desktop | [ ] SRCH-008 Mobile | Search remains responsive under repeated rapid queries. | Comment:

---

## 18) Error, Empty, and Not-Found States

- [ ] ERR-001 Desktop | [ ] ERR-001 Mobile | Every major module has a readable empty state. | Comment:
- [ ] ERR-002 Desktop | [ ] ERR-002 Mobile | Every major module has a readable error state with retry. | Comment:
- [ ] ERR-003 Desktop | [ ] ERR-003 Mobile | 401/session-expired flows are clear and route to login when needed. | Comment:
- [ ] ERR-004 Desktop | [ ] ERR-004 Mobile | 403/permission denied messaging is clear for protected actions. | Comment:
- [ ] ERR-005 Desktop | [ ] ERR-005 Mobile | 404 states for dynamic routes are present and useful. | Comment:
- [ ] ERR-006 Desktop | [ ] ERR-006 Mobile | Action buttons disable during in-flight requests as expected. | Comment:
- [ ] ERR-007 Desktop | [ ] ERR-007 Mobile | Recovering from network drop works where retry exists. | Comment:
- [ ] ERR-008 Desktop | [ ] ERR-008 Mobile | No hard crash from malformed URL params. | Comment:

---

## 19) Accessibility and Interaction Quality

- [ ] A11Y-001 Desktop | [ ] A11Y-001 Mobile | Tab order is logical on key pages. | Comment:
- [ ] A11Y-002 Desktop | [ ] A11Y-002 Mobile | Focus ring is visible on interactive controls. | Comment:
- [ ] A11Y-003 Desktop | [ ] A11Y-003 Mobile | Buttons and links have distinct labels for screen readers. | Comment:
- [ ] A11Y-004 Desktop | [ ] A11Y-004 Mobile | Form inputs have labels and error messages are associated. | Comment:
- [ ] A11Y-005 Desktop | [ ] A11Y-005 Mobile | Modal dialogs trap focus and close via Escape. | Comment:
- [ ] A11Y-006 Desktop | [ ] A11Y-006 Mobile | Color contrast is acceptable for body text and CTAs. | Comment:
- [ ] A11Y-007 Desktop | [ ] A11Y-007 Mobile | Hit targets are usable on touch screens. | Comment:
- [ ] A11Y-008 Desktop | [ ] A11Y-008 Mobile | No interaction relies solely on hover. | Comment:
- [ ] A11Y-009 Desktop | [ ] A11Y-009 Mobile | Reduced motion preference is respected where animations occur. | Comment:
- [ ] A11Y-010 Desktop | [ ] A11Y-010 Mobile | Orientation change does not break core layouts on mobile. | Comment:

---

## 20) Regression Watchlist (High Priority Retest Every Release)

- [ ] REG-001 Desktop | [ ] REG-001 Mobile | Notification popup footer CTA visibility and contrast. | Comment:
- [ ] REG-002 Desktop | [ ] REG-002 Mobile | Notification click navigation speed from popup and full page. | Comment:
- [ ] REG-003 Desktop | [ ] REG-003 Mobile | Network page initial load and error handling. | Comment:
- [ ] REG-004 Desktop | [ ] REG-004 Mobile | Messages page initial load and error handling. | Comment:
- [ ] REG-005 Desktop | [ ] REG-005 Mobile | Follower/following modal and deep-link reliability. | Comment:
- [ ] REG-006 Desktop | [ ] REG-006 Mobile | Lesson preview modal color/theme correctness. | Comment:
- [ ] REG-007 Desktop | [ ] REG-007 Mobile | Lesson preview print/download actions. | Comment:
- [ ] REG-008 Desktop | [ ] REG-008 Mobile | Dashboard initial render performance. | Comment:
- [ ] REG-009 Desktop | [ ] REG-009 Mobile | Auth loading redirect on login/signup pages (no flash). | Comment:
- [ ] REG-010 Desktop | [ ] REG-010 Mobile | Connection request dialog mobile input behavior. | Comment:

---

## 21) QA Result Summary

- Release/Build under test:
- Date tested:
- Tester name:
- Desktop browser/device:
- Mobile browser/device:
- Total checks completed:
- Total failures:
- Critical failures:
- High failures:
- Medium failures:
- Low failures:
- Notes:

---

## 22) Failure Log Template (Copy/Paste for each issue)

Issue ID:
Test ID:
Severity: Critical / High / Medium / Low
Platform: Desktop / Mobile / Both
Route:
User account used:
Steps to reproduce:
Expected result:
Actual result:
Screenshot/video:
Console/network errors:
Additional notes:
