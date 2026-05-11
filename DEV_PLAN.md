# EduConnect — Development Plan

## Tech Stack

- **Framework**: Next.js 16.2.2 (App Router)
- **UI**: React 19 + Tailwind CSS 4 (pure, no component library)
- **Backend**: Firebase Auth, Firestore, Firebase Storage
- **Hosting**: Firebase Hosting
- **Language**: TypeScript 5 (strict)
- **Fonts**: Geist Sans + Geist Mono

---

## Phase 1: Foundation — Design System, Layout Shell, Firebase Setup

> **Goal**: Establish the design system, global navigation, layout structure, and Firebase infrastructure. Everything else builds on this.

- [x] **1.1 Design system — Tailwind theme configuration** (`app/globals.css`)
  - Color palette as CSS variables + Tailwind theme inline
    - Primary: Dark Maroon
    - Secondary: Grey
    - Background: Light neutral
    - Accent: Off-white highlight
    - Foreground: Dark
    - Success, Warning, Error, Info colors
  - Typography scale using Geist font family
  - Border radius tokens
  - Shadow tokens

- [x] **1.2 Reusable base components** (`components/ui/`)
  - `Button` — variants: primary, secondary, outline, ghost; sizes: sm, md, lg
  - `Input` — text input with label, error state, optional icon
  - `Card` — container with soft shadow, rounded corners, padding variants
  - `Badge` — small label/tag with color variants
  - `Avatar` — profile photo with fallback initials, size variants
  - `Modal` — dialog overlay
  - `Dropdown` — menu/select component
  - `Tabs` — tab navigation component
  - `SearchBar` — universal search input
  - `Tag` — filterable tag/chip component

- [x] **1.3 Firebase setup** (`lib/firebase.ts`)
  - Install `firebase` package
  - Firebase config with environment variables (`.env.local`)
  - Initialize Firebase app, Auth, Firestore, Storage
  - Create `.env.example` with placeholder keys

- [x] **1.4 Firebase Auth context** (`lib/auth-context.tsx`)
  - React context provider for auth state
  - `useAuth()` hook: user, loading, signIn, signOut, signUp
  - Wrap app in auth provider in `app/layout.tsx`

- [x] **1.5 Global navigation** (`components/layout/Navbar.tsx`)
  - Top nav: Home, Educators, Forums, Resources, Lesson Builder, Inspiration, Jobs
  - Universal search bar
  - Notifications icon, User avatar/dropdown (profile, settings, logout)
  - Responsive hamburger menu on mobile
  - Active route indicator

- [x] **1.6 Layout shell** (`app/layout.tsx`)
  - Integrate Navbar
  - Sidebar layout wrapper for desktop
  - Footer component
  - Route groups `(auth)` and `(main)` for different layouts
  - Responsive container widths

- [x] **1.7 Route scaffolding** — placeholder pages for all routes
  - `app/page.tsx` — Home feed
  - `app/educators/page.tsx` — Educator discovery
  - `app/educators/[id]/page.tsx` — Educator profile
  - `app/forums/page.tsx` — Forums listing
  - `app/forums/[id]/page.tsx` — Forum thread
  - `app/resources/page.tsx` — Resource library
  - `app/lesson-builder/page.tsx` — Lesson builder
  - `app/inspiration/page.tsx` — Inspiration hub
  - `app/jobs/page.tsx` — Job board
  - `app/auth/login/page.tsx` — Login
  - `app/auth/signup/page.tsx` — Signup
  - `app/profile/page.tsx` — Own profile
  - `app/profile/edit/page.tsx` — Edit profile
  - `app/search/page.tsx` — Search results

### Phase 1 — Manual Test Checklist

#### 1. Functionality Tests

Run `npm run dev` and verify:

- [ ] 1. Visit `/` — home page renders with heading and description
- [ ] 2. Click each nav link (Home, Educators, Forums, Resources, Lesson Builder, Inspiration, Jobs) — each should navigate to its page with heading text
- [ ] 3. Resize browser to mobile width (<768px) — hamburger menu icon should appear, nav links should hide
- [ ] 4. Click hamburger — mobile menu overlay should appear covering the page but NOT the header
- [ ] 5. Click a link in mobile menu — should navigate and close menu
- [ ] 6. Click outside the mobile menu panel — should close
- [ ] 7. Visit `/educators/test-id` — should show "Educator Not Found" (placeholder was replaced in Phase 2)
- [ ] 8. Visit `/forums/test-id` — should show "Discussion Thread" heading with description text (this is the placeholder)
- [ ] 9. Content sidebar (right-side widget boxes: Trending, Resources, Educators, Quick Links) should only be visible at xl breakpoint (1280px+)
- [ ] 10. Footer should show 4 columns on desktop, stack on mobile

#### 2. Screenshots to Take

Take each at **desktop (1280px+)** and **mobile (375px)**:

| Page | URL | What to verify |
|---|---|---|
| Home | `/` | Navbar, sidebar (desktop), footer, main content area |
| Any content page | `/forums` | Layout structure, spacing, typography |
| Mobile nav open | Any page (mobile) | Overlay covers content but not header bar |
| Auth layout | `/auth/login` | Minimal centered layout, logo, no sidebar/footer |

#### 3. Code Validation — Files Worked On

