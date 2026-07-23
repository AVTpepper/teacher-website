# VistaTeacher Design System (Phase 1)

Date: 2026-07-23
Scope: Shared visual and UX foundation only.

## Visual Principles

- Professional and calm over loud or decorative.
- Warm educator-centric tone using restrained teal, sage, and coral accents.
- Consistent focus treatment and spacing across public and authenticated surfaces.
- Surfaces should feel grounded, not floating.

## Token System

Defined in [app/globals.css](app/globals.css):

### Core semantic color roles

- Page background: `--page-background`, `--page-background-soft`
- Surface: `--surface`, `--surface-elevated`, `--surface-subtle`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`
- Borders: `--border`, `--border-strong`
- Brand: `--primary-*`, `--accent-*`, `--secondary-*`
- Status: `--success-*`, `--warning-*`, `--error-*`, `--info-*`
- Focus ring: `--focus-ring`

### Typography hierarchy

- Display/Page headline: `.type-page-title`
- Section heading: `.type-section-title`
- Card heading: `.type-card-title`
- Body text: base text + `.type-body-medium` where emphasis is needed
- Metadata: `.type-meta`

### Spacing and layout tokens

- Page width: `--page-max-width`
- Content gutters: `--page-gutter`
- Section spacing: `--section-gap`, `--section-gap-lg`
- Card padding: `--card-padding`, `--card-padding-lg`
- Form spacing: `--form-gap`
- Grid gap: `--grid-gap`
- Header height: `--header-height`

### Shape and depth

- Radius tokens: `--radius-sm` to `--radius-full`
- Shadows: `--shadow-card`, `--shadow-card-hover`
- Shared surface classes: `.surface-panel`, `.surface-panel-hover`

## Core Component Inventory

Updated or added shared components in [components/ui](components/ui):

- Buttons: [components/ui/Button.tsx](components/ui/Button.tsx)
- Form field primitives:
  - [components/ui/FormField.tsx](components/ui/FormField.tsx)
  - [components/ui/Input.tsx](components/ui/Input.tsx)
  - [components/ui/Textarea.tsx](components/ui/Textarea.tsx)
  - [components/ui/Select.tsx](components/ui/Select.tsx)
  - [components/ui/Checkbox.tsx](components/ui/Checkbox.tsx)
  - [components/ui/RadioGroup.tsx](components/ui/RadioGroup.tsx)
- Cards/surfaces: [components/ui/Card.tsx](components/ui/Card.tsx)
- Identity/tags/badges:
  - [components/ui/Avatar.tsx](components/ui/Avatar.tsx)
  - [components/ui/Badge.tsx](components/ui/Badge.tsx)
  - [components/ui/IdentityMeta.tsx](components/ui/IdentityMeta.tsx)
- States:
  - [components/ui/Skeleton.tsx](components/ui/Skeleton.tsx)
  - [components/ui/EmptyState.tsx](components/ui/EmptyState.tsx)
  - [components/ui/ErrorState.tsx](components/ui/ErrorState.tsx)
  - [components/ui/Spinner.tsx](components/ui/Spinner.tsx)
- Dialog/menu/feedback:
  - [components/ui/Modal.tsx](components/ui/Modal.tsx)
  - [components/ui/ConfirmDialog.tsx](components/ui/ConfirmDialog.tsx)
  - [components/ui/Dropdown.tsx](components/ui/Dropdown.tsx)
  - [components/ui/Toast.tsx](components/ui/Toast.tsx)
- Layout patterns:
  - [components/ui/PageLayout.tsx](components/ui/PageLayout.tsx)

## Button Conventions

Variants:
- `primary`
- `secondary`
- `outline`
- `ghost`
- `destructive`
- `link`

Sizes:
- `sm`
- `md`
- `lg`
- `icon`

States:
- default, hover, focus, active, disabled, loading
- loading uses overlay spinner to avoid layout shift

## Form Conventions

- Use `FormField` patterns via `Input`, `Textarea`, and `Select`.
- Labels are always associated with `id`.
- Errors map to `aria-invalid` and `aria-describedby`.
- Descriptions/helper text are optional.
- Character count is supported by `Textarea` (`showCharacterCount`).

## Card Conventions

Shared variants in `Card`:
- `standard`
- `interactive`
- `compact`
- `stat`
- `profile`
- `resource`
- `community`
- `job`

Behavior:
- restrained borders and shadows
- consistent hover elevation only where interactive

## Loading, Empty, and Error Conventions

- Use `Skeleton`, `CardSkeleton`, `ListSkeleton`, `PageSkeleton` for loading placeholders.
- Use `EmptyState` with a clear title, helpful explanation, and one relevant action.
- Use `ErrorState` with readable message and retry action when possible.

## Accessibility Rules

- All interactive controls include visible focus styles via `.focus-ring`.
- Touch targets are supported with `.touch-target` minimum sizing.
- Dialogs keep escape-to-close and focus trap behavior.
- Form fields use semantic labels and error associations.
- Reduced motion preferences remain respected for motion-heavy landing-only animations.

## Correct Usage Examples

- Page container + section + grid: `PageContainer`, `Section`, `ContentGrid`
- Two-column app layout: `TwoColumnLayout`
- Narrow auth forms: `NarrowFormLayout`
- Search/list zero states: `EmptyState`
- Recoverable failure state: `ErrorState`

## Deferred Components and Patterns

Deferred intentionally for later phases:
- Full Network/Messages navigation IA changes
- Discover-specific final educator card redesign
- Homepage hero/content redesign details
- Onboarding-specific composite form patterns
- Profile-specific rich portfolio layout refinements
- Messaging-specific toasts/menus linked to live events
