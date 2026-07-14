# EduConnect — Project Plan

> This file tracks feature milestones in Scrum format. The full phase-based development history lives in `DEV_PLAN.md`.

---

## Agreed Tech Stack

| Layer    | Choice                          | Notes                                      |
|----------|---------------------------------|--------------------------------------------|
| Frontend | Next.js 16 App Router + React 19 | TypeScript strict                         |
| Backend  | Firebase Auth + Firestore        | Existing — no changes to data model needed |
| AI       | OpenAI API (server-side only)    | `openai` npm package; key in `.env.local`  |
| Hosting  | Firebase Hosting                 |                                            |
| Auth     | Firebase Auth                    | Route-protected; only educators can use AI |

---

## Milestones

| #   | Name                         | Goal                                                                                                    | User Stories                                     |
|-----|------------------------------|---------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| M1  | AI Lesson Plan Assistant     | Add an AI assistant to the Lesson Builder that generates full lesson plans and suggests improvements to individual sections | US-01, US-02, US-03, US-04, US-05, US-06, US-07, US-08 |
| M2  | Lesson Builder Wizard Redesign | Replace the single-page editor with a guided wizard flow, AI-powered creation path, inline review editing, and per-field AI refine | US-09, US-10, US-11, US-12, US-13, US-14 |

---

## Milestone 1: AI Lesson Plan Assistant

**Goal**: Authenticated educators using `/lesson-builder` can invoke an AI assistant (powered by OpenAI) to either generate a complete lesson plan from a topic prompt, or request targeted improvements to individual sections (objectives, materials, steps). The OpenAI API key is never exposed to the client — all calls are made from a Next.js server-side API route.

---

### US-01: Secure Server-Side OpenAI API Route

**As an** authenticated educator, **I want** AI requests to be processed server-side, **so that** my OpenAI API key is never exposed in the browser or client bundle.

**Tasks**
- [x] Install the `openai` npm package (`npm install openai`)
- [x] Create `app/api/ai/lesson/route.ts` as a Next.js App Router `POST` route handler
- [x] Read `OPENAI_API_KEY` exclusively from `process.env` (server-side); never import it in any client component
- [x] Accept a validated JSON request body: `{ mode: 'generate' | 'suggest', topic?: string, gradeLevel: string, subject: string, section?: 'objectives' | 'materials' | 'steps', existingContent?: string[] }`
- [x] Validate all inputs at the route boundary; return HTTP 400 with a descriptive error for invalid/missing fields
- [x] Return HTTP 503 with `{ error: 'AI features are not configured.' }` when `OPENAI_API_KEY` is absent or empty — do not throw
- [x] For `mode: 'generate'`: compose a system prompt that returns a structured JSON lesson plan (title, objectives, materials, steps) from topic + gradeLevel + subject
- [x] For `mode: 'suggest'`: compose a system prompt that returns improved/alternative items for the specified section, given the existing content
- [x] Parse the OpenAI response and return clean JSON to the client; map OpenAI SDK errors to safe, human-readable messages (no raw error objects in responses)
- [x] Ensure the route is only accessible to authenticated users (verify session server-side via Firebase Admin SDK or existing auth middleware)

**Acceptance Criteria**
- [x] AC-1: A POST to `/api/ai/lesson` with a valid body returns a 200 response containing structured lesson content
- [x] AC-2: A POST with a missing or invalid field returns 400 with a message identifying the problem
- [x] AC-3: When `OPENAI_API_KEY` is not set, the route returns 503 — the app does not crash and no key value appears in any response
- [x] AC-4: Inspecting the browser's Network tab shows no `OPENAI_API_KEY` value anywhere in requests or responses
- [x] AC-5: Unauthenticated requests to the route are rejected (401/403) and do not reach the OpenAI API

---

### US-02: Collapsible AI Assistant Panel

**As an** educator using the Lesson Builder, **I want** to open and close an AI assistant panel alongside the form, **so that** I can access AI features on demand without it cluttering my workspace.

**Tasks**
- [x] Create `components/lessons/AIAssistantPanel.tsx` — a collapsible side panel component accepting props: `isOpen`, `onToggle`, `isAvailable`, `lessonFormState`, `onApplySuggestion`
- [x] Add an "AI Assistant" toggle button to the lesson builder page header (spark/wand icon + label); toggles the panel open/closed
- [x] Panel animates in/out with a CSS transition (slide or fade); layout shifts the form content left on desktop, overlays on mobile
- [x] When `isAvailable` is `false` (API returned 503 or env var absent), panel renders a non-interactive "AI features are unavailable in this environment" notice instead of the action buttons
- [x] Panel is fully keyboard-navigable: toggle button is focusable, panel can be closed with `Escape`
- [x] Panel is accessible: `role="complementary"`, `aria-label="AI Assistant"`, toggle button has `aria-expanded` state
- [x] Panel is responsive: full-width drawer on mobile (≤768 px), fixed-width sidebar on desktop

**Acceptance Criteria**
- [x] AC-1: Clicking "AI Assistant" in the lesson builder header opens the panel; clicking again closes it
- [x] AC-2: Pressing `Escape` while the panel is open closes it and returns focus to the toggle button
- [x] AC-3: On mobile (375 px), the panel appears as a full-width overlay and does not cause horizontal scroll
- [x] AC-4: On desktop (1280 px), the panel appears as a sidebar alongside the lesson form without obscuring form fields
- [x] AC-5: When the API key is not configured, the panel displays the "unavailable" notice and no action buttons are shown
- [x] AC-6: The toggle button's `aria-expanded` attribute correctly reflects the open/closed state at all times

---

### US-03: Generate Full Lesson Plan from a Topic Prompt

**As an** educator, **I want** to enter a topic and have the AI generate a complete lesson plan, **so that** I have a strong starting point that I can review and refine.

**Tasks**
- [x] Add a "Generate Full Lesson" section to the AI panel: a topic `<input>` field, read-only display of the current grade level and subject (pulled from the lesson form), and a "Generate" submit button
- [x] On submit, POST to `/api/ai/lesson` with `{ mode: 'generate', topic, gradeLevel, subject }`
- [x] Disable the Generate button and show a loading spinner while the request is in-flight
- [x] On success, display a confirmation dialog ("This will replace your current lesson content. Continue?") if any lesson form field is non-empty
- [x] On confirmation (or if the form is empty), populate all lesson builder fields: title, objectives list, materials list, and steps list
- [x] On cancel, leave the existing form content unchanged
- [x] The topic input is required; the Generate button is disabled when topic is empty

**Acceptance Criteria**
- [x] AC-1: Submitting a topic generates a full lesson and populates all form fields (title, objectives, materials, steps) with the AI's output
- [x] AC-2: If any form field already has content, a confirmation dialog appears before any field is overwritten
- [x] AC-3: Clicking "Cancel" in the confirmation dialog leaves every form field unchanged
- [x] AC-4: The Generate button is disabled and shows a spinner while a request is in-flight; it cannot be submitted twice
- [x] AC-5: The topic input shows a validation message if the user clicks Generate while it is empty
- [x] AC-6: After generation, the educator can freely edit any populated field before saving

---

### US-04: Per-Section AI Suggestions

**As an** educator, **I want** to click "Suggest" next to a specific lesson section and receive AI-generated improvements for just that section, **so that** I can refine individual parts of my lesson without losing my other work.