| File | Type |
|---|---|
| `app/globals.css` | Modified — full design system (colors, typography, shadows, radii) |
| `components/ui/Button.tsx` | Created — 4 variants, 3 sizes, loading state |
| `components/ui/Input.tsx` | Created — label, error, icon support |
| `components/ui/Card.tsx` | Created — padding variants, hoverable |
| `components/ui/Badge.tsx` | Created — 6 color variants |
| `components/ui/Avatar.tsx` | Created — image + initials fallback, 4 sizes |
| `components/ui/Modal.tsx` | Created — overlay, escape, click-outside |
| `components/ui/Dropdown.tsx` | Created — click trigger, alignment |
| `components/ui/Tabs.tsx` | Created — underline style, ARIA roles |
| `components/ui/SearchBar.tsx` | Created — search icon, Enter callback |
| `components/ui/Tag.tsx` | Created — selectable, removable |
| `components/ui/index.ts` | Created — barrel export |
| `lib/firebase.ts` | Created — guarded Firebase init |
| `lib/auth-context.tsx` | Created — AuthProvider + useAuth hook |
| `components/layout/Navbar.tsx` | Created — responsive nav, mobile overlay |
| `components/layout/Footer.tsx` | Created — 4-column footer |
| `components/layout/Sidebar.tsx` | Created — right sidebar widgets |
| `app/layout.tsx` | Modified — AuthProvider shell |
| `app/(main)/layout.tsx` | Created — Navbar + Sidebar + Footer |
| `app/(auth)/layout.tsx` | Created — minimal centered layout |
| `app/(main)/page.tsx` | Created — home placeholder |
| `.env.example` | Created — Firebase env placeholder keys |
| 13 placeholder pages | Created — all route scaffolding |

---

## Phase 2: Auth + Educator Profiles + Educator Discovery

> **Goal**: Real authentication flow, educator profiles with Firestore, and the discovery/search page.

- [x] **2.1 Auth pages — Login & Signup**
  - Email/password signup + Google OAuth
  - Form validation
  - Redirect to profile creation on first signup
  - Error handling (duplicate emails, weak passwords, etc.)

- [x] **2.2 Profile creation flow** (`app/profile/edit/page.tsx`)
  - Profile photo upload (Firebase Storage)
  - Fields: name, grade level, subjects, location, school, years of experience, bio
  - Save to Firestore `users` collection
  - Grade level options: Kindergarten, Elementary, Middle School, High School, Higher Education

- [x] **2.3 Firestore data model — Users** (`lib/firestore/users.ts`)
  - Collection: `users`
  - Schema: uid, displayName, email, photoURL, gradeLevel, subjects[], location, school, yearsOfExperience, bio, isVerified, createdAt, badges[], followerCount, followingCount
  - Helpers: createUser, getUser, updateUser, followUser, unfollowUser

- [x] **2.4 Educator profile page** (`app/educators/[id]/page.tsx`)
  - Header: photo, name, grade level, subjects, location, school, experience, verified badge
  - Follow / Message buttons
  - Tabs: Posts, Resources Shared, Lessons Created, Discussions, Saved Content
  - Achievements / badges section

- [x] **2.5 Educator discovery page** (`app/educators/page.tsx`)
  - Filter sidebar/bar
    - Required: Grade Level (Kindergarten–Higher Ed)
    - Optional: Subject, Country, City, School, Years of Experience
  - Educator cards grid: photo, name, grade level, subjects, location, Follow/Message, verified badge
  - Firestore composite queries + pagination

- [x] **2.6 Route protection middleware** (`middleware.ts`)
  - Protect authenticated routes (profile, lesson builder, etc.)
  - Redirect unauthenticated users to login
  - Redirect authenticated users away from auth pages

### Phase 2 — Manual Test Checklist

#### 1. Functionality Tests

Requires Firebase configured (`.env.local` with real credentials) and `npm run dev` running.

**Auth (2.1 + 2.6)**
- [ ] 1. Visit `/profile/edit` while logged out — should redirect to `/auth/login?redirect=/profile/edit`
- [ ] 2. Visit `/lesson-builder` while logged out — should redirect to login
- [ ] 3. Sign up with email/password at `/auth/signup` — should redirect to `/profile/edit`
- [ ] 4. Sign up with a duplicate email — should show error message
- [ ] 5. Sign out, then sign in at `/auth/login` — should redirect to `/`
- [ ] 6. Sign in with Google OAuth — should work and redirect home
- [ ] 7. While logged in, visit `/auth/login` — should redirect to `/`
- [ ] 8. While logged in, visit `/auth/signup` — should redirect to `/`

**Profile (2.2 + 2.3)**
- [ ] 9. After signup, fill out the profile form — name, grade level, subjects (toggle multiple), school, location, years, bio
- [ ] 10. Upload a profile photo (under 5 MB) — preview should appear
- [ ] 11. Try uploading a file over 5 MB — should show error
- [ ] 12. Submit the form — should save to Firestore and redirect to `/profile`
- [ ] 13. Go back to `/profile/edit` — all fields should be pre-filled with saved data
- [ ] 14. Change a field and save — should update (not create duplicate)

**Educator Profile (2.4)**
- [ ] 15. Visit `/educators/{your-uid}` — should show your full profile with "Edit Profile" button
- [ ] 16. Visit `/profile` — should show your profile at the `/profile` URL (no redirect)
- [ ] 17. Visit `/educators/nonexistent-id` — should show "Educator Not Found" state

**Educator Discovery (2.5)**
- [ ] 18. Visit `/educators` — should show educator cards (or empty state if no users yet)
- [ ] 19. Filter by grade level — results should update
- [ ] 20. Filter by subject — results should update
- [ ] 21. Click "Clear Filters" — should reset and show all
- [ ] 22. Click an educator card — should navigate to their profile

**Follow System (2.4)**
- [ ] 23. Create a second test account, visit first user's profile, click "Follow" — follower count should increment
- [ ] 24. Click "Following" to unfollow — count should decrement

