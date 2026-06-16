# EduConnect

A modern professional platform for educators to connect, collaborate, share resources, and grow professionally. EduConnect brings together a professional network, community forum, resource hub, and lesson planning tool - all in one place, built specifically for teachers.

---

## Why EduConnect?

Teachers are busy professionals who lack a dedicated space that combines professional networking, resource sharing, and community support. Existing tools are either too general (LinkedIn) or too fragmented (separate apps for lesson planning, forums, and job boards). EduConnect solves this by offering everything educators need in a single, intuitive platform designed around how teachers actually work.

---

## Features

### Educator Profiles & Discovery
- Create a professional profile with photo, grade level, subjects, school, location, years of experience, and bio
- Browse and filter educators by grade level, subject, location, and experience
- Follow educators to personalise your home feed
- Verified educator badges for credentialed educators

### Home Feed
- Personalised post feed from followed educators and the wider community
- Create posts by type: idea, resource share, or discussion
- Like, comment, and interact with posts
- Sidebar widgets: Trending Discussions, Latest Resources, Featured Lessons, Inspiration Highlights

### Forums
- Categorised discussion boards: Classroom Management, Lesson Planning, Student Engagement, Technology in Education, Teacher Support, Grade-Level Discussions
- Start and participate in threaded discussions
- Upvote/downvote system on threads and replies
- Nested comments (up to 2 levels)

### Resource Library
- Upload and share teaching resources: lesson plans, worksheets, strategies, slides, and tools
- Filter by grade level, subject, type, and popularity
- Download, save/bookmark, and rate resources
- File hosting via Firebase Storage (up to 25 MB per file)
- In-app comments and discussion on each resource

### Lesson Plan Builder
- Structured lesson creation: title, grade level, subject, learning objectives, materials, and step-by-step plan
- Add/reorder steps dynamically
- Attach files to lessons
- Save as draft or publish publicly
- Remix other educators' published lessons
- Shareable lesson preview card
- Collapsible AI Assistant panel: opens as a fixed-width sidebar on desktop or full-screen drawer on mobile so AI tools are accessible on demand without cluttering the form  - Per-section AI Suggest buttons on Learning Objectives, Materials Needed, and Lesson Steps: fetch targeted suggestions, preview them in the AI panel, then Apply (replaces only that section) or Dismiss (leaves the section unchanged); buttons hidden when AI is unavailable
### Inspiration Hub
- Curated content in a magazine-style grid
- Categories: Podcasts, Articles, Videos, Education News, Teacher Stories
- Educator-submitted content

### Job Board
- Browse teaching job opportunities filtered by location, grade level, subject, and job type
- Post job listings (full-time, part-time, contract)
- Full job detail pages with apply actions

### Achievement & Badge System
- **Verification Badge** - for verified school credentials
- **Contribution Badges** - Resource Creator, Lesson Builder, Community Helper, Discussion Starter, Top Contributor
- **Milestone Achievements** - First Resource Shared, 10 Lessons Created, 100 Resource Downloads, 100 Helpful Replies, 1-Year Member
- **Expertise Badges** - Math Mentor, Literacy Specialist, STEM Educator, Classroom Management Expert, Early Childhood Specialist
- Badges display on profiles and next to usernames in discussions

### Notifications
- Real-time notification dropdown in the navbar
- Notification types: new follower, comment on your content, upvote, badge earned, resource liked
- Unread count badge on the notification bell
- Mark individual notifications as read

### Universal Search
- Search across all content types from the navbar
- Tabbed results by type: Educators, Resources, Discussions, Lessons, Jobs

