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

---

## Phase 2: Auth + Educator Profiles + Educator Discovery

> **Goal**: Real authentication flow, educator profiles with Firestore, and the discovery/search page.

- [x] **2.1 Auth pages — Login & Signup**
  - Email/password signup + Google OAuth
  - Form validation
  - Redirect to profile creation on first signup
  - Error handling (duplicate emails, weak passwords, etc.)

- [ ] **2.2 Profile creation flow** (`app/profile/edit/page.tsx`)
  - Profile photo upload (Firebase Storage)
  - Fields: name, grade level, subjects, location, school, years of experience, bio
  - Save to Firestore `users` collection
  - Grade level options: Kindergarten, Elementary, Middle School, High School, Higher Education

- [ ] **2.3 Firestore data model — Users** (`lib/firestore/users.ts`)
  - Collection: `users`
  - Schema: uid, displayName, email, photoURL, gradeLevel, subjects[], location, school, yearsOfExperience, bio, isVerified, createdAt, badges[], followerCount, followingCount
  - Helpers: createUser, getUser, updateUser, followUser, unfollowUser

- [ ] **2.4 Educator profile page** (`app/educators/[id]/page.tsx`)
  - Header: photo, name, grade level, subjects, location, school, experience, verified badge
  - Follow / Message buttons
  - Tabs: Posts, Resources Shared, Lessons Created, Discussions, Saved Content
  - Achievements / badges section

- [ ] **2.5 Educator discovery page** (`app/educators/page.tsx`)
  - Filter sidebar/bar
    - Required: Grade Level (Kindergarten–Higher Ed)
    - Optional: Subject, Country, City, School, Years of Experience
  - Educator cards grid: photo, name, grade level, subjects, location, Follow/Message, verified badge
  - Firestore composite queries + pagination

- [ ] **2.6 Route protection middleware** (`middleware.ts`)
  - Protect authenticated routes (profile, lesson builder, etc.)
  - Redirect unauthenticated users to login
  - Redirect authenticated users away from auth pages

---

## Phase 3: Home Feed + Forums

> **Goal**: Personalized home dashboard and a full discussion forum system.

- [ ] **3.1 Firestore data model — Posts** (`lib/firestore/posts.ts`)
  - Collection: `posts` with `comments` sub-collection
  - Schema: id, authorId, content, type (idea/resource/discussion), tags[], gradeLevel, createdAt, updatedAt, likesCount, commentsCount
  - Helpers: createPost, getPosts (paginated), likePost, commentOnPost

- [ ] **3.2 Home feed** (`app/page.tsx`)
  - Create post component
  - Educator Feed — posts from followed educators + general
  - Trending Discussions widget (sidebar)
  - Latest Resources widget (sidebar)
  - Featured Lessons widget (sidebar)
  - Inspiration Highlights widget (sidebar)
  - Like, comment, share actions on posts
  - Paginated feed

- [ ] **3.3 Firestore data model — Forums** (`lib/firestore/forums.ts`)
  - Collection: `forums` (categories) → sub-collection: `threads` → sub-collection: `comments`
  - Thread schema: id, title, authorId, content, tags[], gradeLevel, subject, createdAt, upvotes, commentCount
  - Upvote/downvote system

- [ ] **3.4 Forums listing page** (`app/forums/page.tsx`)
  - Categories: Classroom Management, Lesson Planning, Student Engagement, Technology in Education, Teacher Support, Grade-Level Discussions
  - Category cards with thread count and latest activity
  - "New Discussion" button

- [ ] **3.5 Forum thread page** (`app/forums/[id]/page.tsx`)
  - Thread detail: title, author, content, tags
  - Comment thread with nested replies
  - Upvote system
  - Reply form

- [ ] **3.6 Reusable comment component** (`components/comments/CommentThread.tsx`)
  - Used across forums, posts, resources
  - Nested replies (1–2 levels)
  - Author avatar, name, timestamp
  - Upvote/like action

---