#### 2. Screenshots to Take

Take each at **desktop (1280px+)** and **mobile (375px)**:

| Page | URL | What to verify |
|---|---|---|
| Login | `/auth/login` | Form centered, Google button, link to signup |
| Signup | `/auth/signup` | All fields, Google button, link to login |
| Profile Edit (empty) | `/profile/edit` | Photo upload area, all form fields, subject tags |
| Profile Edit (filled) | `/profile/edit` | Pre-filled fields, selected subjects highlighted |
| Educator Profile | `/educators/{uid}` | Avatar, meta info, subject badges, tabs, action buttons |
| Educator Discovery | `/educators` | Filter bar, card grid layout, responsive columns |
| Educator Discovery (empty) | `/educators` with filter yielding 0 | Empty state illustration |

#### 3. Code Validation — Files Worked On

| File | Type |
|---|---|
| `lib/firestore/users.ts` | Created — Firestore user model + search helper |
| `lib/auth-context.tsx` | Modified — added session cookie sync |
| `proxy.ts` | Created — route protection (Next.js 16 proxy) |
| `app/(auth)/auth/login/page.tsx` | Replaced — login page + redirect param + Suspense |
| `app/(auth)/auth/signup/page.tsx` | Replaced — signup page with validation |
| `app/(main)/profile/edit/page.tsx` | Replaced — full profile creation/edit form |
| `app/(main)/profile/page.tsx` | Replaced — redirect to educator profile |
| `app/(main)/educators/[id]/page.tsx` | Replaced — full educator profile page |
| `app/(main)/educators/page.tsx` | Replaced — discovery page with filters + pagination |
| `components/ui/Select.tsx` | Created — select dropdown component |
| `components/ui/Textarea.tsx` | Created — textarea component |
| `components/ui/index.ts` | Modified — added Select, Textarea exports |

---

## Phase 3: Home Feed + Forums

> **Goal**: Personalized home dashboard and a full discussion forum system.

- [x] **3.1 Firestore data model — Posts** (`lib/firestore/posts.ts`)
  - Collection: `posts` with `comments` sub-collection
  - Schema: id, authorId, content, type (idea/resource/discussion), tags[], gradeLevel, createdAt, updatedAt, likesCount, commentsCount
  - Helpers: createPost, getPosts (paginated), likePost, commentOnPost

- [x] **3.2 Home feed** (`app/page.tsx`)
  - Create post component
  - Educator Feed — posts from followed educators + general
  - Trending Discussions widget (sidebar)
  - Latest Resources widget (sidebar)
  - Featured Lessons widget (sidebar)
  - Inspiration Highlights widget (sidebar)
  - Like, comment, share actions on posts
  - Paginated feed

- [x] **3.3 Firestore data model — Forums** (`lib/firestore/forums.ts`)
  - Collection: `forums` (categories) → sub-collection: `threads` → sub-collection: `comments`
  - Thread schema: id, title, authorId, content, tags[], gradeLevel, subject, createdAt, upvotes, commentCount
  - Upvote/downvote system

- [x] **3.4 Forums listing page** (`app/forums/page.tsx`)
  - Categories: Classroom Management, Lesson Planning, Student Engagement, Technology in Education, Teacher Support, Grade-Level Discussions
  - Category cards with thread count and latest activity
  - "New Discussion" button

- [x] **3.5 Forum thread page** (`app/forums/[id]/page.tsx`)
  - Thread detail: title, author, content, tags
  - Comment thread with nested replies
  - Upvote system
  - Reply form

- [x] **3.6 Reusable comment component** (`components/comments/CommentThread.tsx`)
  - Used across forums, posts, resources
  - Nested replies (1–2 levels)
  - Author avatar, name, timestamp
  - Upvote/like action

### Phase 3 — Manual Test Checklist

#### 1. Functionality Tests

Requires logged-in account with completed profile.

**Home Feed — Post Creation (3.1 + 3.2)**
- [ ] 1. Visit `/` while logged in — should show "Create Post" form at top of feed
- [ ] 2. Write a post with content and select a type (idea/resource/discussion) — submit should succeed
- [ ] 3. Select tags and grade level on the post — should save correctly
- [ ] 4. After posting, the new post should appear at the top of the feed
- [ ] 5. Submit an empty post — should show validation error / disabled submit
- [ ] 6. Visit `/` while logged out — should show feed (read-only), no create post form

**Home Feed — Interactions (3.2)**
- [ ] 7. Click "Like" on a post — like count should increment, button should toggle to liked state
- [ ] 8. Click "Like" again — should unlike, count should decrement
- [ ] 9. Click "Comment" on a post — comment form should appear
- [ ] 10. Submit a comment — comment count should increment, comment should appear
- [ ] 11. Scroll to bottom of feed — "Load More" should fetch next page of posts
- [ ] 12. Sidebar widgets (Trending, Resources, Lessons, Inspiration) should display on xl+ screens

**Forums Listing (3.3 + 3.4)**
- [ ] 13. Visit `/forums` — should show 6 category cards (Classroom Management, Lesson Planning, Student Engagement, Technology in Education, Teacher Support, Grade-Level Discussions)
- [ ] 14. Each category card should show thread count and latest activity timestamp
- [ ] 15. Click "New Discussion" — should open a form/modal to create a thread (requires login)
- [ ] 16. Create a new thread with title, content, tags, grade level, subject — should save and redirect to thread page
- [ ] 17. Click a category card — should navigate to that category's thread listing

