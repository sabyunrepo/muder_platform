# Phase 9.0 — Editor + Engine Redesign (실행 계획)

> 부모: [design.md](design.md) | 상위 설계: [specs](../../superpowers/specs/2026-04-10-editor-engine-redesign/design.md)

---

## 전체 구조 (7 Phase, 40+ PRs)

```
Phase A (엔진 코어) ──→ Phase B (MM 장르) ──→ Phase C (에디터 L1) ← MVP
                                                   │
                                                   ▼
                                             Phase D (에디터 L2)
                                                   │
                                                   ▼
                                             Phase E (에디터 L3) [stretch]
                                                   │
                                                   ▼
                                             Phase F (CS 장르 + 검증)
                                                   │
                                                   ▼
                                             Phase G (추가 장르)
```

| Phase | 이름 | PR 수 | 병렬 | 선행 | 산출물 |
|-------|------|-------|------|------|--------|
| A | 엔진 코어 | 7 | W1(3병렬)+W2(2순차)+W3(2병렬) | 없음 | GenrePlugin, PhaseEngine, EventBus, AuditLog, Clue, RuleEvaluator |
| B | MurderMystery | 5 | 순차 | A | 첫 번째 장르 E2E |
| C | 에디터 L1 | 7 | W1(2)+W2(4병렬)+W3(1) | 없음 | Template Studio MVP |
| D | 에디터 L2 | 7 | W1(2)+W2(1)+W3(3병렬)+W4(1) | C | Phase Timeline |
| E | 에디터 L3 | 4 | 순차 | D | Visual Node Editor [stretch] |
| F | CrimeScene | 4 | W1(2병렬)+W2(2순차) | B,E | 두 번째 장르 + 아키텍처 검증 |
| G | 추가 장르 | 5 | W1(2병렬)+W2(2병렬)+W3(1) | F | ScriptKill + Jubensha |

**병렬 실행**: Agent tool `isolation: "worktree"` — 각 병렬 에이전트가 자체 git worktree에서 작업, 파일 충돌 원천 차단.

---

## Phase A: 엔진 코어 (7 PRs, 3 Waves)

> 상세: [refs/phase-a-engine-core.md](refs/phase-a-engine-core.md)

| Wave | PR | 내용 | 의존 |
|------|-----|------|------|
| W1 | A1 | GenrePlugin Core + Optional 인터페이스 + Registry | 없음 |
| W1 | A2 | EventBus (EventListener interface) | 없음 |
| W1 | A3 | Audit Log (PG append-only + Redis→PG snapshot) | 없음 |
| W2 | A4 | PhaseEngine (stateless wrapper, qmuntal/stateless) | A1 |
| W2 | A5 | EventProcessor chain (검증+처리+사이드이펙트) | A1+A2+A4 |
| W3 | A6 | Clue System (Graph + Validator + VisibilitySpec) | 없음 |
| W3 | A7 | Rule Evaluator (diegoholiveira/jsonlogic) | 없음 |

### Phase 8.0 마이그레이션
- **유지**: Session Actor, SessionManager, Hub, Client, Router, BaseModuleHandler, LifecycleListener, ReconnectBuffer
- **제거**: GameProgressionEngine, Module interface, ProgressionStrategy(3종), ActionDispatcher
- **재작성**: EventBus (EventListener), Registry, types.go

---

## Phase B: Murder Mystery 장르 (5 PRs, 순차)

> 상세: [refs/phase-b-murder-mystery.md](refs/phase-b-murder-mystery.md)

| PR | 내용 | 의존 |
|----|------|------|
| B1 | MurderMysteryPlugin 골격 + ConfigSchema | A1 |
| B2 | StartingClue + RoundClue 배포 | B1 |
| B3 | ConditionalClue (선행 조건 + 연쇄 반응) | B1+A6 |
| B4 | Voting + Accusation 통합 | B1 |
| B5 | PhaseHooks + CheckWin + 직렬화 + E2E | B2+B3+B4 |

### E2E 테스트: "6인 플레이어, 3라운드, 탐정이 범인 지목"

---

## Phase C: 에디터 Layer 1 (7 PRs, 3 Waves) — MVP 출시

> 상세: [refs/phase-c-editor-l1.md](refs/phase-c-editor-l1.md)

