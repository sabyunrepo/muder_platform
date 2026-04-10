# 구현 단계 + MVP 로드맵

> 부모: [../design.md](../design.md)

---

## Phase 구조

### Phase A: 엔진 코어 (백엔드 뼈대)
> "한 게임이 끝까지 돌아간다" — 머더미스터리 장르로 E2E

| 단계 | 내용 | 디자인패턴 | 산출물 |
|------|------|-----------|--------|
| A1 | Event Store (PG) + Replay | Event Sourcing | `eventstore/` |
| A2 | Session Actor + Manager | Actor + Template Method | `session/` |
| A3 | Phase Engine (stateless FSM) | State | `engine/phase_engine.go` |
| A4 | Event Bus + EventHandler Chain | Observer + Decorator + Chain | `engine/` |
| A5 | GenrePlugin 인터페이스 + Registry | Strategy + Factory | `engine/plugin.go`, `engine/registry.go` |
| A6 | EventMapping + Hub Lifecycle | Adapter + Observer | `bridge/`, `ws/` |
| A7 | Redis 핫 스테이트 + Snapshot | CQRS | `eventstore/snapshot.go` |

### Phase B: 첫 번째 장르 (Murder Mystery)
> 가장 단순한 장르로 엔진 검증

| 단계 | 내용 | 산출물 |
|------|------|--------|
| B1 | MurderMysteryPlugin 골격 | `genre/murder_mystery/` |
| B2 | 기본 페이즈 (Intro → Round → Vote → Reveal) | `phases.go` |
| B3 | 단서 배포 (StartingClue + RoundClue) | `clue/` |
| B4 | 투표 (공개/비밀) | 기존 Voting 모듈 연동 |
| B5 | 승리조건 평가 | `CheckWin()` |
| B6 | E2E 통합 테스트 (in-process) | 테스트 시나리오 |

### Phase C: 에디터 Layer 1 (Template Studio)
> 비개발자가 템플릿으로 테마 제작

| 단계 | 내용 | 산출물 |
|------|------|--------|
| C1 | 에디터 레이아웃 (3-column) | `EditorLayout.tsx` |
| C2 | 장르 선택 + 프리셋 로드 | `GenreSelector.tsx` |
| C3 | ConfigSchema → 자동 폼 (Builder) | `SchemaDrivenForm.tsx` |
| C4 | 캐릭터 편집 (CRUD) | `CharacterList.tsx` |
| C5 | 단서 편집 (리스트 뷰) | `ClueList.tsx` |
| C6 | 자동저장 + 유효성 검사 | `useAutoSave.ts` |
| C7 | 테마 API (CRUD) | `editor/` domain |

### Phase D: 에디터 Layer 2 (Phase Timeline)
> 타임라인으로 게임 흐름 편집

| 단계 | 내용 | 산출물 |
|------|------|--------|
| D1 | React Flow 캔버스 기본 설정 | `FlowEditor.tsx` |
| D2 | PhaseNode + PhaseEdge 커스텀 | `nodes/PhaseNode.tsx` |
| D3 | 타임라인 레이어 (순차 편집) | `TimelineView.tsx` |
| D4 | 드래그앤드롭 모듈 팔레트 | `ModulePalette.tsx` |
| D5 | 우측 패널 페이즈 설정 | `PhaseConfigPanel.tsx` |
| D6 | JSON Logic 규칙 편집 | `RuleEditor.tsx` |

### Phase E: 에디터 Layer 3 (Visual Node Editor)
> 고급 제작자를 위한 비주얼 노드 편집

| 단계 | 내용 | 산출물 |
|------|------|--------|
| E1 | ConditionNode + ActionNode | `nodes/ConditionNode.tsx` |
| E2 | EventTriggerNode | `nodes/EventTriggerNode.tsx` |
| E3 | 단서 의존성 그래프 뷰 | `ClueGraph.tsx` |
| E4 | ClueNode + ClueComboNode | `nodes/ClueNode.tsx` |
| E5 | dagre 자동 배치 | `useAutoLayout.ts` |
| E6 | 게임 흐름 시뮬레이션 | `PreviewEngine.tsx` |
| E7 | 언두/리두 + 검증 | `useFlowValidation.ts` |

### Phase F: 두 번째 장르 + 아키텍처 검증
> 공통 코드/장르 코드 분리 검증

| 단계 | 내용 | 산출물 |
|------|------|--------|
| F1 | CrimeScenePlugin 구현 | `genre/crime_scene/` |
| F2 | 장소 탐색 + 이동 | LocationClue 연동 |
| F3 | 증거 조합 시스템 | `clue/graph.go` |
| F4 | VisibilitySpec 적용 | `clue/visibility.go` |
| F5 | 에디터 장르별 뷰 | `CrimeSceneView.tsx` |
| F6 | 아키텍처 검증 리포트 | 공통/장르 코드 분리도 측정 |

### Phase G+: 추가 장르 + 고도화
> 쥬번샤, 스크립트킬 순차 추가

| 단계 | 내용 |
|------|------|
| G1 | ScriptKillPlugin + 음성 연동 |
| G2 | JubenshaPlugin + 그룹 토론 |
| G3 | 에디터 고급 기능 (가져오기/내보내기, 버전 관리) |
| G4 | gopher-lua 스크립팅 (고급 제작자) |
| G5 | AI-DM 모듈 (LLM 기반 사회자) |

---

## 의존 관계

```
A (엔진 코어) ──── B (MM 장르) ──── C (에디터 L1)
                                          │
                                          ▼
                                    D (에디터 L2)
                                          │
                                          ▼
                                    E (에디터 L3)
                                          │
                                          ▼
                                    F (CS 장르 + 검증)
                                          │
                                          ▼
                                    G (추가 장르)
```

A→B는 순차, C→D→E는 순차, B와 C는 병렬 가능, F는 E 완료 후.