**Forum Thread (3.5 + 3.6)**
- [ ] 18. Visit `/forums/{thread-id}` — should show thread title, author avatar/name, content, tags
- [ ] 19. Click upvote on the thread — upvote count should increment
- [ ] 20. Click upvote again — should toggle off, count should decrement
- [ ] 21. Submit a reply — comment should appear below the thread
- [ ] 22. Reply to an existing comment (nested reply) — should nest under the parent comment (1–2 levels)
- [ ] 23. Each comment should show author avatar, name, and timestamp
- [ ] 24. Visit a thread while logged out — should show content read-only, no reply form
- [ ] 25. Visit `/forums/nonexistent-id` — should show "Thread Not Found" state

#### 2. Screenshots to Take

Take each at **desktop (1280px+)** and **mobile (375px)**:

| Page | URL | What to verify |
|---|---|---|
| Home Feed (logged in) | `/` | Create post form, post cards, like/comment buttons, sidebar widgets |
| Home Feed (logged out) | `/` | Post cards visible, no create form |
| Forums Listing | `/forums` | 6 category cards, thread counts, "New Discussion" button |
| New Thread Form | `/forums` (after clicking New Discussion) | Title, content, tag/grade/subject fields |
| Forum Thread | `/forums/{id}` | Thread content, upvote, comments, nested replies |
| Forum Thread (mobile) | `/forums/{id}` | Readable layout, reply form accessible |

#### 3. Code Validation — Files Worked On

| File | Type |
|---|---|
| `lib/firestore/posts.ts` | Created — Post model + CRUD + like/comment helpers |
| `lib/firestore/forums.ts` | Created — Forum categories, threads, comments model |
| `components/posts/CreatePost.tsx` | Created — Post creation form |
| `components/posts/PostCard.tsx` | Created — Post display with actions |
| `components/comments/CommentThread.tsx` | Created — Nested comment component |
| `app/(main)/page.tsx` | Replaced — Full home feed with sidebar |
| `app/(main)/forums/page.tsx` | Replaced — Forum categories listing |
| `app/(main)/forums/[id]/page.tsx` | Replaced — Thread detail + comments |
| `components/layout/Sidebar.tsx` | Modified — Dynamic sidebar widgets |

---

## Phase 4: Resource Library + Lesson Plan Builder

> **Goal**: Resource sharing system and the structured lesson plan creation tool.

- [x] **4.1 Firestore data model — Resources** (`lib/firestore/resources.ts`)
  - Collection: `resources`
  - Schema: id, title, description, authorId, gradeLevel, subject, type (lessonPlan/worksheet/strategy/slides/tool), fileURL, downloadCount, ratings, savedByCount, createdAt, tags[]
  - Helpers: CRUD + download tracking + save/bookmark

- [x] **4.2 Resource library page** (`app/resources/page.tsx`)
  - Filters: Grade level, Subject, Popularity, Newest
  - Resource cards: title, description, grade level, subject, author, download, save, rating/downloads
  - File upload flow (Firebase Storage)
  - Search within resources

- [x] **4.3 Resource detail page** (`app/resources/[id]/page.tsx`)
  - Full resource view with download, save, rate
  - Author info card
  - Comments / discussion
  - Related resources

- [x] **4.4 Firestore data model — Lessons** (`lib/firestore/lessons.ts`)
  - Collection: `lessons`
  - Schema: id, title, authorId, gradeLevel, subject, objectives[], materials[], steps[], attachments[], isPublic, remixedFromId, createdAt, updatedAt, downloadCount

- [x] **4.5 Lesson Plan Builder** (`app/lesson-builder/page.tsx`)
  - Form: title, grade level, subject
  - Learning objectives (add/remove list)
  - Materials needed (add/remove list)
  - Step-by-step plan (ordered, reorderable)
  - Attach resources/files
  - Save draft / Publish
  - Preview mode (shareable lesson card)

- [x] **4.6 Lesson detail page** (`app/lesson-builder/[id]/page.tsx`)
  - Full lesson card display
  - Download / Share / Remix buttons
  - Author info
  - Comments

### Phase 4 — Manual Test Checklist

#### 1. Functionality Tests

Requires logged-in account with completed profile.

**Resource Library (4.1 + 4.2)**
- [ ] 1. Visit `/resources` — should show resource cards or empty state
- [ ] 2. Filter by grade level — results should update
- [ ] 3. Filter by subject — results should update
- [ ] 4. Sort by Popularity — should reorder by download count
- [ ] 5. Sort by Newest — should reorder by date
- [ ] 6. Click "Upload Resource" — should navigate to `/resources/upload` (requires login)
- [ ] 7. Fill out resource form (title, description, grade, subject, type, file) — submit should save to Firestore and upload file to Storage
- [ ] 8. Try uploading without required fields — should show validation errors
- [ ] 9. Click suggested tags — should add to tag list; already-added suggestions should disappear
- [ ] 10. Select "Cross-Curricular" subject — should save correctly for cross-subject resources
- [ ] 11. Search within resources (type a keyword) — should filter results
- [ ] 12. Visit `/resources` while logged out — should show resources read-only, no upload button

**Resource Detail (4.3)**
- [ ] 13. Click a resource card — should navigate to `/resources/{id}`
- [ ] 14. Resource detail should show: title, description, author card, grade, subject, type, download count
- [ ] 15. Click "Download" — file should download, download count should increment
- [ ] 16. Click "Save" / bookmark — should toggle saved state
- [ ] 17. Rate the resource — rating should update
- [ ] 18. Post a comment on the resource — should appear in the comments section
- [ ] 19. "Related Resources" section should show other resources with matching subject/grade
- [ ] 20. Visit `/resources/nonexistent-id` — should show "Resource Not Found" state

