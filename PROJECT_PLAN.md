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