| Wave | PR | 내용 | 의존 |
|------|-----|------|------|
| W1 | C1 | 3-column EditorLayout + UIStore 확장 | 없음 |
| W1 | C2 | GenreSelector + 프리셋 로드 | 없음 |
| W2 | C3 | SchemaDrivenForm (react-hook-form + zod) | 없음 |
| W2 | C4 | 캐릭터 CRUD (리팩토링 기존 CharactersTab) | 없음 |
| W2 | C5 | 단서 리스트 + 그래프 뷰 | C3 |
| W2 | C6 | 자동저장 + 버전 충돌 감지 | C1 |
| W3 | C7 | 장르 프리셋 API (백엔드) | C2 |

### 기존 에디터 재사용
- EditorLayout, CharactersTab, CharacterForm, useAutoSave, editorUIStore: 리팩토링
- Backend editor domain: 확장

---

## Phase D: 에디터 Layer 2 (7 PRs, 4 Waves)

> 상세: [refs/phase-d-editor-l2.md](refs/phase-d-editor-l2.md)

| Wave | PR | 내용 | 의존 |
|------|-----|------|------|
| W1 | D1 | React Flow 캔버스 (onlyRenderVisibleElements) | 없음 |
| W1 | D2 | PhaseNode/StartNode/EndNode 커스텀 | D1 |
| W2 | D3 | Timeline View (드래그앤드롭 순서 편집) | D2 |
| W3 | D4 | Module Palette (드래그 소스) | D1 |
| W3 | D5 | Phase Config Panel (SchemaDrivenForm 재사용) | C3 |
| W3 | D6 | JSON Logic 규칙 에디터 | C3 |
| W4 | D7 | Phase Template CRUD API | D3 |

---

## Phase E: 에디터 Layer 3 (4 PRs, 순차) — stretch

> 상세: [refs/phase-e-editor-l3.md](refs/phase-e-editor-l3.md)

| PR | 내용 | 의존 |
|----|------|------|
| E1 | ConditionNode + ActionNode + EventTriggerNode | D1 |
| E2 | 단서 의존성 그래프 뷰 + ClueComboNode | A6 |
| E3 | dagre 자동 배치 + 게임 흐름 시뮬레이션 | E1+E2 |
| E4 | 언두/리도 (immer + zustand, 50단계) | D1 |

---

## Phase F: Crime Scene 장르 (4 PRs, 2 Waves)

> 상세: [refs/phase-f-crime-scene.md](refs/phase-f-crime-scene.md)

| Wave | PR | 내용 | 의존 |
|------|-----|------|------|
| W1 | F1 | CrimeScenePlugin (장소 탐색 + 증거 조합) | A+B |
| W1 | F2 | LocationRestriction + VisibilitySpec 적용 | F1 |
| W2 | F3 | CrimeSceneView 프론트엔드 | F1 |
| W2 | F4 | 아키텍처 검증 (공통 코드 비율 60%+) | F1+F2+F3 |

---

## Phase G: 추가 장르 (5 PRs, 3 Waves)

> 상세: [refs/phase-g-additional.md](refs/phase-g-additional.md)

| Wave | PR | 내용 | 의존 |
|------|-----|------|------|
| W1 | G1 | ScriptKillPlugin (스크립트 관리 + 읽기 시간 제어) | A+B |
| W1 | G2 | JubenshaPlugin (음성 + 그룹 토론 + 휴식) | A+B |
| W2 | G3 | ScriptKillView + JubenshaView | G1+G2 |
| W2 | G4 | 장르별 프리셋 추가 | G1+G2 |
| W3 | G5 | 크로스 장르 통합 테스트 | F+G3+G4 |

---

## 실행 전략

### 병렬 메커니즘
- Agent tool `isolation: "worktree"` — 각 병렬 에이전트가 자체 git worktree에서 작업
- 파일 충돌 원천 차단
- 4-reviewer 병렬 리뷰 (security/perf/arch/test-coverage)

### Feature Flag
- `MMP_EDITOR_ENGINE_V2` default off → 안전한 롤아웃

### 최소 출시 기준 (MVP = Phase A+B+C)
- [ ] Phase A: 엔진 코어 단위 테스트 전체 PASS
- [ ] Phase B: MurderMystery E2E 시나리오 PASS
- [ ] Phase C: 에디터로 테마 생성 → 게임 시작 가능