**Lesson Plan Builder (4.4 + 4.5)**
- [ ] 21. Visit `/lesson-builder` while logged in — should show the builder form
- [ ] 22. Fill in title, grade level, subject — fields should accept input
- [ ] 23. In Learning Objectives, type text and press Enter — should add a new objective row and move focus to the next row
- [ ] 24. In Materials Needed, type text and press Enter — should add a new material row and move focus to the next row
- [ ] 25. Add 3+ steps, then click "+ Add Step Below" from Step 3 — new step should be inserted directly below Step 3
- [ ] 26. Reorder steps using up/down controls — order should update correctly
- [ ] 27. If Firebase Storage is not activated, attachment input should be disabled and should show the "uploads are disabled" helper text
- [ ] 28. After Storage is activated, attach a file — should upload and show in attachments list
- [ ] 29. Click "Save Draft" — should save to Firestore with `isPublic: false` and open lesson detail
- [ ] 30. Return to `/lesson-builder` — "Your Drafts" card should show the saved draft
- [ ] 31. Click "View Drafts" (or go to `/lesson-builder/drafts`) — drafts list should show your saved drafts
- [ ] 32. Click "Edit" on a draft — builder should open pre-filled with existing draft data
- [ ] 33. Click "Publish" from edit mode — lesson should update and show published status on detail page
- [ ] 34. Toggle to "Preview" mode — should show the lesson as a shareable card
- [ ] 35. Visit `/lesson-builder` while logged out — should redirect to login

**Lesson Detail (4.6)**
- [ ] 36. Visit `/lesson-builder/{id}` — should show the full lesson card
- [ ] 37. Click "Download" — should download lesson as a file/PDF
- [ ] 38. Click "Remix" — should open lesson builder pre-filled with the lesson data (new draft)
- [ ] 39. If you are the lesson owner, click "Edit" — should open `/lesson-builder?edit={id}` pre-filled (not blank)
- [ ] 40. Author info card should show name, avatar, link to profile
- [ ] 41. Post a comment on the lesson — should appear in comments section
- [ ] 42. Visit `/lesson-builder/nonexistent-id` — should show "Lesson Not Found" state

#### 2. Screenshots to Take

Take each at **desktop (1280px+)** and **mobile (375px)**:

| Page | URL | What to verify |
|---|---|---|
| Resource Library | `/resources` | Filter bar, resource cards grid, sort controls |
| Resource Library (empty) | `/resources` with filter yielding 0 | Empty state |
| Upload Resource Form | `/resources/upload` | All fields, file picker, type selector, suggested tags |
| Resource Detail | `/resources/{id}` | Full info, download/save buttons, comments, related |
| Lesson Builder (empty) | `/lesson-builder` | Empty form, all sections visible |
| Lesson Builder (filled) | `/lesson-builder` | Enter-to-add in objectives/materials, step cards with "+ Add Step Below" |
| Lesson Builder (drafts widget) | `/lesson-builder` | "Your Drafts" section shows recent drafts |
| Lesson Drafts page | `/lesson-builder/drafts` | Draft list with Open/Edit actions |
| Lesson Preview | `/lesson-builder` (preview mode) | Shareable card layout |
| Lesson Detail | `/lesson-builder/{id}` | Full lesson, download/remix/edit buttons, comments |

#### 3. Code Validation — Files Worked On

| File | Type |
|---|---|
| `lib/firestore/resources.ts` | Created — Resource model + CRUD + download/save/rate helpers + suggested tags |
| `lib/firestore/users.ts` | Modified — Added "Cross-Curricular" to SUBJECTS |
| `lib/firestore/lessons.ts` | Created — Lesson model + CRUD |
| `firestore.indexes.json` | Created — Composite indexes for resource filtering |
| `app/(main)/resources/page.tsx` | Replaced — Resource library with filters (modal removed) |
| `app/(main)/resources/upload/page.tsx` | Created — Dedicated upload resource page with suggested tags |
| `app/(main)/resources/[id]/page.tsx` | Created — Resource detail page |
| `app/(main)/lesson-builder/page.tsx` | Replaced — Lesson plan builder form |
| `app/(main)/lesson-builder/[id]/page.tsx` | Created — Lesson detail page |

---

## Phase 5: Inspiration Hub + Job Board + Badges + Search + Notifications

> **Goal**: Curated content, job listings, achievement system, universal search, and notifications.

- [x] **5.1 Inspiration Hub** (`app/inspiration/page.tsx`)
  - Magazine-style grid layout
  - Category tabs: Podcasts, Articles, Videos, Education News, Teacher Stories
  - Cards: thumbnail, title, short description, creator/source
  - Content submission form for educators

- [x] **5.2 Job Board** (`app/jobs/page.tsx`)
  - Filters: Location, Grade Level, Subject, Job Type (full-time, part-time, contract)
  - Job cards: title, school/org, location, grade level, job type
  - "Post Job" button

- [x] **5.3 Job detail page** (`app/jobs/[id]/page.tsx`)
  - Full job description
  - Apply action (link or in-app)
  - School/org info

- [x] **5.4 Achievement & Badge system** (`lib/badges.ts`)
  - Verification Badge (school email / credential verification)
  - Contribution Badges: Resource Creator, Lesson Builder, Community Helper, Discussion Starter, Top Contributor
  - Milestone Achievements: First Resource Shared, 10 Lessons Created, 100 Resource Downloads, 100 Helpful Replies, 1-Year Member
  - Expertise Badges: Math Mentor, Literacy Specialist, STEM Educator, Classroom Management Expert, Early Childhood Specialist
  - Badge checking logic triggered on relevant actions
  - Badge display component (`components/badges/BadgeIcon.tsx`)
  - Badges shown on profiles and next to usernames in discussions

