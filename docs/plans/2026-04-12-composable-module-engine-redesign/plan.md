# Plan — Composable Module Engine Redesign

집행 문서. 상세는 `refs/prs/pr-*.md` 참조.

## Wave Flow

```
W1 ×3  →  W2 ×2  →  W3 seq  →  W4 ×4  →  W5 seq  →  W6 ×2  →  W7 seq
A1-A3    A4-A5    A6→A7     B1-B4    T1→T2     C1,F1     V1
엔진기반  엔진교체  프리미티브  모듈마이그  템플릿     UI+장르    e2e
```

## PR Overview

| ID | Title | Wave | Deps | Scope |
|----|-------|------|------|-------|
| A1 | Module Core + Registry | W1 | - | engine/module*.go |
| A2 | EventBus Rewrite | W1 | - | engine/event_bus*.go |
| A3 | Audit Log Package | W1 | - | auditlog/** |
| A4 | PhaseEngine + 빅뱅 삭제 + 리네임 | W2 | A1,A2,A3 | engine/phase_engine*.go + legacy 삭제 |
| A5 | Validator Chain | W2 | A1 | engine/validator*.go |
| A6 | Clue Graph Primitive | W3 | A4 | clue/** |
| A7 | JSON Logic Rule Evaluator | W3 | A6 | engine/rule_evaluator*.go |
| B1 | cluedist 마이그 | W4 | A4,A7 | module/cluedist/** |
| B2 | decision 마이그 | W4 | A4,A7 | module/decision/** |
| B3 | progression+exploration 마이그 | W4 | A4 | module/progression/**, module/exploration/** |
| B4 | media+communication 마이그 | W4 | A4 | module/media/**, module/communication/** |
| T1 | Template Loader + Validator | W5 | A4,B1-B4 | template/loader*.go |
| T2 | 4 장르 N 프리셋 JSON | W5 | T1 | template/presets/** |
| C1 | L1 SchemaDrivenForm | W6 | T1 | apps/web/src/features/editor/** |
| F1 | CrimeScene 전용 모듈 | W6 | A4,A7 | module/crime_scene/** |
| V1 | e2e Smoke (4 장르) | W7 | all | e2e/** |

## Dependency DAG (topological)

```
           ┌─── A1 ───┐
           │          │
           ├─── A2 ───┤       ┌─── B1 ──┐
START ─────┼─── A3 ───┤       ├─── B2 ──┤
           │          │       │         │
           └─── A5 ───┤       ├─── B3 ──┤                ┌─── C1 ──┐
                      └── A4 ─┼─── B4 ──┼── T1 ── T2 ───┤         └── V1 ── END
                              │         │                └─── F1 ──┘
                              └── A6 ── A7 ──────────────────────┘
```

- A4 는 A1+A2+A3 모두 필요 (engine 전체 재배선)
- A7 은 A6 필요 (clue graph 위에서 룰 평가)
- B1/B2 는 A7 필요 (룰 평가기 사용)
- T1 은 A4+B1~B4 필요 (모듈 schema merge 하려면 모든 모듈 마이그 완료돼야)
- C1 은 T1 필요 (스키마 endpoint)
- F1 은 A4+A7 만 필요 (B 와 병렬 가능하지만 W6 에 배치해서 W4 결과 확인 후 진행)
- V1 은 전체 필요

## 실행 순서

1. `/plan-start docs/plans/2026-04-12-composable-module-engine-redesign`
2. `/plan-autopilot` — Wave 별 자동 실행
3. Wave 머지 전 user 승인 게이트 1회 (CLAUDE.md 규칙)
4. Fix-loop 최대 3회 → 초과 시 user 개입