## Phase 4: Resource Library + Lesson Plan Builder

> **Goal**: Resource sharing system and the structured lesson plan creation tool.

- [ ] **4.1 Firestore data model — Resources** (`lib/firestore/resources.ts`)
  - Collection: `resources`
  - Schema: id, title, description, authorId, gradeLevel, subject, type (lessonPlan/worksheet/strategy/slides/tool), fileURL, downloadCount, ratings, savedByCount, createdAt, tags[]
  - Helpers: CRUD + download tracking + save/bookmark

- [ ] **4.2 Resource library page** (`app/resources/page.tsx`)
  - Filters: Grade level, Subject, Popularity, Newest
  - Resource cards: title, description, grade level, subject, author, download, save, rating/downloads
  - File upload flow (Firebase Storage)
  - Search within resources

- [ ] **4.3 Resource detail page** (`app/resources/[id]/page.tsx`)
  - Full resource view with download, save, rate
  - Author info card
  - Comments / discussion
  - Related resources

- [ ] **4.4 Firestore data model — Lessons** (`lib/firestore/lessons.ts`)
  - Collection: `lessons`
  - Schema: id, title, authorId, gradeLevel, subject, objectives[], materials[], steps[], attachments[], isPublic, remixedFromId, createdAt, updatedAt, downloadCount

- [ ] **4.5 Lesson Plan Builder** (`app/lesson-builder/page.tsx`)
  - Form: title, grade level, subject
  - Learning objectives (add/remove list)
  - Materials needed (add/remove list)
  - Step-by-step plan (ordered, reorderable)
  - Attach resources/files
  - Save draft / Publish
  - Preview mode (shareable lesson card)

- [ ] **4.6 Lesson detail page** (`app/lesson-builder/[id]/page.tsx`)
  - Full lesson card display
  - Download / Share / Remix buttons
  - Author info
  - Comments

---

## Phase 5: Inspiration Hub + Job Board + Badges + Search + Notifications

> **Goal**: Curated content, job listings, achievement system, universal search, and notifications.

- [ ] **5.1 Inspiration Hub** (`app/inspiration/page.tsx`)
  - Magazine-style grid layout
  - Category tabs: Podcasts, Articles, Videos, Education News, Teacher Stories
  - Cards: thumbnail, title, short description, creator/source
  - Content submission form for educators

- [ ] **5.2 Job Board** (`app/jobs/page.tsx`)
  - Filters: Location, Grade Level, Subject, Job Type (full-time, part-time, contract)
  - Job cards: title, school/org, location, grade level, job type
  - "Post Job" button

- [ ] **5.3 Job detail page** (`app/jobs/[id]/page.tsx`)
  - Full job description
  - Apply action (link or in-app)
  - School/org info

- [ ] **5.4 Achievement & Badge system** (`lib/badges.ts`)
  - Verification Badge (school email / credential verification)
  - Contribution Badges: Resource Creator, Lesson Builder, Community Helper, Discussion Starter, Top Contributor
  - Milestone Achievements: First Resource Shared, 10 Lessons Created, 100 Resource Downloads, 100 Helpful Replies, 1-Year Member
  - Expertise Badges: Math Mentor, Literacy Specialist, STEM Educator, Classroom Management Expert, Early Childhood Specialist
  - Badge checking logic triggered on relevant actions
  - Badge display component (`components/badges/BadgeIcon.tsx`)
  - Badges shown on profiles and next to usernames in discussions

- [ ] **5.5 Notification system** (`components/layout/NotificationDropdown.tsx`, `lib/notifications.ts`)
  - Firestore `notifications` collection per user
  - Types: new follower, comment, upvote, badge earned, resource liked
  - Notification dropdown in navbar
  - Mark as read

- [ ] **5.6 Universal search** (`app/search/page.tsx`)
  - Search across: Educators, Resources, Discussions, Lessons, Jobs
  - Tabbed results by type
  - Firestore text search (Algolia integration placeholder for future)

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
