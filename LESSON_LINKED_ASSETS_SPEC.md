# Lesson-Linked AI Assets Spec

## Summary

Add optional AI-generated teaching assets to the lesson builder so an author can generate a lesson plan together with linked draft resources. In v1, the supported linked assets are:

- Worksheet
- Rubric

The long-term shape should also support:

- Slides outline
- Student handout / resource
- Exit ticket

These assets are created as private drafts first, linked to the lesson draft, and may later be published to the public resource library without breaking their connection to the lesson.

## Product Goals

1. Reduce teacher follow-up work after AI lesson generation.
2. Keep teachers in control by previewing and approving generated output before it is saved.
3. Preserve a clean distinction between lesson drafts and public resource-library content.
4. Make linked assets discoverable from the lesson page while still publishable as standalone resources.
5. Keep the first version bounded: lesson + worksheet + rubric, with schema support for slides next.

## Non-Goals For V1

1. Full slide deck design generation.
2. Rich printable layout customization.
3. Bulk generation of many asset types in one run.
4. Independent AI asset generation from the manual resource upload page.
5. Automatic publishing of AI-generated assets.

## Free And Plus Limits

### V1 shipping limits

- Free:
  - Up to 1 linked AI asset per lesson generation.
  - Uses the same lesson AI request pool already enforced today.
  - Asset options available: Worksheet or Rubric.
- Plus:
  - Up to 2 linked AI assets per lesson generation in v1.
  - Asset options available: Worksheet and Rubric.
  - Support for richer prompt guidance through example text.

### Post-v1 target limits

- Free:
  - 1 linked asset per generation.
  - Lower monthly cap on linked asset generations.
- Plus:
  - 3 linked assets per generation.
  - Higher monthly cap.
  - Slides outline enabled.

## Teacher UX Flow

### AI lesson generation flow

1. User chooses `Create with AI Assistant`.
2. User enters topic, grade, subject, lesson goal, support needs, activity style, and optional context.
3. User optionally selects linked assets to generate with the lesson.
4. For each selected asset, user can either:
   - leave it blank and let AI generate fully, or
   - add a short example / direction for the asset.
5. AI returns:
   - lesson draft
   - optional linked asset drafts
6. User sees a review checkpoint before anything is saved.
7. User can:
   - use this draft
   - regenerate
   - edit inputs
8. On acceptance:
   - lesson draft is created
   - linked resources are created as private drafts
   - lesson stores links to those resource drafts
9. User lands in lesson review with the linked assets already attached.

### Linked asset management flow

1. Owner sees linked teaching assets on the lesson detail page.
2. Draft assets are clearly marked as drafts.
3. Owner can open a linked asset, edit it, and publish it later.
4. Public viewers only see linked assets that are published.

## Publish Rules

1. AI-generated linked assets are created as private drafts by default.
2. Private linked assets:
   - are visible to the resource author only
   - do not appear in public resource feeds
   - do not appear on other educators' public profiles
3. Publishing a linked asset makes it visible in:
   - public resource library
   - educator public profile
   - linked assets section on the public lesson page
4. Publishing a lesson does not automatically publish its linked assets.
5. Publishing a linked asset does not automatically publish its lesson.
6. The lesson-resource relationship remains after publish.

## Asset Types

### Worksheet

Use for guided practice, independent practice, warm-ups, exit tickets, or structured student responses.

### Rubric

Use for project, writing, presentation, lab, or discussion evaluation. Rubrics should prefer 3-5 criteria and clear performance descriptors.

### Slides Outline

Planned next. This should generate a structured presentation outline rather than visual slide design.

## Firestore Data Model

### Lessons

Add:

- `linkedResourceIds: string[]`

Purpose:

- lets a lesson discover its generated or manually linked assets without duplicating resource metadata

### Resources

Add:

- `isPublic: boolean`
- `sourceLessonId: string | null`
- `sourceLessonTitle: string | null`
- `generatedFromLesson: boolean`
- `contentSections: { heading: string; body: string }[]`
- `updatedAt: Timestamp | null`

Extend type support:

- add `rubric` to `ResourceType`
- keep `slides` for the planned slides-outline phase

Rationale:

- `isPublic` separates draft resources from library resources
- `sourceLessonId` keeps the durable link back to the lesson
- `contentSections` stores structured AI output so the app can render more than a flat description and produce a usable PDF

## Security Rules

Resources should no longer allow unconditional reads.

Target behavior:

- read allowed if `resource.data.isPublic == true`
- read allowed if authenticated owner
- create/update/delete allowed for owner as today

Lessons remain readable as currently modeled in this codebase, with draft privacy still primarily enforced in app behavior.

## V1 API Contract

### Lesson generate request

Allow optional:

- `assetRequests: Array<{ type: "worksheet" | "rubric"; example?: string }>`

### Lesson generate response

Return optional:

- `assets: Array<{ type: "worksheet" | "rubric"; title: string; description: string; sections: Array<{ heading: string; body: string }> }>`

## AI Prompting Rules

1. Assets must be grounded in the lesson objectives and steps.
2. Worksheet outputs should include actionable student work, not just teacher notes.
3. Rubrics should include criteria and concise performance descriptors.
4. If a teacher provides an example, the AI should imitate the structure and tone without copying it too literally.
5. Asset output should be usable as a saved draft without further normalization.

## UI Surfaces Affected

1. Lesson AI generate screen:
   - asset selection
   - example inputs
   - limit messaging
2. Lesson AI preview modal:
   - preview of requested linked assets
3. Lesson detail page:
   - linked teaching assets section
4. Resource detail page:
   - draft badge
   - linked lesson badge/link
   - structured content rendering
5. Resource upload/edit page:
   - draft / published visibility control

## Completion Boundary For This Feature Set

This feature set is considered complete when all of the following are true:

1. A teacher can optionally request a worksheet and/or rubric during AI lesson generation.
2. The AI returns those assets in the same generation flow.
3. Accepting the lesson creates linked draft resources.
4. The lesson can surface those linked assets.
5. Draft assets stay private until explicitly published.
6. Published linked assets appear in the public resource library and remain linked back to the lesson.

## Planned Next Feature After V1

Slides outline is the next strongest addition. It should ship as a structured outline with:

- slide title
- key talking points
- suggested visual or diagram
- optional teacher note

It should remain a text-first planning artifact, not a visual slide generator.