**Tasks**
- [x] Add a "Suggest" button to each of the three section headers in the lesson builder: Learning Objectives, Materials Needed, and Lesson Steps
- [x] On click, POST to `/api/ai/lesson` with `{ mode: 'suggest', section: 'objectives'|'materials'|'steps', gradeLevel, subject, existingContent: <current section items> }`
- [x] While the request is in-flight, disable that section's Suggest button and show an inline spinner; the rest of the form remains interactive
- [x] On success, display the AI's suggestions in the AI panel as a preview list (clearly labelled "Suggested [Section]")
- [x] Show "Apply" and "Dismiss" buttons below the suggestions in the panel
- [x] "Apply" replaces only that section's content with the AI suggestions and closes the suggestion preview
- [x] "Dismiss" discards the suggestions and returns the panel to its default state
- [x] Only one section suggestion can be in-progress or previewed at a time; clicking Suggest on a second section while one is pending cancels the first

**Acceptance Criteria**
- [x] AC-1: Clicking "Suggest" on Objectives fetches suggestions and displays them in the AI panel without affecting Materials or Steps
- [x] AC-2: Clicking "Apply" replaces only the targeted section; Materials and Steps remain unchanged
- [x] AC-3: Clicking "Dismiss" leaves the section exactly as it was before Suggest was clicked
- [x] AC-4: While a suggestion request is in-flight, the Suggest button for that section is disabled; the other two sections' buttons remain enabled
- [x] AC-5: Clicking Suggest on a second section while a suggestion preview is showing replaces the preview with the new result (no stale suggestions visible)
- [x] AC-6: The section-level Suggest buttons are not rendered when the AI panel is unavailable (503 / missing key)

---

### US-05: Loading States, Error Handling, and Graceful Degradation

**As an** educator, **I want** clear feedback while the AI is working and helpful messages when something goes wrong, **so that** I am never left with a broken or confusing interface.

**Tasks**
- [x] Show a skeleton/spinner inside the AI panel whenever any AI request is in-flight
- [x] Implement a 30-second client-side timeout using `AbortController`; on timeout, display "The AI took too long to respond. Please try again."
- [x] Map known API error codes to human-readable messages:
  - Network failure → "Could not reach the AI service. Check your connection and try again."
  - 503 (missing key) → "AI features are not available in this environment."
  - 429 (rate limit) → "The AI service is busy. Please wait a moment and try again."
  - 500 / unknown → "Something went wrong. Please try again."
- [x] Never surface raw error objects, stack traces, or OpenAI error codes to the UI
- [x] When an error occurs, the Generate button and Suggest buttons become re-enabled so the user can retry
- [x] All lesson builder form functionality (save draft, publish, add/remove objectives etc.) works normally regardless of AI panel state
- [x] If `OPENAI_API_KEY` is absent the lesson builder page loads and functions fully; no console errors caused by the missing AI configuration

**Acceptance Criteria**
- [x] AC-1: A spinner is visible in the AI panel for the full duration of any in-flight AI request
- [x] AC-2: If a request exceeds 30 seconds, the spinner stops and a timeout message is displayed
- [x] AC-3: A simulated network failure (disable network in DevTools) shows the network-failure message, not a raw error
- [x] AC-4: All human-readable error messages are visible to screen readers (not hidden by `aria-hidden`)
- [x] AC-5: With `OPENAI_API_KEY` unset in `.env.local`, the lesson builder page loads without JavaScript errors, the AI panel shows the "unavailable" notice, and saving/editing lessons works normally
- [x] AC-6: After any error, the user can dismiss the message and retry without refreshing the page

---

### US-06: Environment Variable Documentation

**As a** developer setting up the project, **I want** `.env.example` to document the OpenAI API key, **so that** I know exactly what to configure before running the AI features.

**Tasks**
- [x] Add `OPENAI_API_KEY=` (empty value placeholder) to `.env.example` under a clearly labelled `# AI (OpenAI)` comment block
- [x] Add an "AI Features" section to `README.md` documenting: where to obtain an OpenAI API key, which model is used, that the key must never be committed, and that AI features degrade gracefully when the key is absent
- [x] Confirm that `.env.local` is present in `.gitignore` (it should already be; verify and add if missing)

**Acceptance Criteria**
- [x] AC-1: `.env.example` contains `OPENAI_API_KEY=` with a comment explaining its purpose
- [x] AC-2: `README.md` has an "AI Features" section with setup instructions
- [x] AC-3: `.gitignore` includes `.env.local` (no secrets can be accidentally committed)
- [x] AC-4: A developer who clones the repo and follows the README AI setup section can get AI features working without additional guidance

---

### US-07: Free Tier Daily AI Usage Limit

**As a** free-tier educator, **I want** the app to track and enforce my daily AI request limit, **so that** I understand my usage and am prompted to upgrade when I reach the cap.

**Tasks**
- [x] Add a `tier: 'free' | 'plus'` field to the Firestore user document schema; treat absent field as `'free'`
- [x] In `app/api/ai/lesson/route.ts`, after verifying the JWT, read the user's `tier` from `users/{uid}` in Firestore using the Firebase Admin SDK
- [x] Read and write daily usage from `users/{uid}/aiUsage/{YYYY-MM-DD}` (document with a `count: number` field); compute the date key in UTC
- [x] Before calling OpenAI: if `tier === 'free'` and `count >= 10`, return HTTP 429 with `{ error: "You've reached your daily AI limit (10 requests). Upgrade to Plus for unlimited access." }` without incrementing the counter
- [x] Otherwise, increment `count` by 1 (using Firestore `FieldValue.increment(1)` with `{ merge: true }`) and proceed to the OpenAI call
- [x] Plus tier users skip the read/write entirely — proceed directly to the OpenAI call
- [x] Expose a `GET /api/ai/lesson/usage` endpoint (or extend the existing route) that returns `{ tier, used, limit }` for the authenticated user for today; free tier returns `limit: 10`, plus returns `limit: null`
- [x] In `AIAssistantPanel.tsx`, fetch usage on mount (and after each successful AI request) and display a "X / 10 requests remaining today" line for free tier users
- [x] When `used >= 10` and tier is `'free'`, display an upgrade prompt in the panel: "You've reached your daily limit. Upgrade to Plus for unlimited AI access." and disable the Generate and Suggest buttons
- [x] Map the new 429 response to a specific user-facing message in the client error-handling logic (US-05)

**Acceptance Criteria**
- [x] AC-1: A free tier user who has made 10 AI requests today receives a 429 response on the 11th attempt; the Generate and Suggest buttons become disabled and the upgrade prompt is shown
- [x] AC-2: The daily counter resets the following UTC day — requests after midnight UTC succeed again for a free tier user who was at the limit
- [x] AC-3: A plus tier user can make more than 10 AI requests in a day without receiving a 429 response
- [x] AC-4: The AI panel displays the correct remaining count (e.g. "7 / 10 requests remaining today") for a free tier user and updates it after each successful request
- [x] AC-5: The usage counter is enforced server-side; a client that omits the usage-fetch step cannot bypass the limit
- [x] AC-6: The Firestore path `users/{uid}/aiUsage/{YYYY-MM-DD}` exists and its `count` field matches the number of successful AI requests made by that user on that UTC date

---

### US-08: Plus Tier & Enhanced AI Panel

**As a** plus-tier educator, **I want** additional controls in the AI panel when generating a lesson plan, **so that** I can tailor the AI output to a specific grade level and provide extra context without editing the main form.

