# 구현 단계 + MVP 로드맵

> 부모: [../design.md](../design.md)

---

## Phase 구조

### Phase A: 엔진 코어 (백엔드 뼈대)
> Phase 8.0 코드 기반으로 점진적 발전

| 단계 | 내용 | 산출물 |
|------|------|--------|
| A1 | Audit Log writer (PG append-only) + Redis hot state | `auditlog/` |
| A2 | GenrePlugin Core + Optional 인터페이스 + Registry | `engine/plugin.go` |
| A3 | Phase Engine (stateless wrapper, qmuntal/stateless) | `engine/phase_engine.go` |
| A4 | Event Bus (EventListener interface) | `engine/event_bus.go` |
| A5 | EventProcessor chain (검증 + 처리 + 사이드이펙트) | `engine/processor_chain.go` |
| A6 | Clue graph + validator + visibility | `clue/` |
| A7 | JSON Logic 통합 (diegoholiveira/jsonlogic) | `engine/rule_evaluator.go` |

### Phase B: 첫 번째 장르 (Murder Mystery)
> 가장 단순한 장르로 엔진 E2E 검증

| 단계 | 내용 | 산출물 |
|------|------|--------|
| B1 | MurderMysteryPlugin (Core + GameEventHandler + WinChecker) | `genre/murder_mystery/` |
| B2 | 기본 페이즈 (Intro → Round → Vote → Reveal) | `phases.go` |
| B3 | 단서 배포 (Starting + Round + Conditional) | `clue/` |
| B4 | 투표 (공개/비밀) | 기존 Voting 로직 통합 |
| B5 | 승리조건 + 결과 공개 | `CheckWin()` |
| B6 | E2E 통합 테스트 | `engine_test.go` |

### Phase C: 에디터 Layer 1 (Template Studio) — MVP
> 비개발자가 템플릿으로 테마 제작. **여기가 첫 출시 기능**

| 단계 | 내용 | 산출물 |
|------|------|--------|
| C1 | 에디터 레이아웃 (3-column) | `EditorLayout.tsx` |
| C2 | 장르 선택 + 프리셋 로드 | `GenreSelector.tsx` |
| C3 | ConfigSchema → 자동 폼 (Builder) | `SchemaDrivenForm.tsx` |
| C4 | 캐릭터 편집 (CRUD) | `CharacterList.tsx` |
| C5 | 단서 편집 (리스트 뷰 + 그래프 뷰) | `ClueList.tsx` |
| C6 | 자동저장 + 유효성 검사 | `useAutoSave.ts` |
| C7 | 테마 API (CRUD) + 게시 워크플로우 | `editor/` domain |

### Phase D: 에디터 Layer 2 (Phase Timeline)
> 타임라인으로 게임 흐름 편집

| 단계 | 내용 | 산출물 |
|------|------|--------|
| D1 | React Flow 캔버스 (onlyRenderVisibleElements) | `FlowEditor.tsx` |
| D2 | PhaseNode + PhaseEdge 커스텀 | `nodes/PhaseNode.tsx` |
| D3 | 타임라인 레이어 | `TimelineView.tsx` |
| D4 | JSON Logic 규칙 편집 | `RuleEditor.tsx` |

### Phase E: 에디터 Layer 3 (Visual Node Editor) — stretch
> 고급 제작자를 위한 비주얼 노드 편집

| 단계 | 내용 | 산출물 |
|------|------|--------|
| E1 | ConditionNode + ActionNode + EventTriggerNode | `nodes/` |
| E2 | 단서 의존성 그래프 뷰 + ClueComboNode | `ClueGraph.tsx` |
| E3 | dagre 자동 배치 | `useAutoLayout.ts` |
| E4 | 게임 흐름 시뮬레이션 | `PreviewEngine.tsx` |

### Phase F: 두 번째 장르 + 아키텍처 검증
> 공통 코드/장르 코드 분리도 측정

| 단계 | 내용 |
|------|------|
| F1 | CrimeScenePlugin (장소 탐색 + 증거 조합) |
| F2 | VisibilitySpec + LocationRestriction 적용 |
| F3 | 아키텍처 검증: 공통 코드 비율 측정 |

### Phase G+: 추가 장르
> 쥬번샤, 스크립트킬 순차 추가

---

## 의존 관계

```
A (엔진 코어) ──── B (MM 장르) ──── C (에디터 L1) ← MVP 출시
                                          │
                                          ▼
                                    D (에디터 L2)
                                          │
                                          ▼
                                    E (에디터 L3) [stretch]
                                          │
                                          ▼
                                    F (CS 장르 + 검증)
                                          │
                                          ▼
                                    G (추가 장르)
```

A→B 순차, B와 C 병렬 가능, C→D→E 순차, F는 B+E 완료 후.

---

## 테스트 전략

### Phase A (엔진 코어)
- **Plugin Registry**: `NewRegistry()` 사용, mock plugin으로 격리 테스트. 기존 Phase 8.0 session_test.go 패턴 유지
- **Phase Engine**: stateless wrapper 격리 — `qmuntal/stateless` 교체 가능한지 interface test
- **Event Bus**: listener error isolation test (하나 실패해도 다른 listener 계속)
- **JSON Logic**: **크로스 엔진 패리티 테스트** — 100개 식이 jsonlogic-js(프론트)와 diegoholiveira/jsonlogic(백엔드)에서 동일 결과

### Phase B (장르)
- **MurderMystery E2E**: in-process 통합 테스트 — "6인 플레이어, 3라운드, 범인 지목 성공" 시나리오
- **Plugin optional interfaces**: type assertion 동작 검증 (WinChecker 미구현 시 skip)

### Phase C (에디터)
- **ConfigSchema → Form**: 각 장르의 ConfigSchema로 자동 생성된 폼이 모든 필드를 렌더링하는지
- **Auto-save**: debounce 동작, 충돌 감지, version 충돌 해결
- **유효성 검사**: 서버와 동일한 JSON Schema 검증 (ajv/zod ↔ jsonlogic)

### Phase D-E (에디터 고급)
- **React Flow**: 노드 100개 + 엣지 200개 렌더링 성능 benchmark
- **단서 그래프**: 순환 참조 검출, 위상 정렬 정확성

### Phase F (아키텍처 검증)
- **공통 코드 비율**: `genre/shared/` 코드가 전체 genre 코드의 60%+인지 측정
- **장르 격리**: CrimeScenePlugin 변경이 MurderMysteryPlugin 컴파일/테스트에 영향 없는지

---

## Phase 8.0 → 신규 Phase 마이그레이션 체크리스트

- [ ] `git checkout -b feat/editor-engine-redesign main`
- [ ] Session/SessionManager/Hub 코드 복사 (변경 없이 유지)
- [ ] GameProgressionEngine → PhaseEngine 리팩토링
- [ ] Module interface → GenrePlugin Core + Optional로 교체
- [ ] 기존 session_test.go, hub_test.go 통과 확인
- [ ] ProgressionStrategy (script/hybrid/event) → 각 장르 Plugin 내부로 이동
- [ ] EventBus callback → EventListener interface로 타입 안전화
- [ ] Redis 스냅샷 → PG game_snapshots로 백업 경로 추가
