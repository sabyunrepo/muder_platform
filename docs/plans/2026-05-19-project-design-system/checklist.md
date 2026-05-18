# Project Design System Rollout Checklist

## Status

- [x] OOO interview completed: `interview_20260518_152126`
- [x] Seed generated: `seed_f26837299441`
- [x] Umbrella issue created: #661
- [x] Execution issues created: #662, #663, #664, #665, #666, #667, #668
- [x] PR-1 foundation
- [x] PR-2 UI kit core
- [x] PR-3 app shell
- [x] PR-4 creator/admin/shop/profile
- [x] PR-5 lobby/room/social
- [x] PR-6 editor detail
- [x] PR-7 game runtime
- [x] Final screenshot matrix and visual debt review

## PR-1: Foundation (#662)

Goal: Create the project-wide design system foundation.

- [x] Write project-wide design system spec from the editor DESIGN.md tone.
- [x] Add semantic light/dark variables to `packages/ui-tokens/src/colors.css`.
- [x] Create `apps/web/src/shared/appearance/`.
- [x] Implement `system | light | dark` preference and resolved `light | dark`.
- [x] Apply `html[data-theme]`, `html[data-theme-preference]`, and `color-scheme`.
- [x] Migrate or bridge old `mmp.editor.appearance` storage.
- [x] Remove hardcoded dark toast behavior in `App.tsx`.
- [x] Update editor appearance tests to use shared appearance.
- [x] Run focused tests and typecheck.
- [x] Capture initial screenshots for `/editor`, `/editor/:id`, and `/lobby` smoke states.

Merge gate:

- [x] No migrated root/foundation surface is visually broken in light or dark.
- [x] Invalid storage and unavailable storage fall back safely.
- [x] Screenshot evidence is attached to the PR.

## PR-2: UI Kit Core (#663)

Goal: Build the reusable UI kit, including modal/table/form.

- [x] Inventory existing shared UI components and raw modal/table/form patterns.
- [x] Define component API rules and variant naming.
- [x] Implement Button and IconButton.
- [x] Implement Panel/Card/PageShell/SectionHeader.
- [x] Implement Badge/Alert/EmptyState/LoadingState.
- [x] Implement Modal/Dialog with keyboard close and focus handling.
- [x] Implement Table with empty/loading/error states.
- [x] Implement FormField/Input/Textarea/Select/Checkbox/Switch.
- [x] Implement ThemeModeToggle using shared appearance.
- [x] Add component behavior tests.
- [x] Run focused tests and typecheck.
- [x] Capture UI kit preview screenshots if a preview surface is created; otherwise document that screenshot QA begins in PR-3.

Merge gate:

- [x] Modal, table, and form components cover real migration needs.
- [x] Components use semantic tokens, not page-specific color utilities.
- [x] Accessibility props and focus-visible states are covered.

## PR-3: App Shell And Feedback Surfaces (#664)

Goal: Convert global shell and feedback surfaces before page migrations.

- [x] Migrate `MainLayout`, `Sidebar`, and base layout wrappers.
- [x] Migrate `NetworkBanner`.
- [x] Migrate global/page/component error boundaries where they are product shell surfaces.
- [x] Migrate loading/suspense fallback surfaces.
- [x] Migrate toast styling to follow shared appearance.
- [x] Keep feature page internals out of scope unless needed for shell correctness.
- [x] Run focused tests and typecheck.
- [x] Capture `/lobby` shell desktop/mobile light/dark screenshots.

Merge gate:

- [x] Navigation and feedback surfaces are readable in light/dark.
- [x] Toast is not hardcoded to dark.
- [x] No page group migration is half-started.

Note: PR-3 keeps an explicit legacy content bridge for unmigrated feature page internals. PR-4/5 remove that bridge as page groups move to semantic tokens.

## PR-4: Creator/Admin/Shop/Profile (#665)

Goal: Migrate operational pages to the new UI kit and tokens.

- [x] Migrate Profile and PublicProfile surfaces.
- [x] Migrate Shop and coin purchase surfaces.
- [x] Migrate Creator dashboard/stats/earnings/settlements pages.
- [x] Migrate Admin pages and review modal/form/table surfaces.
- [x] Replace local buttons/cards/forms/tables/modals with UI kit where practical.
- [x] Preserve existing auth/role/API behavior.
- [x] Run focused tests and typecheck.
- [x] Capture required screenshot matrix.

Merge gate:

- [x] All pages in this group are internally consistent.
- [x] Forms/tables/modals use UI kit unless a documented exception remains.
- [x] Desktop/mobile light/dark screenshots exist.

