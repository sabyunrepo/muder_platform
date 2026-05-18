# Project Design System Rollout Checklist

## Status

- [x] OOO interview completed: `interview_20260518_152126`
- [x] Seed generated: `seed_f26837299441`
- [x] Umbrella issue created: #661
- [x] Execution issues created: #662, #663, #664, #665, #666, #667, #668
- [x] PR-1 foundation
- [x] PR-2 UI kit core
- [x] PR-3 app shell
- [ ] PR-4 creator/admin/shop/profile
- [ ] PR-5 lobby/room/social
- [ ] PR-6 editor detail
- [ ] PR-7 game runtime
- [ ] Final screenshot matrix and visual debt review

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

- [ ] Migrate Profile and PublicProfile surfaces.
- [ ] Migrate Shop and coin purchase surfaces.
- [ ] Migrate Creator dashboard/stats/earnings/settlements pages.
- [ ] Migrate Admin pages and review modal/form/table surfaces.
- [ ] Replace local buttons/cards/forms/tables/modals with UI kit where practical.
- [ ] Preserve existing auth/role/API behavior.
- [ ] Run focused tests and typecheck.
- [ ] Capture required screenshot matrix.

Merge gate:

- [ ] All pages in this group are internally consistent.
- [ ] Forms/tables/modals use UI kit unless a documented exception remains.
- [ ] Desktop/mobile light/dark screenshots exist.

## PR-5: Lobby, Room, Social (#666)

Goal: Migrate user-facing lobby, room, and social flows.

- [ ] Migrate Lobby page, theme cards, filters, and create-room flow.
- [ ] Migrate Room page states and action surfaces.
- [ ] Migrate Social page tabs/panels.
- [ ] Migrate voice surfaces that are visible in social/room contexts.
- [ ] Preserve realtime, auth, and API contracts.
- [ ] Run focused tests and typecheck.
- [ ] Capture required screenshot matrix.

Merge gate:

- [ ] Cards, filters, modals, and action buttons are consistent.
- [ ] Mobile layout has no overlap or horizontal scroll for core flows.
- [ ] Backend unavailable/auth fallback states are documented if used for screenshots.

## PR-6: Editor Detail Integration (#667)

Goal: Align `/editor/:id` with the project-wide design system while preserving editor UX decisions.

- [ ] Audit `mmp-editor-color-*` tokens against new semantic tokens.
- [ ] Replace color tokens that can safely use global semantics.
- [ ] Keep editor-only density/radius/shadow tokens where they remain editor-specific.
- [ ] Replace editor appearance toggle with shared appearance UI/API.
- [ ] Reduce legacy Tailwind bridge coverage where high-traffic tabs are migrated.
- [ ] Align MDX editor and rich content surfaces with global tokens.
- [ ] Run focused editor tests and typecheck.
- [ ] Capture overview, modules, flow, and mobile editor shell screenshots.

Merge gate:

- [ ] Editor appearance no longer conflicts with global appearance.
- [ ] Phase 24 layout and domain UX decisions are preserved.
- [ ] Scope-leak guard for editor-only CSS remains.

## PR-7: Game Runtime (#668)

Goal: Fully align game runtime with the project-wide editor/product tone.

- [ ] Audit GamePage runtime states.
- [ ] Audit voice overlay and bottom sheet states.
- [ ] Audit reading/player mock pages if still active.
- [ ] Migrate runtime surfaces toward the product-wide design system.
- [ ] Document any runtime-specific exceptions with user-visible rationale.
- [ ] Preserve realtime, WebSocket, auth, and game logic behavior.
- [ ] Run focused tests and typecheck.
- [ ] Capture required screenshot matrix.

Merge gate:

- [ ] Runtime screens feel like the same product UI.
- [ ] Connection, waiting, error, and result states remain clear.
- [ ] Mobile voice/game controls do not overlap.

## Final Review

- [ ] Build final screenshot matrix across migrated pages.
- [ ] Record remaining visual debt.
- [ ] Confirm no high-traffic page still depends on temporary slate/amber styling without a follow-up.
- [ ] Confirm issue #661 checklist is complete or has explicit follow-up issues.
