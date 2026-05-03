---
name: mmp-adapter-engine-design
description: Use when designing or implementing MMP editor frontend adapters, backend runtime engines, entity migration, phase automation, or boundaries between creator-facing UI and game runtime behavior.
---

# MMP Adapter / Engine Design

## When
- When editor UI data differs from runtime behavior.
- When migrating character, clue, location, phase, ending, role sheet, or information delivery entities.
- When deciding what belongs in frontend adapter vs backend engine.

## Do
1. Separate responsibilities:
   - Frontend adapter: creator-friendly form state, validation hints, search/select UI, responsive layout, API payload mapping.
   - Backend engine: runtime truth, rule execution, phase transitions, clue effects, role/vote eligibility, entity deletion consistency.
2. Keep boundaries explicit:
   - UI should not know hidden engine implementation details.
   - Engine should not depend on UI labels/layout.
   - Shared contracts should be typed and versionable.
3. Migration approach:
   - preserve legacy data path until replacement is validated
   - add adapter mapping tests for old/new payloads
   - add engine tests for runtime decisions
   - add E2E coverage for creator workflows
4. Deletion/data consistency:
   - define backlinks and cascading cleanup in backend service layer
   - surface creator-safe warnings, not raw relation tables
5. Future entities:
   - expose minimal extension points now
   - avoid premature plugin systems unless current Phase 24 requires them

## Done
- Each new field has an owner: adapter, API contract, engine, or persistence.
- Runtime decisions are testable without rendering React.
- Creator workflows are testable through E2E or documented substitute coverage.
- Maintenance impact and deferred boundaries are documented in the active plan.

## Avoid
- Do not let frontend-only mock logic become runtime truth.
- Do not leak engine internals into creator UI.
- Do not migrate every entity in one risky PR unless explicitly approved.