**Tasks**
- [x] In `AIAssistantPanel.tsx`, read the authenticated user's `tier` from the user profile (already fetched from Firestore; no extra request needed)
- [x] For **plus** users: add a "Grade level override" `<select>` to the "Generate Full Lesson" section, populated with the same `GRADE_LEVELS` constant used by the lesson builder form; default to the current form grade level
- [x] For **plus** users: add an "Optional description" `<textarea>` (max 500 chars, with a live character counter) below the grade override for additional context
- [x] Include `gradeLevelOverride` and `description` in the POST body to `/api/ai/lesson` only when the user is plus tier and the fields have values
- [x] In `app/api/ai/lesson/route.ts`: accept optional `gradeLevelOverride?: string` and `description?: string` in the request body; use `gradeLevelOverride` in place of `gradeLevel` in the OpenAI prompt when provided; append `description` as additional context to the user message when provided
- [x] For **free** users: render a static notice in place of the two fields: "Upgrade to Plus for grade override and description fields"
- [x] Validate `gradeLevelOverride` server-side against the same allowed values as `gradeLevel`; return 400 if an unrecognised value is supplied
- [x] Validate `description` server-side: must be a string ≤ 500 characters if present; return 400 otherwise

**Acceptance Criteria**
- [x] AC-1: A plus user sees a "Grade level override" select and an "Optional description" textarea in the Generate section; a free user sees the upgrade notice in their place
- [x] AC-2: When a plus user changes the grade override and generates a lesson, the AI panel sends `gradeLevelOverride` in the request body and the generated lesson reflects the overridden grade level
- [x] AC-3: When a plus user enters a description, it is appended to the OpenAI prompt and influences the generated output
- [x] AC-4: The description textarea enforces the 500-character limit client-side (character counter visible) and the API returns 400 if a longer value is submitted directly
- [x] AC-5: Submitting an unrecognised `gradeLevelOverride` value directly to the API returns 400
- [x] AC-6: Removing the grade override (resetting to the form's current grade level) and generating a lesson uses the original form grade level, not the overridden one

---

## Milestone 2: Lesson Builder Wizard Redesign

**Goal**: Replace the existing single-page lesson builder with a guided, multi-step wizard experience. Users choose between a manual path (section-by-section with a sticky stepper) and an AI-assisted path (generate then review). The review page supports inline editing and per-field AI refinement. Progress auto-saves to Firestore as a draft.

**Architecture**
- `app/(main)/lesson-builder/new/page.tsx` becomes the entry screen and wizard coordinator
- New directory: `components/lessons/wizard/` containing the stepper, step components, review page, inline editor, and refine popover
- New API mode `refine` added to `app/api/ai/lesson/route.ts`
- New Firestore path `users/{uid}/aiRefineUsage/{YYYY-MM}` for monthly refine tracking
- `AIAssistantPanel.tsx` and the existing step-by-step editor are retired (replaced by this wizard)

---

### US-09: Entry Screen

**As an** educator landing on `/lesson-builder/new`, **I want** to choose between creating a lesson manually or with the AI assistant, **so that** the tool matches my intent from the start.

**Tasks**
- [x] Replace current new-lesson page content with a centred entry card showing the heading "Lesson Builder" and subtitle "How would you like to create your lesson?"
- [x] Two primary action buttons: **"Create My Own"** and **"Create with AI Assistant"** (AI button disabled with tooltip when `NEXT_PUBLIC_AI_AVAILABLE` is false)
- [x] "Create My Own" sets a `path: "manual"` flag in wizard state and advances to the wizard shell (US-10)
- [x] "Create with AI Assistant" sets `path: "ai"` and advances to the AI generation screen (US-12)
- [x] If the user has an unfinished draft from a previous session, display a dismissible "Resume your draft?" banner above the two buttons with "Resume" and "Start fresh" actions; resume loads the draft state
- [x] Entry screen is accessible: buttons are focusable, labelled, and have visible focus indicators; heading hierarchy starts at `<h1>`
- [x] Existing `/lesson-builder/new?edit=` and `?remix=` query-param flows bypass the entry screen and load directly into the wizard shell with the lesson pre-populated

**Acceptance Criteria**
- [x] AC-1: The page renders two clearly labelled buttons ("Create My Own" and "Create with AI Assistant") with no other form fields visible
- [x] AC-2: Clicking "Create My Own" navigates to (or reveals) the wizard shell at step 1
- [x] AC-3: Clicking "Create with AI Assistant" navigates to (or reveals) the AI generation screen
- [x] AC-4: When AI is unavailable (`NEXT_PUBLIC_AI_AVAILABLE` is false), the "Create with AI Assistant" button is visually disabled and shows a tooltip explaining why
- [x] AC-5: A draft resume banner appears when an incomplete draft exists for the current user, and clicking "Resume" restores all previously entered field values
- [x] AC-6: Using `?edit=<id>` or `?remix=<id>` bypasses the entry screen and loads the lesson directly into the wizard

---

### US-10: Wizard Shell with Sticky Stepper (Manual Path)

**As an** educator on the manual creation path, **I want** to see all lesson sections on one scrollable page with a sticky progress stepper, **so that** I always know where I am and can jump back to completed sections.

**Tasks**
- [x] Create `components/lessons/wizard/WizardShell.tsx` — a layout component that renders a sticky left stepper (desktop) or a compact top progress bar (mobile ≤768 px) alongside a scrollable content area
- [x] The stepper shows 7 steps: Basic Info, Learning Objectives, Materials Needed, Step-by-Step Plan, Check for Understanding, Suggested Assessments, Review & Publish
- [x] Each step has three visual states: **locked** (grey, future), **active** (blue, current), **completed** (green with checkmark)
- [x] Clicking a completed step in the stepper scrolls the page to that section and sets it as the active step
- [x] Future (locked) steps are not clickable; clicking them shows no action
- [x] Each section card is always rendered on the page (not conditionally hidden); active section has a highlighted border; locked sections are dimmed
- [x] A **Next** button at the bottom of each section card advances to the next step (validates required fields first — see US-11); a **Back** button (except on step 1) returns to the previous step
- [x] Scrolling the page (Intersection Observer) updates the active step in the stepper to reflect the section currently in the viewport
- [x] Create individual step components: `BasicInfoStep.tsx`, `ObjectivesStep.tsx`, `MaterialsStep.tsx`, `LessonStepsStep.tsx`, `CFUStep.tsx`, `AssessmentsStep.tsx` — each accepts the lesson state slice and an `onChange` callback
- [x] All form inputs within each step are identical to the existing lesson builder fields (same `Input`, `Textarea`, `Select` components)

**Acceptance Criteria**
- [x] AC-1: On desktop (≥768 px), a sticky left sidebar stepper is visible showing all 7 steps with correct states (locked/active/completed)
- [x] AC-2: On mobile (<768 px), the stepper is replaced by a compact horizontal progress bar showing the current step number and title
- [x] AC-3: Clicking a completed step in the stepper scrolls smoothly to that section and highlights it as active
- [x] AC-4: The active section's card has a distinct visual highlight (e.g. primary-colour border); locked sections are visually dimmed but still readable
- [x] AC-5: The Next button at the bottom of each section advances the stepper when clicked (after validation)
- [x] AC-6: The Back button returns to the previous step with no data loss
- [x] AC-7: Scrolling past a section card updates the stepper's active indicator to match the section in the viewport

---

### US-11: Step Validation and Firestore Draft Auto-Save

**As an** educator working through the wizard, **I want** my progress saved automatically after each step and required fields validated before I can advance, **so that** I never lose work and am guided to fill in essential information.

**Tasks**
- [x] Define required fields per step: Basic Info (title required to advance; grade + subject required to publish but not to advance), Objectives (at least one non-empty item), Materials (optional — can advance empty), Steps (at least one step with a title), CFU (optional), Assessments (optional)
- [x] When Next is clicked, validate the active step's required fields; if validation fails, show inline error messages on the failing fields and do not advance
- [x] On successful validation, mark the step as completed and save the full lesson state to Firestore as a draft: call `createLesson` if no `draftId` exists yet, otherwise `updateLesson`; store `isPublic: false`
- [x] Persist the `draftId` in component state (and React ref) so subsequent saves update the same document
- [x] Display a transient "Saved" indicator (toast or small badge near the stepper) for 2 seconds after each successful Firestore save
- [x] If the Firestore save fails, show a non-blocking error notice ("Draft could not be saved — your changes are still here"); do not prevent advancing
- [x] On mount, if a `draftId` query param is present (from the resume flow in US-09), load that draft and restore all field values and the completed-steps set

**Acceptance Criteria**
- [x] AC-1: Clicking Next on the Basic Info step without a title shows an inline "Title is required" error and does not advance
- [x] AC-2: Filling in the title and clicking Next marks Basic Info as completed, saves a Firestore draft, and advances to step 2
- [x] AC-3: The Firestore draft document is updated (not re-created) on each subsequent step completion
- [x] AC-4: A "Saved" indicator appears briefly after each successful save and then disappears
- [x] AC-5: If Firestore is unavailable, the wizard continues to function and displays a non-blocking warning; no data is lost
- [x] AC-6: Loading the page with `?draft=<id>` restores all field values and marks previously-completed steps as completed in the stepper

---

### US-12: AI Creation Path — Generate then Review

**As an** educator on the AI creation path, **I want** to fill in basic context, let the AI generate a complete lesson, and land directly on the review page, **so that** I can go from idea to draft in seconds.

**Tasks**
- [x] Create `components/lessons/wizard/AIGenerateScreen.tsx` — a focused form showing: topic input (required, max 300 chars), grade level select, subject select, and (plus-tier only) specific-grade override and additional context textarea
- [x] A single **"Generate Lesson"** button submits the form; button is disabled while generating or when topic is empty
- [x] On submit, POST to `/api/ai/lesson` with `{ mode: 'generate', ... }` (same endpoint as before); show a full-screen loading state with a spinner and the message "Generating your lesson plan…"
- [x] On success, populate all lesson state fields from the API response (title, objectives, materials, steps, checkForUnderstanding, assessments) and mark all 6 content steps as completed in the wizard state
- [x] Automatically advance to the Review & Publish step (step 7); save a Firestore draft in the same operation
- [x] On error, display a human-readable error message (same error-mapping as M1) and re-enable the Generate button
- [x] The screen shows the current daily AI usage (free tier) and disables the Generate button if the limit is reached (same guard as M1)
- [x] Retain plus-tier grade override and additional context fields (identical to M1 behaviour)

**Acceptance Criteria**
- [x] AC-1: The AI generation screen shows a topic input, grade level, and subject — and for plus users also a grade override select and context textarea
- [x] AC-2: Clicking "Generate Lesson" with a valid topic calls the API and shows a loading state for the full duration of the request
- [x] AC-3: On success, all lesson fields are populated from the API response and the wizard jumps to the Review & Publish step
- [x] AC-4: A Firestore draft is created automatically after successful generation without the user having to click Save
- [x] AC-5: On API error, a human-readable message is shown and the Generate button becomes re-enabled
- [x] AC-6: Free tier users see their remaining daily requests and cannot generate when the limit is reached

---

### US-13: Review & Publish Page with Inline Editing

**As an** educator on the review step, **I want** to see all lesson sections in a clean read-only view, then click Edit on any section to modify it inline, **so that** I can review and fine-tune before publishing.

**Tasks**
- [ ] Create `components/lessons/wizard/ReviewPage.tsx` — renders all lesson sections in read mode (title, grade, subject, duration, objectives, materials, steps with duration, check for understanding, assessments, attachments)
- [ ] Each section has an **"Edit"** button (pencil icon + label); clicking it switches that section to inline edit mode
- [ ] Inline edit mode renders the same form fields used in the corresponding wizard step component, pre-populated with current values
- [ ] Inline edit mode shows **"Save"** and **"Cancel"** buttons; Save commits the changes to wizard state and returns to read mode; Cancel discards changes and returns to read mode
- [ ] Only one section can be in edit mode at a time; opening a second section's editor while one is open prompts "You have unsaved changes — save or cancel first" and does not open the second editor
- [ ] A **"Back to Edit"** button at the top returns to the last active wizard step (not step 1) for more extensive editing via the stepper
- [ ] **"Save Draft"** and **"Publish"** buttons at the bottom; Publish validates that grade level, subject, and at least one objective and one step are present
- [ ] Publish validation errors appear as an inline error list above the action buttons; focus is moved to the first error
- [ ] The review page is accessible: sections use `<section>` elements with `aria-label`; edit mode fields are focussed on open; Save/Cancel are keyboard-navigable

**Acceptance Criteria**
- [ ] AC-1: All lesson sections are visible in read mode on the review page; no form fields are shown until Edit is clicked
- [ ] AC-2: Clicking "Edit" on a section switches it to inline edit mode with the current values pre-filled
- [ ] AC-3: Clicking "Save" commits the edited values and returns the section to read mode with the updated content visible
- [ ] AC-4: Clicking "Cancel" discards the changes and the section shows the original values
- [ ] AC-5: Attempting to open a second section's editor while one is open shows a warning and does not open the second editor
- [ ] AC-6: Clicking "Publish" with a missing required field shows an inline validation error list and does not submit
- [ ] AC-7: A successfully published lesson navigates to `/lesson-builder/<id>` as before

---

### US-14: Per-Field AI Refine with Monthly Limit

**As an** educator on the review page, **I want** to click "Refine" next to any section, describe how I want it changed, and have the AI rewrite just that section, **so that** I can polish specific parts without rewriting them manually.

**Tasks**
- [x] Add a **"Refine"** button (sparkle icon) to each editable section on the review page, visible when the section is in **read mode** (not while editing inline)
- [x] Clicking Refine opens an inline popover directly below/above the section containing: a labelled textarea ("How should this be changed?", max 300 chars), a **"Refine"** submit button, and an **"×"** close button
- [x] On submit, POST to `/api/ai/lesson` with `{ mode: 'refine', field: '<section>', content: <current value>, instruction: <user text>, gradeLevel, subject }` and show a spinner in the popover
- [x] On success, replace only that section's content in wizard state (do not touch other sections); close the popover; show a transient "Refined ✓" badge on the section header for 2 seconds
- [x] On error, show a human-readable error inside the popover and re-enable the Refine button
- [x] Add `mode: 'refine'` handling to `app/api/ai/lesson/route.ts`: accepts `{ field, content, instruction, gradeLevel, subject }`; returns `{ refined: string[] | LessonStep[] }` depending on field type; sanitise instruction (max 300 chars, must be non-empty)
- [x] **Monthly refine limit — server-side**: read/write `users/{uid}/aiRefineUsage/{YYYY-MM}` with a `count` field; free tier limit = 20/month; plus = unlimited; compute key as `YYYY-MM` in UTC; use atomic Firestore increment
- [x] Return HTTP 429 with `{ error: "You've reached your monthly refine limit (20). Upgrade to Plus for unlimited refines.", remainingRefines: 0 }` when free tier exceeds 20
- [x] **Monthly refine limit — client-side**: on mount (and after each successful refine), fetch remaining refines from a `GET /api/ai/lesson` response field `remainingRefines`; display "X / 20 refines remaining this month" in the review page header for free tier; disable Refine buttons when 0 remain
- [x] Firestore security rules: add `aiRefineUsage/{monthKey}` subcollection under `users/{userId}` with owner-only read/write
- [x] The instruction textarea is sanitised server-side (strip leading/trailing whitespace; reject if empty after trim); do not pass raw user text directly to the OpenAI system prompt — inject it only into the user message

**Acceptance Criteria**
- [x] AC-1: A "Refine" button is visible next to each section in read mode on the review page; it is not shown while that section is in inline edit mode
- [x] AC-2: Clicking Refine opens a popover with a textarea; submitting a non-empty instruction calls the API and shows a spinner
- [x] AC-3: On success, only the targeted section's content is updated; all other sections are unchanged; a "Refined ✓" badge appears briefly
- [x] AC-4: On error, a human-readable message appears inside the popover; the Refine button is re-enabled
- [x] AC-5: A free tier user who has made 20 refine requests this calendar month receives a 429 on the 21st attempt; all Refine buttons are disabled and an upgrade prompt is shown
- [x] AC-6: A plus tier user can make more than 20 refines per month without receiving a 429
- [x] AC-7: The API returns 400 if `instruction` is empty or exceeds 300 characters
- [x] AC-8: The monthly refine counter resets on the 1st of the next UTC month

---

## Milestone 3: Social Graph, Content Ownership, Notifications, and Platform Polish

**Goal**: Round out the platform with a follower/following social graph, full CRUD ownership over all user-created content, a comprehensive notification system, lesson plan preview and PDF copyright footers, account management and profile editing, a reusable confirmation dialog, intellectual property notices, and a public landing page with an authenticated home-feed redirect.

| #    | Name | Goal | User Stories |
|------|------|------|--------------|
| M3   | Platform Polish | Social graph, full content CRUD, notifications, IP notices, landing page, account management | US-15, US-16, US-17, US-18, US-19, US-20, US-21, US-22, US-23, US-24, US-25 |

---

### US-15: Follower / Following Social Graph

**As an** educator, **I want** to follow other educators and see who follows me, **so that** I can build a professional network and stay updated on the people I care about.

**Tasks**
- [x] Add a `followers` and `following` subcollection (or top-level `follows/{followerId_followeeId}` documents) to the Firestore data model; document each relationship with `{ followerId, followeeId, createdAt }`
- [x] Add `followersCount` and `followingCount` denormalised fields to the `users/{uid}` document; increment/decrement them atomically using Firestore transactions when a follow/unfollow is performed
- [x] Create `lib/firestore/follows.ts` exporting `followUser(followerId, followeeId)`, `unfollowUser(followerId, followeeId)`, `isFollowing(followerId, followeeId)`, `getFollowers(userId, limit?)`, and `getFollowing(userId, limit?)`
- [x] Update Firestore security rules to allow only the authenticated `followerId` to create/delete their own follow documents; deny reads to unauthenticated users
- [x] On the educator profile page (`/educators/[id]`), make the follower count and following count clickable links pointing to `/educators/[id]/followers` and `/educators/[id]/following` respectively
- [x] Create `app/(main)/educators/[id]/followers/page.tsx` — a paginated list of users who follow this educator; each row shows avatar, display name, short bio, and a Follow/Unfollow button (disabled for the viewer's own profile)
- [x] Create `app/(main)/educators/[id]/following/page.tsx` — same layout as followers page but for users this educator follows
- [x] The Follow/Unfollow button uses optimistic UI: update local state immediately, then call Firestore; revert on error with a toast notification
- [x] Trigger a "follow" notification (see US-18) after a successful `followUser` call
- [x] The Follow button is not rendered on the viewer's own profile page

**Acceptance Criteria**
- [x] AC-1: Navigating to `/educators/[id]/followers` shows a list of users who follow that educator, each with avatar, name, bio, and Follow/Unfollow button
- [x] AC-2: Navigating to `/educators/[id]/following` shows the users that educator follows, with the same card layout
- [x] AC-3: Clicking Follow on an educator's card immediately reflects the change in button state (optimistic update) and persists in Firestore
- [x] AC-4: Clicking Unfollow removes the follow relationship; the count on the profile page updates accordingly
- [x] AC-5: The follower and following counts on the profile page are rendered as `<a>` links; clicking them navigates to the correct list pages
- [x] AC-6: The Follow/Unfollow button is not shown when the viewer is viewing their own followers/following page
- [x] AC-7: Unauthenticated users cannot write to follow documents (Firestore rules reject the write and the UI shows a sign-in prompt)

---

### US-16: Comment and Reply CRUD

**As an** educator, **I want** to edit and delete my own comments and replies anywhere on the platform, **so that** I can correct mistakes and remove content I no longer stand behind.

**Tasks**
- [x] Extend the `CommentThread` component (`components/comments/CommentThread.tsx`) to accept an `authorId` prop per comment/reply and compare it to the currently authenticated user's `uid`
- [x] For comments and replies owned by the current user (or an admin), render an overflow menu (three-dot icon) with "Edit" and "Delete" options
- [x] "Edit" replaces the comment text with an inline `<textarea>` pre-filled with the current content, and shows "Save" and "Cancel" buttons
- [x] "Save" calls `updateComment` (or equivalent) in `lib/firestore/` with the edited text and a `editedAt` timestamp; the comment then renders with a subtle "(edited)" label
- [x] "Cancel" closes the inline editor and restores the original text without persisting any change
- [x] "Delete" opens the reusable `ConfirmDialog` (US-22) with the message "Delete this comment? This cannot be undone." and a destructive Confirm button
- [x] On deletion confirmation, call `deleteComment`; remove the comment from local state immediately (optimistic); show a toast "Comment deleted"
- [x] Add `updateComment(commentId, newText)` and `deleteComment(commentId)` functions to the relevant firestore module; strip and trim `newText` server-side in Firestore security rules using `request.resource.data.text.size() <= 2000`
- [x] Update Firestore security rules: only the comment author (`request.auth.uid == resource.data.authorId`) or an admin role may update or delete a comment document
- [x] The edit textarea enforces a 2 000-character limit client-side with a live counter

**Acceptance Criteria**
- [x] AC-1: A user sees Edit and Delete options only on their own comments and replies; they do not see these options on other users' content
- [x] AC-2: Clicking Edit opens an inline textarea with the original text pre-filled; clicking Save persists the update and shows "(edited)" on the comment
- [x] AC-3: Clicking Cancel in edit mode leaves the comment text exactly as it was
- [x] AC-4: Clicking Delete opens a confirmation dialog; confirming removes the comment from the UI and Firestore
- [x] AC-5: Attempting to delete or update another user's comment via direct Firestore write is rejected by security rules
- [x] AC-6: The edit textarea shows a character counter and prevents saving when the text exceeds 2 000 characters or is empty
- [x] AC-7: After deleting a comment with replies, the thread handles the missing parent gracefully (e.g. shows "Comment deleted" placeholder or removes the thread)

---

### US-17: Full CRUD for Posts, Lessons, Resources, and Inspiration

**As an** educator, **I want** to edit and delete my own forum posts, lesson plans, resources, and inspiration posts, **so that** I have full control over my published content.

**Tasks**
- [x] **Forum posts**: add Edit (pencil icon) and Delete (trash icon) action buttons to `PostCard` when the viewer is the author; Edit opens the existing `CreatePost` form inline or as a modal pre-filled with post data; Delete uses `ConfirmDialog` (US-22)
- [x] **Lesson plans**: on the lesson detail/view page (`/lesson-builder/[id]`), add an Edit button (navigates to `/lesson-builder/new?edit=[id]` which already exists) and a Delete button that opens `ConfirmDialog`; on the drafts list, add the same Delete action
- [x] **Resources**: on the resource detail page (`/resources/[id]`), add Edit (navigates to `/resources/upload?edit=[id]` or opens an edit modal) and Delete with `ConfirmDialog`
- [x] **Inspiration posts**: on each inspiration card/detail view, add Edit (inline or modal form) and Delete with `ConfirmDialog`
- [x] All Delete actions call the appropriate `deleteX` function in `lib/firestore/`; on success, redirect to the parent list page or remove the card from the feed; show a success toast
- [x] All Edit actions pre-populate the form with the existing document data; saving calls `updateX` with the changed fields and a `updatedAt` timestamp
- [x] Update Firestore security rules for each collection to permit `update` and `delete` only when `request.auth.uid == resource.data.authorId`
- [x] Hide Edit/Delete UI from users who do not own the content; do not rely solely on UI hiding — enforce in rules
- [x] After a successful delete of a lesson plan, decrement the author's `lessonCount` field atomically (same pattern as follower counts); apply equivalent denormalised count maintenance for resources and inspiration posts if those counts exist

**Acceptance Criteria**
- [x] AC-1: The author of a forum post sees Edit and Delete controls on their post card; other users do not
- [x] AC-2: Editing a forum post pre-fills the form with existing content; saving updates the post in Firestore and reflects the change in the feed immediately
- [x] AC-3: Deleting a lesson plan opens a confirmation dialog; confirming removes the document and redirects the user to `/lesson-builder`
- [x] AC-4: Deleting a resource opens a confirmation dialog; confirming removes the document and redirects to `/resources`
- [x] AC-5: Editing a resource pre-fills all fields; saving persists changes and shows the updated resource detail
- [x] AC-6: Inspiration posts support the same Edit/Delete flow; deletion removes the card from the inspiration feed
- [x] AC-7: Direct Firestore writes attempting to modify or delete another user's content are rejected by security rules

---

### US-18: Notification System Full Coverage

**As an** educator, **I want** to receive a notification every time someone interacts meaningfully with my content or profile, **so that** I stay engaged with my community without having to check everything manually.

**Tasks**
- [x] Audit `lib/notifications.ts` and all Firestore write call sites; identify every action that should trigger a notification but currently does not
- [x] Ensure a notification is created (via `createNotification` or equivalent) for every one of the following events — each notification must include `type`, `actorId`, `actorName`, `actorAvatarUrl`, `targetContentId`, `targetContentType`, `targetContentTitle`, and a deep-link `url` field:
  - `followed` — someone follows you (triggered from `followUser` in `lib/firestore/follows.ts`)
  - `lesson_rated` — someone rates your lesson plan
  - `lesson_commented` — someone comments on your lesson plan
  - `resource_commented` — someone comments on your resource (N/A: no comments UI on resource page)
  - `forum_post_commented` — someone comments on your forum post
  - `comment_replied` — someone replies to your comment
  - `mentioned` — someone tags `@yourUsername` anywhere (post body, comment, reply)
  - `lesson_liked` — someone likes your lesson plan (N/A: no lesson like system; bookmarks don't have public owner info)
  - `resource_liked` — someone likes your resource
  - `inspiration_liked` — someone likes your inspiration post (N/A: no like system for inspiration)
  - `forum_post_liked` — someone likes your forum post (covered by upvote notification)
  - `lesson_downloaded` — someone downloads your lesson plan
  - `resource_downloaded` — someone downloads your resource
  - `lesson_shared` — someone shares your lesson plan
  - `resource_shared` — someone shares your resource
- [x] Each notification document must not be created when the actor and the content owner are the same user (no self-notifications)
- [x] In `NotificationDropdown` and/or the `/notifications` page, render a human-readable sentence for each notification type, e.g. "**Alex** followed you", "**Maria** commented on **Introduction to Fractions**"
- [x] Each notification item links to the relevant content via the `url` field
- [x] Mark notifications as read when the dropdown is opened or the `/notifications` page is visited (batch update `isRead: true`)
- [x] Update Firestore security rules: `notifications/{uid}/items/{notifId}` — only the owning `uid` may read or update their notifications; writes come from trusted paths (server actions or rules-validated client writes)
- [x] Implement `@mention` detection: when saving a post, comment, or reply that contains `@username` tokens, resolve each username to a `uid` and create a `mentioned` notification for each unique mentioned user (excluding the author)

**Acceptance Criteria**
- [x] AC-1: Following an educator creates a `followed` notification in their notifications feed immediately
- [x] AC-2: Rating, commenting on, liking, downloading, and sharing a lesson plan each create the correct notification type for the lesson author
- [x] AC-3: Replying to a comment creates a `comment_replied` notification for the comment author (not for the content owner, unless they are the same person)
- [x] AC-4: Mentioning `@username` in a post or comment creates a `mentioned` notification for that user
- [x] AC-5: No notification is created when a user interacts with their own content (self-interaction)
- [x] AC-6: Each notification in the dropdown or notifications page renders a human-readable sentence and a clickable link to the relevant content
- [x] AC-7: Opening the notifications dropdown marks all visible notifications as read; the unread badge count updates to reflect this

---

### US-19: Lesson Plan Preview Modal and PDF Copyright Footer

**As an** educator, **I want** to preview a lesson plan in full before downloading it and see a copyright notice on the export, **so that** I know exactly what will be downloaded and my authorship is clearly attributed.

**Tasks**
- [x] Add a **"Preview"** button to the lesson plan view page (`/lesson-builder/[id]`) and to any lesson card that has a download action
- [x] Clicking Preview opens a full-screen modal (or navigates to `/lesson-builder/[id]/preview`) showing a read-only, print-friendly layout of the lesson plan — identical structure to the PDF output
- [x] The preview modal has two action buttons in a sticky header/footer: **"Download PDF"** and **"Print"**; Print calls `window.print()` targeting only the preview content
- [x] Update `components/lessons/LessonPDFDocument.tsx` to include a copyright footer on every page: "© [year] [Author Display Name] — All rights reserved. Created on EduConnect."
- [x] The preview page/modal renders the same copyright footer at the bottom of the content so WYSIWYG matches the PDF exactly
- [x] Add a short IP ownership notice on the lesson plan view page (not inside the preview): "The content of this lesson plan is the intellectual property of [Author Name]. All rights reserved." displayed as a subtle callout below the lesson metadata
- [x] The Preview modal is accessible: `role="dialog"`, `aria-modal="true"`, `aria-label="Lesson Plan Preview"`, focus trapped inside the modal while open, Escape closes it
- [x] The Print stylesheet (`@media print`) hides the modal chrome (header, close button, action buttons) and shows only the lesson content and copyright footer

**Acceptance Criteria**
- [x] AC-1: Clicking "Preview" on a lesson plan opens a full-screen, read-only view of the lesson content
- [x] AC-2: The preview displays a copyright footer: "© [year] [Author Name] — All rights reserved. Created on EduConnect."
- [x] AC-3: Clicking "Download PDF" from the preview triggers the same PDF download as before, and the downloaded PDF includes the copyright footer on every page
- [x] AC-4: Clicking "Print" from the preview opens the browser print dialog; the printed output contains only lesson content and the copyright footer, with no modal UI chrome
- [x] AC-5: Pressing Escape closes the preview modal and returns focus to the element that triggered it
- [x] AC-6: The lesson view page displays the IP ownership notice as a callout below the lesson metadata; it does not appear inside the preview modal itself

---

### US-20: Account Management Page

**As an** educator, **I want** a dedicated Account Management page where I can change my password, view my account details, and delete my account if needed, **so that** I have full control over my account security and data.

**Tasks**
- [x] Rename all references to the current "Settings" page/link to "Account Management" across the codebase (`Navbar`, `Sidebar`, `Footer`, route file names if applicable)
- [x] Create or update the Account Management page at `/profile` (or a new `/account` route) with the following sections:
  - **Account Details**: read-only display of current email address and account creation date
  - **Display Name**: editable text field with a Save button (updates Firebase Auth `displayName` and the Firestore `users/{uid}` document)
  - **Current Tier**: read-only badge showing "Free" or "Plus" with a "Upgrade to Plus" link for free-tier users
  - **Change Password**: form with three fields — Current Password, New Password (min 8 chars, at least one number and one letter), Confirm New Password; submits via `reauthenticateWithCredential` then `updatePassword` from Firebase Auth
  - **Danger Zone**: "Delete Account" button (red, outlined) that opens `ConfirmDialog` (US-22) with a two-step warning; on confirmation, deletes all user data from Firestore (`users/{uid}` and subcollections) then calls `deleteUser` from Firebase Auth and redirects to `/`
- [x] Change Password form validation: New Password and Confirm New Password must match; New Password must differ from Current Password; show inline field-level errors
- [x] Reauthentication errors (wrong current password) must surface as a human-readable field error, not a raw Firebase error code
- [x] After a successful password change, show a success toast and clear all three password fields
- [x] After successful account deletion, clear any auth state and local storage, then redirect to the landing page

**Acceptance Criteria**
- [x] AC-1: The nav/sidebar link previously labelled "Settings" now reads "Account Management" everywhere in the UI
- [x] AC-2: The Account Management page displays the user's email address and account creation date as read-only fields
- [x] AC-3: Submitting the Change Password form with a correct current password and a valid new password updates the Firebase Auth password and shows a success toast
- [x] AC-4: Submitting the Change Password form with an incorrect current password shows a field-level error "Current password is incorrect" without exposing Firebase error codes
- [x] AC-5: The Danger Zone "Delete Account" button opens a confirmation dialog before taking any action; cancelling leaves the account intact
- [x] AC-6: Confirming account deletion removes the user's Firestore documents and Firebase Auth account, then redirects to the landing page (`/`)
- [x] AC-7: The tier badge correctly shows "Free" or "Plus" based on the user's Firestore `tier` field

---

### US-21: Edit Profile Page

**As an** educator, **I want** a dedicated Edit Profile page where I can update my public-facing information, **so that** my profile accurately represents me to the community.

**Tasks**
- [x] Create `app/(main)/profile/edit/page.tsx` (the directory stub already exists); build a form with the following fields: Display Name (text, required), Bio (textarea, max 500 chars with live counter), Profile Photo (file upload — JPEG/PNG only, max 2 MB; upload to Firebase Storage at `avatars/{uid}`; show preview before saving), Subject Specialisms (multi-select or tag input using existing `Tag` component), Grade Levels Taught (multi-select), School / Organisation (text, optional)
- [x] On save, write updated fields to `users/{uid}` in Firestore; update Firebase Auth `displayName` and `photoURL` if those fields changed
- [x] Validate file type and size client-side before uploading; reject unsupported types with a field error "Only JPEG and PNG files are allowed"
- [x] Show an upload progress indicator while the photo is uploading to Firebase Storage; disable the Save button during upload
- [x] After a successful save, show a success toast "Profile updated" and redirect to `/profile` (the read-only public profile page)
- [x] The Edit Profile page is linked from the public profile page (`/profile`) via an "Edit Profile" button visible only to the profile owner
- [x] Update Firestore security rules to allow `users/{uid}` updates only from the owning authenticated user; disallow client-side writes to `tier`, `createdAt`, or `role` fields
- [x] Add Firebase Storage security rules: `avatars/{uid}/**` — write allowed only for the owning authenticated user; max file size 2 MB enforced in rules (`request.resource.size < 2 * 1024 * 1024`)

**Acceptance Criteria**
- [x] AC-1: Navigating to `/profile/edit` shows a form pre-filled with the current user's display name, bio, subject specialisms, grade levels, and school/organisation
- [x] AC-2: Uploading a new profile photo shows a preview and an upload progress indicator; the photo is saved to Firebase Storage and the URL is written to Firestore and Firebase Auth
- [x] AC-3: Uploading a file that is not a JPEG or PNG shows a field error and does not begin the upload
- [x] AC-4: Uploading a file larger than 2 MB shows a field error and does not begin the upload
- [x] AC-5: Saving the form with valid data updates `users/{uid}` in Firestore, shows a success toast, and redirects to `/profile`
- [x] AC-6: The "Edit Profile" button on `/profile` is visible only to the profile owner; other users do not see it
- [x] AC-7: A direct Firestore write attempting to change the `tier` or `role` field is rejected by security rules

---

### US-22: Reusable ConfirmDialog Component

**As a** developer (and as a user), **I want** every destructive or sensitive action to trigger a consistent confirmation dialog, **so that** accidental data loss is prevented and the UX is predictable across the platform.

**Tasks**
- [x] Create `components/ui/ConfirmDialog.tsx` — a modal dialog component accepting props: `isOpen: boolean`, `onClose: () => void`, `onConfirm: () => void`, `title: string`, `description: string`, `confirmLabel?: string` (default "Confirm"), `cancelLabel?: string` (default "Cancel"), `isDestructive?: boolean` (default `true`), `isLoading?: boolean`
- [x] When `isDestructive` is `true`, the Confirm button uses red/destructive styling; when `false`, it uses the primary style
- [x] When `isLoading` is `true`, the Confirm button shows a spinner and is disabled; the Cancel button is also disabled to prevent concurrent actions
- [x] The dialog always shows the `title` as a heading, `description` as body text, and the two action buttons
- [x] The dialog is accessible: `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby` pointing to the title, `aria-describedby` pointing to the description; focus is trapped inside while open; Escape triggers `onClose`
- [x] Export `ConfirmDialog` from `components/ui/index.ts`
- [x] Replace all existing ad-hoc confirmation prompts (`window.confirm`, inline modal JSX for deletion) across the codebase with this component:
  - Delete comment / reply (US-16)
  - Delete forum post, lesson, resource, inspiration post (US-17)
  - Sign out (in `Navbar` or wherever sign-out is triggered)
  - Delete account (US-20)
  - Overwrite AI-generated content (the existing dialog in the lesson wizard — replace with `ConfirmDialog` if it uses a custom implementation)

**Acceptance Criteria**
- [x] AC-1: `ConfirmDialog` renders a dialog with the provided title, description, Cancel button, and Confirm button
- [x] AC-2: When `isDestructive` is `true`, the Confirm button has red/destructive styling; when `false`, it has primary styling
- [x] AC-3: Clicking Confirm calls `onConfirm`; clicking Cancel or pressing Escape calls `onClose`
- [x] AC-4: When `isLoading` is `true`, both buttons are disabled and the Confirm button shows a spinner
- [x] AC-5: Focus is trapped inside the dialog while it is open; the first interactive element (Cancel or Confirm) receives focus on open
- [x] AC-6: The sign-out action in the navigation uses `ConfirmDialog` before calling Firebase `signOut`
- [x] AC-7: No `window.confirm` calls remain in the codebase for destructive actions

---

### US-23: Intellectual Property Notices

**As an** educator, **I want** to see a clear, tasteful IP notice on lesson plans, resources, and inspiration posts, **so that** I and other educators understand that content ownership stays with the author.

**Tasks**
- [x] Create a reusable `IPNotice` component (`components/ui/IPNotice.tsx`) that renders a small, non-intrusive callout: "The content shared by educators on EduConnect remains the intellectual property of its author." with a link to the relevant section of the Terms of Service page
- [x] Render `IPNotice` on:
  - Individual lesson plan view pages (`/lesson-builder/[id]`)
  - Individual resource view pages (`/resources/[id]`)
  - Individual inspiration post view pages (if a detail page exists; otherwise on the inspiration feed card expanded view)
- [x] Style the notice as subtle secondary text (e.g. small font, muted colour, info icon) positioned near the bottom of the content card — it must not compete visually with the main content
- [x] Verify that `app/(main)/terms/page.tsx` mentions author IP ownership; if it does not, add a short "Content Ownership" section stating that educators retain full ownership of the content they publish on EduConnect
- [x] Verify that `app/(main)/privacy/page.tsx` is consistent with the IP ownership statement; add or update content if needed
- [x] The notice must be accessible: the link inside it has a descriptive `aria-label`; the callout is not hidden from screen readers

**Acceptance Criteria**
- [x] AC-1: An IP notice callout is visible at the bottom of every individual lesson plan view page
- [x] AC-2: An IP notice callout is visible at the bottom of every individual resource view page
- [x] AC-3: An IP notice callout is visible on inspiration post detail/expanded views
- [x] AC-4: The notice links to the Terms of Service page and the link is keyboard-navigable with a descriptive label
- [x] AC-5: The Terms of Service page contains a "Content Ownership" section stating that educators retain IP over their published content
- [x] AC-6: The notice is visually unobtrusive — it uses small, muted styling and does not obscure or compete with the primary content

---

### US-24: Public Landing Page for Unauthenticated Visitors

**As an** unauthenticated visitor, **I want** to land on an engaging, informative page when I visit the site, **so that** I understand what EduConnect offers and am motivated to sign up or sign in.

**Tasks**
- [x] Create a new landing page component rendered at `/` for unauthenticated users (the route logic is handled in US-25)
- [x] The landing page is a server component (or static page) — no Firebase Auth checks required; it must not import `AuthContext`
- [x] **Hero section**: full-width banner with tagline (e.g. "Where Great Teachers Connect"), a one-sentence value proposition, and two CTA buttons: "Sign In" (links to `/auth/login`) and "Get Started Free" (links to `/auth/signup`)
- [x] **Features section**: highlight 4–5 platform features (Lesson Builder, AI Assistant, Forums, Resource Library, Community) using icon + heading + short description cards arranged in a responsive grid
- [x] **Social proof section**: display 2–3 static (hardcoded) example content preview cards — a sample lesson plan card, a sample forum post, a sample resource — styled identically to their real counterparts but non-interactive (no click actions, no auth-gated data)
- [x] **Footer**: consistent with the existing site footer; includes links to About, Blog, Careers, Terms, Privacy, and Contact pages
- [x] Tone is warm, encouraging, and professional — "teacher energy"; avoid corporate jargon
- [x] The landing page is fully responsive (320 px to 1440 px), meets WCAG 2.1 AA contrast requirements, and has no horizontal scroll at any breakpoint
- [x] The landing page is statically renderable (no `use client` at the page level unless required for a minor interaction); add `export const dynamic = 'force-static'` or equivalent if appropriate

**Acceptance Criteria**
- [x] AC-1: Unauthenticated users visiting `/` see the landing page with the hero, features, social proof, and footer sections — not the authenticated home feed
- [x] AC-2: The hero section displays "Sign In" and "Get Started Free" CTA buttons that navigate to `/auth/login` and `/auth/signup` respectively
- [x] AC-3: The features section displays at least four platform features, each with an icon, heading, and description, in a responsive grid
- [x] AC-4: The social proof section shows at least two non-interactive example content cards
- [x] AC-5: The landing page passes a basic accessibility check: all images have `alt` text, colour contrast meets 4.5:1 for body text, and all interactive elements are keyboard-navigable
- [x] AC-6: The page renders without errors when Firebase Auth is not initialised (no auth-gated imports at the top level)
- [x] AC-7: On a 320 px viewport there is no horizontal scroll and all content is readable

---

### US-25: Route Restructuring — Home Feed at `/home`, Landing Page at `/`

**As an** authenticated educator, **I want** to be redirected to `/home` when I sign in, and as an unauthenticated user **I want** any protected route to redirect me to `/` rather than `/auth/login`, **so that** the routing is intuitive and the landing page is always the entry point for new visitors.

**Tasks**
- [x] Move the authenticated home feed from `app/(main)/page.tsx` to `app/(main)/home/page.tsx`; ensure this page still requires authentication and renders the same content as before
- [x] Update `app/(main)/page.tsx` to serve the landing page (US-24) for unauthenticated users and redirect authenticated users to `/home` using a server-side redirect (`redirect('/home')` from `next/navigation` after checking the session)
- [x] Search the entire codebase for all internal `href="/"` and `router.push('/')` references that point to the home feed and update them to `/home` (this includes `Navbar` logo link, post-login redirects, "Go home" links in error pages, etc.)
- [x] Update the post-login redirect in `app/(auth)/auth/login/page.tsx` (and signup) to redirect to `/home` instead of `/` after successful authentication
- [x] Update the auth guard / middleware so that unauthenticated users visiting any protected route are redirected to `/` (the landing page) instead of `/auth/login`; the landing page's CTA buttons already link to `/auth/login`, so the user can still sign in
- [x] Update the `Navbar` logo link from `href="/"` to `href="/home"` for authenticated users; keep `href="/"` for unauthenticated users (they should return to the landing page)
- [x] Verify that `next.config.ts` (or middleware) does not cache the `/` route for authenticated sessions in a way that would serve the landing page to signed-in users
- [x] Update any `redirect` calls in Firestore-protected server components that currently send to `/auth/login` and change them to send to `/`

**Acceptance Criteria**
- [x] AC-1: An authenticated user visiting `/` is immediately redirected to `/home`; the home feed renders at `/home` with all existing functionality intact
- [x] AC-2: An unauthenticated user visiting `/` sees the landing page (US-24); they are not redirected to `/auth/login`
- [x] AC-3: An unauthenticated user visiting a protected route (e.g. `/lesson-builder`) is redirected to `/` (the landing page), not `/auth/login`
- [x] AC-4: After a successful sign-in, the user is redirected to `/home`, not `/`
- [x] AC-5: After a successful sign-up, the user is redirected to `/home`, not `/`
- [x] AC-6: The `Navbar` logo link navigates to `/home` for authenticated users and to `/` for unauthenticated users
- [x] AC-7: No internal link in the codebase incorrectly points to `/` when intending to navigate to the authenticated home feed