- [x] **5.5 Notification system** (`components/layout/NotificationDropdown.tsx`, `lib/notifications.ts`)
  - Firestore `notifications` collection per user
  - Types: new follower, comment, upvote, badge earned, resource liked
  - Notification dropdown in navbar
  - Mark as read

- [x] **5.6 Universal search** (`app/search/page.tsx`)
  - Search across: Educators, Resources, Discussions, Lessons, Jobs
  - Tabbed results by type
  - Firestore text search (Algolia integration placeholder for future)

### Phase 5 — Manual Test Checklist

#### 1. Functionality Tests

Requires logged-in account with completed profile and some existing content (posts, resources, lessons, threads).

**Inspiration Hub (5.1)**
- [ ] 1. Visit `/inspiration` — should show a magazine-style grid of content cards
- [ ] 2. Switch between category tabs (Podcasts, Articles, Videos, Education News, Teacher Stories) — cards should filter
- [ ] 3. Each card should show: thumbnail, title, short description, creator/source
- [ ] 4. Click "Submit Content" — should open a submission form (requires login)
- [ ] 5. Submit an inspiration item (title, description, category, link/thumbnail) — should save and appear in listing
- [ ] 6. Visit `/inspiration` while logged out — should show content read-only, no submit button

**Job Board (5.2 + 5.3)**
- [ ] 7. Visit `/jobs` — should show job listing cards or empty state
- [ ] 8. Filter by location — results should update
- [ ] 9. Filter by grade level — results should update
- [ ] 10. Filter by subject — results should update
- [ ] 11. Filter by job type (full-time, part-time, contract) — results should update
- [ ] 12. Click "Post Job" — should open job creation form (requires login)
- [ ] 13. Fill out job form (title, school/org, location, grade, subject, type, description) — submit should save
- [ ] 14. Click a job card — should navigate to `/jobs/{id}`
- [ ] 15. Job detail should show: full description, school/org info, apply action
- [ ] 16. Visit `/jobs/nonexistent-id` — should show "Job Not Found" state

**Badges (5.4)**
- [ ] 17. Visit your profile — badges section should display any earned badges
- [ ] 18. Share a resource → check if "Resource Creator" badge appears on profile
- [ ] 19. Create a lesson → check if "Lesson Builder" badge appears
- [ ] 20. Start a discussion → check if "Discussion Starter" badge appears
- [ ] 21. Badges should appear next to usernames in forum threads and comments
- [ ] 22. Badge icons should have tooltip/label on hover

**Notifications (5.5)**
- [ ] 23. Click the notification bell icon in the navbar — dropdown should open
- [ ] 24. Follow a user from a second account → first account should see "new follower" notification
- [ ] 25. Comment on a user's post → post author should see notification
- [ ] 26. Upvote a thread → thread author should see notification
- [ ] 27. Earn a badge → should see "badge earned" notification
- [ ] 28. Click a notification — should navigate to the relevant content
- [ ] 29. Click "Mark as read" — notification should visually update
- [ ] 30. Unread notification count should show as badge on the bell icon

**Universal Search (5.6)**
- [ ] 31. Type a query in the navbar search bar and press Enter — should navigate to `/search?q={query}`
- [ ] 32. Search results should show tabbed sections: Educators, Resources, Discussions, Lessons, Jobs
- [ ] 33. Click a tab — should filter results to that type
- [ ] 34. Click a result — should navigate to the relevant detail page
- [ ] 35. Search for a term with no results — should show "No results found" state
- [ ] 36. Search with an empty query — should show prompt to enter a search term

#### 2. Screenshots to Take

Take each at **desktop (1280px+)** and **mobile (375px)**:

| Page | URL | What to verify |
|---|---|---|
| Inspiration Hub | `/inspiration` | Magazine grid, category tabs, content cards |
| Job Board | `/jobs` | Filter bar, job cards, "Post Job" button |
| Job Detail | `/jobs/{id}` | Full description, school info, apply button |
| Profile with Badges | `/profile` | Badges section with icons |
| Notification Dropdown | Any page (click bell) | Notification list, read/unread states |
| Search Results | `/search?q=math` | Tabbed results, result cards |
| Search Empty | `/search?q=zzzzzzz` | Empty state message |

#### 3. Code Validation — Files Worked On

| File | Type |
|---|---|
| `lib/firestore/inspiration.ts` | Created — Inspiration content model |
| `lib/firestore/jobs.ts` | Created — Job listings model + CRUD |
| `lib/badges.ts` | Created — Badge definitions + checking logic |
| `lib/notifications.ts` | Created — Notification model + CRUD |
| `components/badges/BadgeIcon.tsx` | Created — Badge display component |
| `components/layout/NotificationDropdown.tsx` | Created — Notification dropdown |
| `app/(main)/inspiration/page.tsx` | Replaced — Inspiration hub with tabs |
| `app/(main)/jobs/page.tsx` | Replaced — Job board with filters |
| `app/(main)/jobs/[id]/page.tsx` | Created — Job detail page |
| `app/(main)/search/page.tsx` | Replaced — Universal search with tabs |
| `components/layout/Navbar.tsx` | Modified — Notification bell + search integration |

---

## Phase 6: Firebase Storage Activation + CORS

> **Goal**: Enable file uploads across the platform (currently skipped gracefully).

- [x] **6.1 Activate Firebase Storage**
  - Upgrade Firebase project to Blaze (pay-as-you-go) plan
  - Enable Cloud Storage in Firebase Console
  - Free tier: 5 GB stored, 1 GB/day downloads, 20K/day upload operations