### AI Lesson Assistant
- Authenticated educators can generate a complete lesson plan from a topic, grade level, and subject using OpenAI
- AI can also suggest improvements to individual lesson sections (objectives, materials, steps)
- All OpenAI API calls are made server-side; the API key is never exposed to the browser
- Graceful degradation: spinner and loading states for every in-flight request; 30-second client-side timeout; human-readable messages for network failures, rate limits, and missing configuration; buttons re-enable after any error so users can retry without refreshing
- Free tier: 10 AI requests per day (resets at midnight UTC); remaining count shown in the AI panel ("X / 10 requests remaining today"); Generate and Suggest buttons disabled and an upgrade prompt shown when the limit is reached; a static notice replaces the Plus-tier controls in the Generate section
- Plus tier: unlimited daily AI requests; no usage meter displayed; enhanced Generate section includes a "Grade Level Override" select (overrides the form's grade level for the AI prompt) and an "Additional Context" textarea (up to 500 chars with live counter) to provide extra context to the AI; both fields are validated server-side and included in the OpenAI prompt only when populated

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.2 (App Router) |
| Language | TypeScript 5 (strict) |
| UI | React 19 |
| Styling | Tailwind CSS 4 (no component library) |
| Auth | Firebase Authentication (email/password + Google OAuth) |
| Database | Cloud Firestore |
| File Storage | Firebase Storage |
| Hosting | Firebase Hosting |
| Fonts | Geist Sans + Geist Mono |

---

## User Stories

### Authentication
- As a new educator, I can sign up with email/password or Google OAuth so that I can create an account quickly
- As a returning user, I can log in and be redirected back to the page I was trying to access
- As an authenticated user, I can log out from any page via the navbar dropdown

### Profile
- As an educator, I can create a profile with my photo, grade level, subjects, school, location, experience, and bio so other educators can find and connect with me
- As an educator, I can edit my profile at any time
- As a visitor, I can view any educator's public profile to learn about them and their contributions

### Feed & Social
- As an educator, I can create posts tagged by type, grade level, and subject to share ideas with the community
- As a user, I can like and comment on posts to engage with content
- As a user, I can follow educators so their posts appear in my personalised feed
- As a visitor, I can read the public feed without an account

### Forums
- As an educator, I can start a discussion thread in a relevant category so the community can help with a challenge
- As a user, I can reply to threads and nest replies under existing comments
- As a user, I can upvote/downvote threads and replies to surface the most helpful content

### Resources
- As an educator, I can upload teaching resources with grade level, subject, and type metadata so others can find them
- As a user, I can download, save, and rate resources
- As a user, I can filter and search the resource library to find what I need quickly

### Lesson Builder
- As an educator, I can build a structured lesson plan with objectives, materials, and steps, then publish it or keep it as a draft
- As an educator, I can remix another educator's lesson to adapt it for my classroom
- As a user, I can download and comment on published lesson plans

### Jobs
- As a school administrator, I can post a job listing with full details so qualified educators can apply
- As an educator, I can filter job listings by location, grade level, subject, and type to find relevant opportunities

### Search & Discovery
- As a user, I can search across all content types from the navbar and view results organised by tab
- As an educator, I can browse the inspiration hub for curated educational content by category

---

## Database Schema

### `users` collection
| Field | Type | Description |
|---|---|---|
| `uid` | string | Firebase Auth UID (document ID) |
| `displayName` | string | Full name |
| `email` | string | Email address |
| `photoURL` | string | Profile photo URL (Firebase Storage) |
| `gradeLevel` | string | e.g. "High School" |
| `subjects` | string[] | e.g. ["Math", "Science"] |
| `location` | string | City, country |
| `school` | string | School or institution name |
| `yearsOfExperience` | number | Years teaching |
| `bio` | string | Short bio |
| `isVerified` | boolean | Verified educator status |
| `badges` | string[] | Earned badge IDs |
| `followerCount` | number | Cached follower total |
| `followingCount` | number | Cached following total |
| `createdAt` | timestamp | Account creation date |

Sub-collections: `followers`, `following`

### `posts` collection
| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated document ID |
| `authorId` | string | UID of the author |
| `content` | string | Post body text |
| `type` | string | `idea` \| `resource` \| `discussion` |
| `tags` | string[] | Topic tags |
| `gradeLevel` | string | Target grade level |
| `likesCount` | number | Cached like total |
| `commentsCount` | number | Cached comment total |
| `createdAt` | timestamp | Post creation date |
| `updatedAt` | timestamp | Last edit date |

Sub-collections: `comments`

### `forums` collection (categories)
| Field | Type | Description |
|---|---|---|
| `id` | string | Category slug |
| `name` | string | Display name |
| `threadCount` | number | Cached thread total |
| `lastActivityAt` | timestamp | Most recent thread activity |

Sub-collections: `threads` → `comments`

**Thread schema:** `id`, `title`, `authorId`, `content`, `tags[]`, `gradeLevel`, `subject`, `upvotes`, `commentCount`, `createdAt`

### `resources` collection
| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated document ID |
| `title` | string | Resource title |
| `description` | string | Short description |
| `authorId` | string | UID of uploader |
| `gradeLevel` | string | Target grade level |
| `subject` | string | Subject area |
| `type` | string | `lessonPlan` \| `worksheet` \| `strategy` \| `slides` \| `tool` |
| `fileURL` | string | Firebase Storage download URL |
| `downloadCount` | number | Total downloads |
| `savedByCount` | number | Total saves/bookmarks |
| `ratings` | object | Average rating + count |
| `tags` | string[] | Topic tags |
| `createdAt` | timestamp | Upload date |

### `lessons` collection
| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated document ID |
| `title` | string | Lesson title |
| `authorId` | string | UID of creator |
| `gradeLevel` | string | Target grade level |
| `subject` | string | Subject area |
| `objectives` | string[] | Learning objectives |
| `materials` | string[] | Required materials |
| `steps` | object[] | Ordered lesson steps |
| `attachments` | string[] | Firebase Storage URLs |
| `isPublic` | boolean | Published vs draft |
| `remixedFromId` | string \| null | Source lesson ID if remixed |
| `downloadCount` | number | Total downloads |
| `createdAt` | timestamp | Creation date |
| `updatedAt` | timestamp | Last save date |

### `jobs` collection
| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated document ID |
| `title` | string | Job title |
| `organisation` | string | School or organisation name |
| `location` | string | City, country |
| `gradeLevel` | string | Grade level focus |
| `subject` | string | Subject area |
| `type` | string | `full-time` \| `part-time` \| `contract` |
| `description` | string | Full job description |
| `applyUrl` | string | External apply link |
| `postedById` | string | UID of poster |
| `createdAt` | timestamp | Posting date |

### `notifications` collection (per user)
| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated document ID |
| `userId` | string | Recipient UID |
| `type` | string | `follower` \| `comment` \| `upvote` \| `badge` \| `like` |
| `fromUserId` | string | Triggering user UID |
| `resourceId` | string | Related content ID |
| `isRead` | boolean | Read state |
| `createdAt` | timestamp | Notification date |

### `inspirationContent` collection
| Field | Type | Description |
|---|---|---|
| `id` | string | Auto-generated document ID |
| `title` | string | Content title |
| `description` | string | Short summary |
| `category` | string | `podcasts` \| `articles` \| `videos` \| `news` \| `stories` |
| `thumbnailURL` | string | Cover image URL |
| `externalUrl` | string | Link to original content |
| `submittedById` | string | UID of submitter |
| `createdAt` | timestamp | Submission date |

---

## UX Design

### Design Principles
- **Professional & Clean** - no childish or overly playful aesthetics; educators are professionals
- **Efficiency First** - teachers are time-poor; every flow minimises clicks and cognitive load
- **Mobile-First** - fully responsive from 320 px upward; touch targets ≥ 44 �- 44 px
- **Accessible** - WCAG 2.1 AA compliance; semantic HTML, keyboard navigation, ARIA labels, 4.5:1 contrast minimum

### Colour System
| Token | Value | Usage |
|---|---|---|
| Primary | Dark Maroon | Buttons, active states, brand accents |
| Secondary | Grey | Supporting UI, borders, meta text |
| Background | Light neutral / soft grey | Page backgrounds |
| Accent | Off-white | Highlights, card surfaces |
| Success / Warning / Error / Info | Semantic colours | Form feedback, alerts |

### Typography
- **Geist Sans** - body text, UI labels, headings
- **Geist Mono** - code snippets, technical content

### Navigation
- Persistent top navbar with: Home, Educators, Forums, Resources, Lesson Builder, Inspiration, Jobs, Search, Notifications, User Avatar
- Collapsible hamburger menu on mobile
- Right-side contextual sidebar on desktop (xl+): Trending Discussions, Latest Resources, Featured Educators, Quick Links
- Route groups: `(auth)` for minimal centred auth layouts; `(main)` for full app shell with navbar and sidebar

### Key UX Flows
1. **Onboarding** - Sign up → profile creation form → personalised home feed
2. **Resource sharing** - Upload form with suggested tags → resource card in library → detail page with download/save/rate/comment
3. **Lesson creation** - Builder form with dynamic objective/step lists → save draft → preview → publish → detail page with remix option
4. **Discussion** - Select forum category → create thread → community replies with upvotes and nested comments
5. **Job posting** - Fill job form → listing in board → detail page with apply action

---

## Project Structure

```
app/
  (auth)/           # Minimal layout: login, signup
  (main)/           # Full app shell
    page.tsx        # Home feed
    educators/      # Educator discovery + profiles
    forums/         # Forum categories + threads
    resources/      # Resource library + upload + detail
    lesson-builder/ # Builder + drafts + detail
    inspiration/    # Inspiration hub
    jobs/           # Job board + detail + new listing
    profile/        # Own profile + edit
    search/         # Universal search results
components/
  ui/               # Design system components (Button, Input, Card, etc.)
  layout/           # Navbar, Sidebar, Footer, NotificationDropdown
  posts/            # CreatePost, PostCard
  comments/         # CommentThread
  badges/           # BadgeIcon
  educators/        # EducatorProfile
lib/
  firebase.ts       # Firebase app init
  auth-context.tsx  # Auth state + useAuth hook
  badges.ts         # Badge definitions + award logic
  notifications.ts  # Notification helpers
  utils.ts          # Shared utilities
  firestore/        # Per-feature Firestore models and helpers
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Firebase project with Authentication, Firestore, and Storage enabled

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your Firebase project credentials:

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
OPENAI_API_KEY=       # Server-side only — never expose to the client
```

### Install & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Build for Production

```bash
npm run build
npm run start
```

### Deploy

```bash
firebase deploy
```

Ensure `firebase.json` is configured for Next.js and all production environment variables are set in your hosting provider before deploying.

---

## Configuration

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase project API key | `AIza...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | `project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID | `my-project` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket | `my-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | `123456789` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID | `1:123:web:abc` |
| `OPENAI_API_KEY` | OpenAI secret key for AI lesson features — **server-side only, never commit** | `sk-...` |
| `NEXT_PUBLIC_AI_AVAILABLE` | **Derived automatically** — set to `"true"` by `next.config.ts` when `OPENAI_API_KEY` is present, `"false"` when absent. Do not set this variable manually. | — |

---

## AI Features

### Obtaining an API Key

1. Sign in at [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create a new secret key and copy it immediately — it is only shown once
3. Add it to your `.env.local` file:

```
OPENAI_API_KEY=sk-...
```

### Model

All AI requests use **`gpt-4o-mini`** — a fast, cost-effective model suited to structured lesson-plan generation.

### Security

`OPENAI_API_KEY` is read exclusively from `process.env` inside the `app/api/ai/lesson/` server-side route handler. It is **never** imported in any client component or included in the browser bundle. **Do not commit this key** — `.env.local` is listed in `.gitignore` and must never be added to source control.

### Graceful Degradation

When `OPENAI_API_KEY` is absent or empty:
- The AI assistant panel is hidden from the lesson builder UI
- All "Generate" and "Suggest" buttons are removed
- The `/api/ai/lesson` route returns HTTP 503 if called directly
- Every other feature of EduConnect continues to work normally

`NEXT_PUBLIC_AI_AVAILABLE` controls this behaviour and is **derived automatically** from `OPENAI_API_KEY` in `next.config.ts` — do not set it manually.

---

## API

### `POST /api/ai/lesson`

Generates a full lesson plan or section suggestions using OpenAI. Requires a valid Firebase ID token in the `Authorization: Bearer <token>` header.

**Request body**

```json
// Generate a full lesson plan
{ "mode": "generate", "topic": "Photosynthesis", "gradeLevel": "Grade 7", "subject": "Science" }

// Suggest improvements to a section
{ "mode": "suggest", "gradeLevel": "Grade 7", "subject": "Science", "section": "objectives", "existingContent": ["Understand photosynthesis"] }
```

**Responses**

| Status | Meaning |
|---|---|
| 200 | Success — returns `{ lesson: { title, objectives, materials, steps } }` or `{ suggestions: [] }` |
| 400 | Validation error — returns `{ error: "..." }` identifying the missing/invalid field |
| 401 | Unauthenticated — missing or invalid Firebase ID token |
| 503 | `OPENAI_API_KEY` not configured in the environment |

---

## Roadmap

- Real-time direct messaging between educators
- Admin dashboard and content moderation tools
- Full-text search via Algolia or Elasticsearch
- Email notifications
- Educator credential verification flow (manual review)
- Premium resource tiers / subscription model
- PWA / mobile app
- `@username` mentions in posts and comments
- Sort forum replies by upvotes
