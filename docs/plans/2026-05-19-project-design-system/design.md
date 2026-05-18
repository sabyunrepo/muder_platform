# Project-Wide Design System Rollout

## Goal

Expand the edit-page-only MMP editor DESIGN.md into a project-wide web design system. The rollout must provide stable light/dark/system mode, a reusable UI kit including modal/table/form patterns, and gradual migration of all pages with browser screenshot QA evidence.

## Visual Direction

The current MMP editor DESIGN.md tone is the source of truth. The target product feel is a clean creator-tool interface with Notion-inspired surfaces, restrained panels, clear hierarchy, explicit tokens, and consistent light/dark behavior.

This does not mean every page becomes an editor. It means every page uses the same visual grammar:

- semantic surfaces instead of ad hoc `slate-*` backgrounds
- muted but readable borders and panels
- compact operational density without clutter
- consistent focus-visible and disabled states
- shared modal/table/form interaction patterns
- light/dark/system behavior available across the app

## Architecture

### Layer 1: Tokens

`packages/ui-tokens` owns semantic design variables:

- background: canvas, surface, surface-soft, elevated
- text: ink, charcoal, slate, steel, muted, inverse
- border: hairline, hairline-strong, focus
- accent: primary, pressed, subtle, on-primary
- status: success, warning, error, info
- overlays and shadows

`html[data-theme='light']` and `html[data-theme='dark']` provide concrete values. The stored preference may be `system`, but the DOM must only receive a resolved `light` or `dark` theme.

### Layer 2: Appearance Runtime

`apps/web/src/shared/appearance/` owns:

- `AppearanceProvider`
- `useAppearance`
- storage helpers
- system color-scheme subscription
- migration from the old editor-only storage key

The existing editor appearance hook becomes a compatibility wrapper or is replaced by the shared API.

### Layer 3: UI Kit

`apps/web/src/shared/components/ui/` owns reusable components:

- Button and IconButton
- Panel/Card/PageShell/SectionHeader
- Badge/Alert/EmptyState/LoadingState
- Modal/Dialog
- Table
- FormField/Input/Textarea/Select/Checkbox/Switch
- ThemeModeToggle

Components must use semantic tokens and expose accessibility props. They should not encode page-specific layout or editor-specific behavior.

### Layer 4: Page Migration

Pages migrate by group:

1. App shell and feedback surfaces
2. Creator/Admin/Shop/Profile
3. Lobby/Room/Social
4. Editor detail
5. Game runtime

Unmigrated pages may temporarily keep old styling. Migrated pages must be internally consistent before merge.

## Issue And PR Map

| Issue | PR Scope | Purpose                                      |
| ----- | -------- | -------------------------------------------- |
| #661  | Epic     | Tracks the complete rollout                  |
| #662  | PR-1     | Foundation: spec, tokens, appearance runtime |
| #663  | PR-2     | UI kit core: modal/table/form included       |
| #664  | PR-3     | App shell, toast, error/loading surfaces     |
| #665  | PR-4     | Creator/Admin/Shop/Profile migration         |
| #666  | PR-5     | Lobby/Room/Social migration                  |
| #667  | PR-6     | Editor detail integration                    |
| #668  | PR-7     | Game runtime full product-tone migration     |

## Merge Policy

Each group merges only after:

- group scope is complete
- light/dark/system behavior is verified
- UI kit usage is consistent within that group
- focused tests/typecheck pass or a narrow test gap is documented
- browser screenshots are captured for the required page matrix
- remaining visual debt is recorded

## Screenshot QA Matrix

Each page group PR must capture:

- desktop light
- desktop dark
- mobile light at about 390px width
- mobile dark at about 390px width
- at least one system-mode smoke where relevant

For authenticated or backend-dependent pages, the screenshot can use the accessible loaded state, auth fallback, or documented local seed state. The report must say which state was captured.

## Deferred Decisions

- Exact color values are finalized in #662 from the current editor DESIGN.md tokens.
- Exact UI kit component APIs are finalized in #663 after inventorying existing shared UI and call sites.
- Game runtime exceptions are allowed only if documented in #668 with user-visible rationale, but the default is full visual unification.