Note: local E2E account is not an admin/creator, so admin and creator screenshot QA uses protected-route fallback evidence for light/dark while code-level tests cover the migrated surfaces. See PR `#672` local validation and `screenshots/design-system/665-*` artifacts for the fallback screenshots.

## PR-5: Lobby, Room, Social (#666)

Goal: Migrate user-facing lobby, room, and social flows.

- [x] Migrate Lobby page, theme cards, filters, and create-room flow.
- [x] Migrate Room page states and action surfaces.
- [x] Migrate Social page tabs/panels.
- [x] Migrate voice surfaces that are visible in social/room contexts.
- [x] Preserve realtime, auth, and API contracts.
- [x] Run focused tests and typecheck.
- [x] Capture required screenshot matrix.

Merge gate:

- [x] Cards, filters, modals, and action buttons are consistent.
- [x] Mobile layout has no overlap or horizontal scroll for core flows.
- [x] Backend unavailable/auth fallback states are documented if used for screenshots.

Note: #666 screenshot QA uses authenticated lobby/social pages and a `/room/nonexistent`
fallback state because the local fixture has no active room at capture time. Realtime,
auth, and backend API contracts were intentionally left unchanged.

## PR-6: Editor Detail Integration (#667)

Goal: Align `/editor/:id` with the project-wide design system while preserving editor UX decisions.

- [x] Audit `mmp-editor-color-*` tokens against new semantic tokens.
- [x] Replace color tokens that can safely use global semantics.
- [x] Keep editor-only density/radius/shadow tokens where they remain editor-specific.
- [x] Replace editor appearance toggle with shared appearance UI/API.
- [x] Reduce legacy Tailwind bridge coverage where high-traffic tabs are migrated.
- [x] Align MDX editor and rich content surfaces with global tokens.
- [x] Run focused editor tests and typecheck.
- [x] Capture overview, modules, flow, and mobile editor shell screenshots.

Merge gate:

- [x] Editor appearance no longer conflicts with global appearance.
- [x] Phase 24 layout and domain UX decisions are preserved.
- [x] Scope-leak guard for editor-only CSS remains.

Note: PR-6 keeps the editor-specific radius, spacing, density, and shadow tokens while
color aliases now resolve through project-wide `--mmp-color-*` semantic tokens. Screenshot
evidence is stored in `screenshots/design-system/667-*`.

## PR-7: Game Runtime (#668)

Goal: Fully align game runtime with the project-wide editor/product tone.

- [x] Audit GamePage runtime states.
- [x] Audit voice overlay and bottom sheet states.
- [x] Audit reading/player mock pages if still active.
- [x] Migrate runtime surfaces toward the product-wide design system.
- [x] Document any runtime-specific exceptions with user-visible rationale.
- [x] Preserve realtime, WebSocket, auth, and game logic behavior.
- [x] Run focused tests and typecheck.
- [x] Capture required screenshot matrix.

Merge gate:

- [x] Runtime screens feel like the same product UI.
- [x] Connection, waiting, error, and result states remain clear.
- [x] Mobile voice/game controls do not overlap.

Note: #668 documents game runtime as the one scoped exception to app-wide
light/dark following. Runtime uses `mmp-runtime-boundary` with project semantic
token names aliased to an immersive dark palette. Browser evidence is stored in
`screenshots/design-system/668-*`; voice overlay and bottom sheet behavior are
covered by focused component tests that validate runtime boundary semantics.
These design-system-migrated components are ready for integration into game
routes when voice features are activated.

## Final Review

- [x] Build final screenshot matrix across migrated pages.
- [x] Record remaining visual debt.
- [x] Confirm no high-traffic page still depends on temporary slate/amber styling without a follow-up.
- [x] Confirm issue #661 checklist is complete or has explicit follow-up issues.

Final evidence:

- Execution issues #662, #663, #664, #665, #666, #667, and #668 are closed.
- Screenshot evidence is stored under `screenshots/design-system/662-*` through
  `screenshots/design-system/668-*`, covering foundation smoke states, UI kit
  preview, app shell, creator/admin/shop/profile, lobby/room/social, editor
  detail, and game runtime boundary.
- Final visual debt scan still finds raw `slate`/`amber` utility usage in
  runtime/prototype or secondary surfaces, notably game subcomponents under the
  immersive runtime boundary, reading mock/editor helpers, and account settings
  secondary controls. These are not treated as blockers for the global app shell
  rollout because the migrated high-traffic page groups now have semantic-token
  shell coverage and screenshot evidence. Future runtime deep-polish should stay
  scoped to runtime components instead of reopening the project-wide design
  system epic.
