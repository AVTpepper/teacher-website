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

| #   | Name                    | Goal                                                              | User Stories                         |
|-----|-------------------------|-------------------------------------------------------------------|--------------------------------------|
| M1  | AI Lesson Plan Assistant | Add an AI assistant to the Lesson Builder that generates full lesson plans and suggests improvements to individual sections | US-01, US-02, US-03, US-04, US-05, US-06 |

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
