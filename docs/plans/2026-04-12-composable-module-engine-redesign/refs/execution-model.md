# Execution Model (Wave DAG)

## Wave 구조 (7 waves · 15 PRs)

```
┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐      ┌─────────┐
│ Wave 1  │      │ Wave 2  │      │ Wave 3  │      │ Wave 4  │      │ Wave 5  │      │ Wave 6  │      │ Wave 7  │
│ ×3      │ ───→ │ ×2      │ ───→ │ seq     │ ───→ │ ×4      │ ───→ │ seq     │ ───→ │ ×2      │ ───→ │ seq     │
│ A1 A2 A3│      │ A4 A5   │      │ A6→A7   │      │B1 B2 B3 │      │ T1→T2   │      │ C1 F1   │      │ V1      │
│         │      │         │      │         │      │B4       │      │         │      │         │      │         │
└─────────┘      └─────────┘      └─────────┘      └─────────┘      └─────────┘      └─────────┘      └─────────┘
 엔진기반         엔진교체         프리미티브        모듈마이그        템플릿시스템       UI+CrimeScene   e2e 검증
```

## Dependency DAG

```
                ┌── A1 ──┐
                │        │
START ──────────┼── A2 ──┼──┐
                │        │  │
                ├── A3 ──┤  ├── A4 ──┬── A6 ── A7 ──┬── B1 ──┐
                │        │  │       │               │       │
                └── A5 ──┘  └───────┤               ├── B2 ──┤
                                    │               │       │
                                    │               ├── B3 ──┤── T1 ── T2 ──┬── C1 ──┐
                                    │               │       │               │       │
                                    │               └── B4 ──┘               └── F1 ──┴── V1 ── END
                                    │
                                    └── (A4 direct) ───────────────────────── F1
```

### 의존성 근거

- **A1/A2/A3 병렬 OK** — 3 PR 모두 독립. A2 가 `GameEvent` 타입만 공유하나 임시로 `any` 또는 자체 placeholder 로 작성 가능, 최종 rebase 시 A1 타입 import
- **A4 = A1+A2+A3** 전체 필요 — PhaseEngine 이 Module/EventBus/AuditLog 모두 wire
- **A5 = A1 만** 필요 — Validator 는 `Module.GetConfigSchema()` 만 참조
- **A6 선 → A7** 순차 — RuleEvaluator 가 ClueGraph 위에서 동작
- **B1/B2 = A4+A7** — 마이그 시 RuleProvider 인터페이스 구현 필요
- **B3/B4 = A4 만** — Timer/Media/Chat 은 룰 평가 불필요
- **T1 = A4+B1~B4** — 모든 모듈이 새 인터페이스로 마이그돼야 schema merge 가능
- **T2 = T1** — presets 가 loader 통과해야 함
- **C1 = T1** — 프론트가 `GET /schema` endpoint 호출
- **F1 = A4+A7** — B 와 병렬 가능하나 W6 에 배치 (W4 결과 확인 후 CrimeScene 전용 로직 시작)
- **V1 = all** — 전체 통합

## Wave 1 병렬 안전성

**A1 ↔ A2 soft conflict**: `GameEvent` 타입이 양쪽에서 필요. 해결 전략:
- A1 이 `engine/module_types.go` 에서 canonical 정의
- A2 worktree 는 임시로 자체 type alias 로 작성하거나 A1 PR 먼저 머지 후 rebase
- 머지 순서 `A1 → A2 → A3` 로 강제

**A1 ↔ A3 conflict**: 없음 (auditlog 는 engine/ 밖)
**A2 ↔ A3 conflict**: 없음

## Wave 4 병렬 안전성

**B1/B2/B3/B4** 모두 서로 다른 모듈 패키지 (`cluedist/`, `decision/`, `progression+exploration/`, `media+communication/`) 를 건드림. 충돌 없음.

공통 의존성: 4 PR 모두 `engine.Module` 인터페이스 참조 — A4 에서 이미 리네임 완료돼야 함.

## Wave 6 병렬 안전성

**C1 (프론트) ↔ F1 (백엔드 crime_scene)**: 완전히 다른 디렉터리. 충돌 불가.

## Fix-loop 정책

- Wave 별 자동 실행 후 PR fail → 최대 **3회** retry (plan-autopilot default)
- 3회 초과 → user 개입 요청
- Wave 머지 전 **user 승인 1회 게이트** 필수 (CLAUDE.md 규칙)

## Worktree 정책

- **W1, W4, W6** — `isolation: "worktree"` 필수 (병렬 PR)
- **W2** — 2병렬이지만 A4 가 engine/ 대량 삭제 → worktree 필수, A5 도 worktree
- **W3, W5, W7** — 순차, worktree 선택 (권장 yes)

## Review 병렬화

각 Wave 머지 직전 **4 병렬 리뷰어** (CLAUDE.md 규칙):
- security reviewer
- performance reviewer
- architecture reviewer
- test-coverage reviewer
