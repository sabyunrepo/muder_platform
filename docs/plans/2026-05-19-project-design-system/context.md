# Project Design System Rollout Context

Created: 2026-05-19

## Source

- OOO interview session: `interview_20260518_152126`
- Seed: `seed_f26837299441`
- Umbrella issue: https://github.com/sabyunrepo/muder_platform/issues/661
- Execution issues: #662, #663, #664, #665, #666, #667, #668
- Visual source of truth: expand the current MMP editor DESIGN.md tone from `docs/superpowers/specs/2026-05-01-phase-24-editor-redesign/design.md`

## Fixed Decisions

- All five success criteria are required:
  - visual consistency
  - stable light/dark/system mode
  - reusable shared UI kit
  - gradual migration of all pages
  - browser screenshot-based QA
- The current editor DESIGN.md tone becomes the project-wide visual standard.
- Existing page-specific slate/amber temporary styling can be replaced as each page group migrates.
- Game runtime also converges to the editor/product tone instead of keeping a separate immersive skin.
- PRs merge by completed group. A migrated group cannot merge without scope completion, light/dark/system stability, consistent UI kit usage, and screenshot QA evidence.
- Pages not yet scheduled may remain in the old style until their migration PR.

## Current Repo Facts

- Web stack: React 19, Vite, Tailwind CSS 4, Zustand, TanStack Query, `lucide-react`.
- Frontend rules live in `apps/web/AGENTS.md`.
- Global CSS imports `@mmp/ui-tokens` from `apps/web/src/index.css`.
- Existing token package: `packages/ui-tokens/src/`.
- Existing editor-only theme boundary:
  - `apps/web/src/features/editor/design-system/editorNotionTheme.css`
  - `apps/web/src/features/editor/design-system/useEditorAppearance.ts`
  - `apps/web/src/features/editor/design-system/editorDesignTokens.ts`
- Existing editor appearance is applied only to `/editor/:id` detail through `EditorPage.tsx`.
- `App.tsx` currently hardcodes the toast theme to dark.

## Non-Goals

- No backend API, database, or runtime game logic changes.
- No new external UI library.
- No direct `main` commits.
- No one-shot migration of every page in a single PR.
- No merge of visually migrated groups without browser screenshot evidence.
