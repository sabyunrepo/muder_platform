---
name: mmp-editor-uzu-briefing
description: Use when designing, reviewing, or implementing MMP Phase 24 editor features, especially character, clue, location, phase, ending, role sheet, information delivery, or creator workflow changes that should reference Uzu studio docs and MMP's own editor direction.
---

# MMP Editor Uzu Briefing

## When
- Before changing MMP editor UX, entity screens, phase routing, ending rules, clue/location/character workflows, role sheets, or information delivery.
- Before presenting UI/API/data-model options for editor work.

## Do
1. Read project routing first:
   - `AGENTS.md`
   - `apps/web/AGENTS.md` for frontend work
   - `apps/server/AGENTS.md` for backend work
   - active `docs/plans/**/checklist.md` when present
2. Inspect Uzu references only enough for the current entity/workflow:
   - `docs/uzu-studio-docs`
3. Extract patterns, not a copy:
   - creator mental model
   - entity relation workflow
   - runtime progression logic
   - usability safeguards
4. Compare against MMP requirements:
   - multiplayer murder-mystery runtime
   - adapter-first frontend editor
   - backend engine as source of runtime truth
   - creator-facing UI that hides internal IDs and irrelevant config
5. Report with:
   - `원인`: why this design decision exists
   - `결과`: impact on creator/runtime/maintenance
   - `권장`: one recommended path and explicit deferrals

## Done
- The proposal names which Uzu pattern was referenced and how MMP intentionally differs.
- The UI keeps only creator-needed information visible.
- Mobile/responsive behavior is considered.
- Deferred entities are represented through clear adapter/engine interfaces, not hard-coded dead ends.

## Avoid
- Do not blindly clone Uzu behavior.
- Do not expose system codes, raw JSON, internal IDs, or debug-only fields to creators.
- Do not add over-general enterprise abstractions before Phase 24 needs them.