- [x] **6.2 Deploy CORS configuration**
  - Run: `gsutil cors set cors.json gs://educonnect-60b69.firebasestorage.app`
  - Verify: `gsutil cors get gs://educonnect-60b69.firebasestorage.app`
  - Update `cors.json` to include production domain when deployed

- [x] **6.3 Set Firebase Storage security rules**
  - Only authenticated users can upload
  - Max file size limits (5 MB avatars, 25 MB resources/lessons)
  - Allowed content types

- [x] **6.4 Verify all upload flows work**
  - Profile photo upload (`/profile/edit`)
  - Resource file upload (`/resources/upload`)
  - Lesson attachment upload (`/lesson-builder`)

---

## Phase 7: Deployment

> **Goal**: Deploy the application so it's live and accessible to real users.

- [ ] **7.1 Firebase Hosting setup**
  - Run `firebase init hosting` — set build output directory
  - Configure `firebase.json` for Next.js (or use Firebase's Next.js framework support)
  - Set up custom domain (optional)

- [ ] **7.2 Environment & build configuration**
  - Set production environment variables in Firebase / hosting provider
  - Update `cors.json` to include production domain origin
  - Update Firebase Auth authorized domains (Firebase Console → Auth → Settings)
  - Verify `next.config.ts` production settings (image domains, etc.)

- [ ] **7.3 Deploy**
  - Build: `npm run build`
  - Deploy: `firebase deploy` (or hosting provider CLI)
  - Verify all pages load correctly on production URL
  - Test auth flow (sign up, login, logout) on production
  - Test file uploads on production (after Phase 6)

- [ ] **7.4 Post-deployment checks**
  - Firestore security rules deployed and tested
  - Storage security rules deployed and tested
  - No API keys / secrets exposed in client bundle
  - Performance check (Lighthouse audit)

---

## Architecture Decisions

- **Firestore structure**: Top-level collections with sub-collections for comments. Denormalize author info on cards to minimize reads.
- **Auth**: Firebase client SDK in client components, React Context for state.
- **File uploads**: Firebase Storage with auth-gated security rules.
- **Images**: Next.js `<Image>` with Firebase Storage URLs.
- **State management**: React Context for auth; local state + Firestore listeners for data. No Redux.
- **Route groups**: `(auth)` and `(main)` for layout separation.
- **Pagination**: Cursor-based with Firestore `startAfter()`.

---

## Excluded (Future Roadmap)

- Payment / subscription model for premium resources
- Admin dashboard & content moderation tools
- Real-time messaging / chat between educators
- Email notifications
- Advanced analytics
- PWA / mobile app
- Educator verification flow (manual review process)
- Full-text search via Algolia / ElasticSearch

---

## Future Features (Backlog)

- [x] **Reply to post comments**: Allow nested replies on home feed post comments (currently flat). Added `parentId` to `PostComment`/`PostCommentInput`, stored in Firestore. `PostCard` now maps `parentId` correctly and uses `maxDepth={1}` so the Reply button appears on top-level comments.
- [x] **User tagging in posts/comments**: `@username` mentions that send notifications to tagged users. Added `searchUsersByDisplayName` (Firestore prefix query) to `users.ts`. Created `MentionInput` component — detects `@query` at cursor, shows a floating user dropdown (arrow-key navigable), inserts `@DisplayName` on select, tracks selected UIDs. Used in `CreatePost` (textarea) and `CommentThread` (both top-level and reply inputs). `onAddComment` signature extended with optional `mentionedUids[]`. Mention notifications fire-and-forget via new `notifyMention()` helper (`"mention"` type added to `NotificationType`).
- [x] **Sort forum replies by upvotes**: Added `replySort` state (`"newest" | "top"`) to the forum thread page. A "Newest / Top" pill toggle appears above the replies when there are 2+ comments. When "Top" is selected, top-level replies are re-sorted by `upvotes - downvotes` descending before being passed to `CommentThread`; nested replies stay grouped under their parents as-is.
- **Dedicated New Thread page**: ~~Replace the forums "New Discussion" modal with a full page at `/forums/new`.~~ **Done in Phase 8.8.**
- **Notification system**: In-app notification bell for likes, comments, mentions, and replies.
- [x] **Auto-generated resource PDF**: Installed `@react-pdf/renderer`. Created `components/resources/ResourcePDFDocument.tsx` — a styled LETTER-size PDF with title, grade/subject/type/author meta row, description, and tag chips. In the upload page (`/resources/upload`): if the user submits without attaching a file and Storage is active, the PDF is generated client-side via `pdf(...).toBlob()`, uploaded to Firebase Storage, and its URL stored as `fileURL` — so the download button always works. Resources uploaded with a real file continue to use that file unchanged. Added `@react-pdf/renderer` to `serverExternalPackages` in `next.config.ts` to prevent SSR bundle errors.
- [x] **Rich text / hyperlinks in content**: Implemented a `LinkAttacher` component (`components/ui/LinkAttacher.tsx`) — a 🔗 "Attach link" button that opens an inline URL + label form. URLs are validated (`http`/`https` only, auto-prefixes `https://`) and displayed as removable chips. Added `links: AttachedLink[]` field to `Post`, `Resource`, and `ForumThread` data models. Wired `LinkAttacher` into `CreatePost`, `/resources/upload`, and `/forums/new`. Link chips render on `PostCard`, `/resources/[id]`, and `/forums/[id]`.
- [x] **Share improvements**: Fixed and unified share functionality across all content types. PostCard now shares `/?post={id}` — the home feed loads with that post pinned at the top in a highlighted card (auto-scrolls to it), and the post is filtered out of the regular feed to avoid duplication. Added Share buttons (using `navigator.share` with clipboard fallback) to `/resources/[id]`, `/lesson-builder/[id]`, and `/forums/[id]` — each shares the current page URL so recipients land directly on the content. Share buttons now show "✓ Copied!" visual feedback for 2 seconds when the clipboard fallback is used. Added guest auth walls: resource detail pages show a "Sign in to download and save" banner replacing the action buttons for unauthenticated visitors; lesson detail pages hide steps/materials/attachments and show a "Sign in to view the full lesson plan" gate — both keep the Share button visible so guests can still share content to grow the platform.
- **Download improvements**: Improve the lesson download feature to produce a properly formatted document (PDF). Use `@react-pdf/renderer` or a similar library so downloaded lessons look clean and professional.
- **User roles system**: Site Admin + School Admin roles. School Admin requires approval by a Site Admin (with notification flow). Relevant for controlling who can post jobs. Currently left open — anyone can post.
- **Responsive styling fixes**: Full audit and fix of layout issues on mobile viewports. Priority areas: Navbar, profile header, card grids, filter bars.
- **Profile header scroll lock**: On the educator profile page, the header/avatar section should only scroll horizontally with the page — not jump or shift vertically during navigation transitions.
- **Notification system enhancements**: In-app notifications for: new comment on your post, reply to your comment, someone downloads/shares your resource or lesson, new follower. Show unread count badge on the bell icon.
- **Google OAuth fix**: Ensure Google Sign-In popup works in production. Requires localhost and production domain in Firebase Console → Authentication → Authorized Domains. Check OAuth consent screen configuration in Google Cloud Console.

---

## Phase 8: User Testing Fixes

> **Goal**: Address feedback from initial user testing.

- [x] **8.1 Forgot password**: Add "Forgot password?" link on login page that sends a password reset email via Firebase Auth `sendPasswordResetEmail`. Shows email input, success confirmation, and error states.

- [x] **8.2 Home feed type filters**: Add pill-button filters (All / 💡 Ideas / 📚 Resources / 💬 Discussions) above the feed. Filters pass a `type` param to `getPosts()`. Added composite Firestore index for `posts.type + createdAt`.

- [x] **8.3 Lesson duration field**: Added `duration` text field to the lesson builder form (e.g. "45 minutes", "2 class periods"). Stored in Firestore. Displayed in lesson preview with ⏱ icon.

- [x] **8.4 Privacy gating — profile page**: Unauthenticated visitors see the public profile info (name, bio, stats) but the content tabs (Posts, Resources, Lessons, Discussions) show a "Sign in to view" wall instead of real data.

- [x] **8.5 Privacy gating — home feed**: Unauthenticated visitors see the first 3 posts, then a "Sign in to see more" wall with links to sign up or log in.

- [x] **8.6 Job post creation fix**: Fixed redirect after posting a job — now uses `jobSlug(title, id)` to navigate to the correct detail URL.

- [x] **8.7 Click post to expand comments**: Clicking the post content text now toggles the comments section open/closed (same as the Comment button). The comment count in the stats bar is also clickable.

- [x] **8.8 Forum new discussion page**: Replaced the "New Discussion" modal with navigation to `/forums/new` — a dedicated full-page form with category selector, title, content, grade level, subject, and tags. The modal and its state were removed from the forums listing page.

- [x] **8.9 Resource discussion modal removed**: Removed the inline Discussion `<Card>` and `<CommentThread>` from the resource detail page. Stripped all associated state (`comments`, `commentsLoading`), `loadComments` callback, `commentData` mapping, and unused imports (`useCallback`, `CommentThread`, `CommentData`, `ResourceComment`, `getResourceComments`, `addResourceComment`).

- [x] **8.10 Responsive styling audit**: Systematic review across all pages at 375px, 768px, and 1280px. Key fixes: (1) Resources page filter bar — replaced 4-item `sm:flex-row` (cramped at 640px) with `grid grid-cols-2 lg:grid-cols-4`; Clear Filters moved below the grid. (2) PostCard action bar — added `flex-wrap` so Like/Comment/Share buttons wrap on very small screens rather than overflowing.

- [x] **8.11 Profile page header scroll behavior**: Added `tabsSectionRef` to the Content Tabs section. When a tab is switched via `handleTabChange`, `requestAnimationFrame` scrolls the tab container into view (`scrollIntoView block:nearest`) so the profile header stays at a predictable vertical position and doesn't jump. Increased tab content card min-height to `min-h-[320px]` to prevent layout collapse when content loads.

- [x] **8.12 Google OAuth debugging**: Code-side improvements: (1) Added `email` + `profile` scopes to `GoogleAuthProvider` so `displayName` and `photoURL` are always populated. (2) Added `prompt: select_account` custom parameter to always show the Google account picker. (3) Added `auth/popup-blocked`, `auth/operation-not-allowed`, `auth/network-request-failed` to the error message maps on both login and signup pages. (4) Added `auth/cancelled-popup-request` to the ignored-error list alongside `auth/popup-closed-by-user`. **Authorized Domains confirmed OK**: `localhost`, `educonnect-60b69.firebaseapp.com`, and `educonnect-60b69.web.app` are all present — domain config is not the issue. **Remaining action**: Go to Firebase Console → Authentication → Sign-in Providers and enable the **Google** provider. If it's already enabled, check Google Cloud Console → APIs & Services → OAuth consent screen to ensure the app is configured and not in a blocked state.