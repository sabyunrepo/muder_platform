# 03 module-architect — Phase 19 W2 Draft

> Primary: BaseModule/engine.Module 인터페이스 준수, Factory·init()+Register 패턴, PhaseReactor/PhaseHookModule/ConfigSchema/PlayerAwareModule/SerializableModule/WinChecker 일관성, 세션 인스턴스 독립성.
> 금지: 파일 크기 리밋(01), 계층 경계(01), 모듈별 테스트 skip/coverage(04) — 발견 시 `[cross:...]`.

## Scope

- `apps/server/internal/engine/{types.go, module_optional.go, registry.go, factory.go, phase_engine.go}` — 규약 정의부.
- `apps/server/internal/module/**` — 33 모듈 8 카테고리 구현부.
- `apps/server/internal/session/snapshot_send.go` — PlayerAwareModule 호출 trust boundary.
- 비교 대상: W1 `module-inventory.md` 실측 + `engine.PhaseReactor` vs `engine.PhaseHookModule` 두 선택 인터페이스 혼용 이력.

## Method

1. W1 인벤토리 33개 명단을 Grep으로 재검증: PlayerAware/PhaseReactor/PhaseHookModule/Schema/WinChecker/SerializableModule 구현체 실측.
2. W1 "PlayerAwareModule 0/33" 주장 재검정 — `BuildStateFor` grep 결과 8개 발견. W1 데이터 drift 판정.
3. `session.sendSnapshotForActor`에서 `engine.BuildStateFor`가 재조합하는 경로 추적, fallback 분기(public `BuildState`) 위험 모듈 식별.
4. Phase action 카탈로그(`types.go:14-32`) ↔ `ActionRequiresModule`(54-65) ↔ 실제 `ReactTo`/`SupportedActions` 구현체 매핑.
5. 컴파일 타임 체크(`var _ engine.X = ...`) 존재 모듈 vs 미존재 모듈 집계.

## Findings

### F-module-1: PlayerAwareModule 누락 — Evidence/Location 등 crime_scene이 per-player state를 public BuildState로 노출
- **Severity**: P0
- **Evidence**:
  - `apps/server/internal/module/crime_scene/evidence.go:37-40` — `unlockedByID map[string]bool`, `discovered map[uuid.UUID][]string`, `collected map[uuid.UUID][]string` 필드가 플레이어 UUID로 분기되는 state를 보유.
  - `apps/server/internal/module/crime_scene/evidence.go:394-399` — `var (...)` 인터페이스 어설션에 `PlayerAwareModule` **없음**. `BuildStateFor` 구현 전무.
  - `apps/server/internal/module/crime_scene/location.go:242-270` — 동일 패턴. `SerializableModule`만 만족, `PlayerAwareModule` 없음.
  - `apps/server/internal/engine/types.go:100-107` — `BuildModuleStateFor`는 assertion 실패 시 **public `BuildState()`로 fallback**. 즉 evidence/location은 자신의 전 플레이어 `discovered/collected` map을 한 envelope에 담아 모든 peer에게 broadcast.
  - `apps/server/internal/session/snapshot_send.go:91` — `s.engine.BuildStateFor(playerID)`가 모듈 상태를 그대로 세션 state에 주입.
- **Impact**: Phase 18.1 B-2 방지 목적의 redaction trust boundary가 crime_scene 3 모듈(evidence/location/combination)에서 뚫림. 수사물 장르의 "내가 본 증거 / 남이 본 증거" 분리가 런타임에 강제되지 않아, 사용자 체감 스포일러·역할 누설 재발 가능성. 실제로 `whisper`/`hidden_mission`/`voting`은 막았지만 증거 모듈은 빠짐 → 반쪽짜리 redaction.
- **Proposal**:
  1. `EvidenceModule`·`LocationModule`·`CombinationModule`에 `BuildStateFor(playerID)` 추가 — 호출자의 discovered/collected만 반환하도록 재구성.
  2. 컴파일 타임 체크 `var _ engine.PlayerAwareModule = (*EvidenceModule)(nil)` 추가.
  3. 규약 문서에 "per-player state 필드 보유 시 PlayerAwareModule 필수" 조항 명시(W2 `08-docs-navigator` cross-ref).
- **Cross-refs**: [cross:05-security] 스냅샷 redaction 트러스트 바운더리 · [cross:04-test-engineer] snapshot_redaction_test.go에 evidence 케이스 누락 검증

### F-module-2: PhaseReactor ↔ PhaseHookModule 두 인터페이스가 병렬 존재 — 계약 중복 & 의미 모호
- **Severity**: P1
- **Evidence**:
  - `apps/server/internal/engine/types.go:109-117` — `PhaseReactor{ReactTo, SupportedActions}` 정의 (action-dispatch 모델).
  - `apps/server/internal/engine/module_optional.go:31-40` — `PhaseHookModule{OnPhaseEnter, OnPhaseExit}` 정의 (phase-lifecycle 모델).
  - 구현 집계: `PhaseReactor` 8개(audio·whisper·group_chat·text_chat·voting·trade_clue·floor_exploration·clue_interaction). `PhaseHookModule` 17개(ready·audio·whisper·starting_clue·round_clue·accusation·ending·evidence·reading·hybrid_progression·event_progression·script_progression·gm_control·consensus_control·skip_consensus·timed_exploration). **중첩 3개**(audio·whisper — assertion block에 둘 다 선언).
  - W1 인벤토리는 "PhaseReactor 8/33"만 보고 나머지 25개는 phase 이벤트 무반응처럼 서술했지만, 실제로는 17개가 `OnPhaseEnter/Exit`로 반응. **W1 인벤토리 집계 오류**.
- **Impact**: 신규 모듈 저자가 어느 인터페이스를 골라야 할지 불명확. 같은 모듈이 둘 다 구현하면 phase 전환 시 순서(Enter → ReactTo? ReactTo → Enter?)가 엔진 구현에 암묵 의존. 문서(CLAUDE.md·project_module_system.md)는 PhaseReactor만 언급하고 PhaseHookModule은 누락 → 설계-코드 drift.
- **Proposal**:
  1. 엔진 README 또는 `engine/README.md`에 두 인터페이스의 목적 분리 명시: PhaseReactor=타임라인 action, PhaseHookModule=phase 생명주기 훅.
  2. 둘 다 구현하는 모듈(audio·whisper)에 대해 call order 문서화 + 테스트 추가(W2 `04-test-engineer` cross-ref).
  3. 장기: 하나로 통합할지 검토 — RFC 필요. 본 감사는 문서화·테스트로 P1 종결 제안.
- **Cross-refs**: [cross:08-docs-navigator] design 문서 갱신 · [cross:04-test-engineer] call-order 회귀 테스트

### F-module-3: gm_control·consensus_control·skip_consensus — ActionLockModule/ActionUnlockModule 미연결
- **Severity**: P1
- **Evidence**:
  - `apps/server/internal/engine/types.go:30-31` — `ActionLockModule`, `ActionUnlockModule` Phase action 카탈로그에 정의.
  - `apps/server/internal/engine/types.go:54-65` — `ActionRequiresModule` 매핑에 `ActionLockModule`/`ActionUnlockModule` **항목 없음**. 즉 타임라인에서 LOCK/UNLOCK을 쏘아도 어떤 모듈이 반응해야 하는지 엔진이 알 수 없음.
  - `apps/server/internal/module/progression/gm_control.go:15` — 코드 주석 `// Does not implement ConfigSchema or PhaseReactor.` 자체 선언으로 미구현 공식화.
  - `apps/server/internal/module/progression/consensus_control.go:23-41` — `validConsensusActions` 맵 내부에 `START_GAME/NEXT_PHASE/SHOW_ENDING/REVEAL_ALL_CLUES` 등 **하드코딩**. 이것들은 PhaseAction 카탈로그의 `ActionBroadcastMessage`·`ActionOpenVoting` 등과 중복 개념이지만 별개 enum.
- **Impact**: GM/합의 제어는 에디터에서 phase timeline에 "잠금/해제" 이벤트로 연결되는 게 자연스러운 UX인데, 현재는 consensus_control이 자체 action enum을 관리하며 PhaseReactor에 편입되지 않음. 에디터 노브 누락 + 이벤트 이중 경로(PhaseAction vs consensus proposal) → Phase 19 timeline feature 확장 시 병목.
- **Proposal**:
  1. `ActionRequiresModule` 매핑에 `ActionLockModule: ""` (module-agnostic), 또는 gm_control이 이 action들의 PhaseReactor로 연결.
  2. `consensus_control`의 `validConsensusActions` 맵을 `PhaseAction` enum으로 흡수 혹은 명시적으로 별개 레이어임을 주석화.
  3. `gm_control.go:15`의 부정 주석을 "v1에서는 단순 state holder, v2에서 PhaseReactor 편입 예정"으로 교체하거나 실제 편입.
- **Cross-refs**: [cross:08-docs-navigator] design module-spec.md에 action 매핑 명시

### F-module-4: crime_scene "장소" 개념 3-way 분산 — location / location_clue / floor_exploration
- **Severity**: P1
- **Evidence**:
  - `apps/server/internal/module/crime_scene/location.go` — 장소 엔티티 + examine 이벤트 + SerializableModule (316 LOC).
  - `apps/server/internal/module/exploration/location_clue.go` — 장소별 단서 노출(187 LOC, ConfigSchema + GEH).
  - `apps/server/internal/module/exploration/floor_exploration.go` — 층 단위 탐색 + PhaseReactor + GEH (204 LOC).
  - `evidence.go:81-94` — `location.examined` 이벤트를 구독해 evidence 자동 발견. 즉 `location` → `evidence` 암묵 결합, 그러나 `location_clue`는 별도 경로로 단서를 드러냄 — 두 단서 노출 경로가 병행.
- **Impact**: 에디터 저자가 "장소 세팅"을 위해 3개 모듈 중 어느 것을 선택·조합해야 할지 결정 트리가 불명. 설정 중복(장소 목록을 여러 모듈 config에 동시 선언) 소지. Phase 18.4 에디터 UX 개선 작업과 충돌.
- **Proposal**:
  1. W3a advisor에게 "장소 도메인 재통합" 스펙 승격 요청 — location을 엔티티 owner로, location_clue/floor_exploration을 consumer로 단방향 관계 명시.
  2. 단기: 각 모듈 `Schema()`에 "이 모듈은 location 모듈과 함께 활성화해야 함" `required` 힌트 추가(에디터 검증용).
  3. 장기: 한 모듈로 병합 또는 shared state 인터페이스 도입.
- **Cross-refs**: [cross:02-react-frontend] 에디터 UX 에 영향 · [cross:08-docs-navigator] 설계 문서 재정리

### F-module-5: 컴파일 타임 인터페이스 체크(`var _ engine.X = ...`) 커버리지 불균형
- **Severity**: P2
- **Evidence**:
  - `var _ engine.Module = (*XxxModule)(nil)` **명시적** 선언 모듈: evidence·clue_interaction·audio·room·voice_chat·spatial_voice·ready·group_chat·text_chat·whisper·voting·hidden_mission·trade_clue·timed_clue·starting_clue·round_clue·conditional_clue·accusation·combination·reading·skip_consensus·ending·consensus_control·script_progression·event_progression·hybrid_progression·gm_control·floor_exploration·timed_exploration·room_based_exploration·location_clue (Grep `var \(` 전수 확인).
  - 일부 모듈은 선택 인터페이스(`engine.SerializableModule` 등)를 구현하면서도 assertion block에서 해당 인터페이스를 누락. 예: `connection.go`가 `SaveState/RestoreState`를 구현하지만 assertion block은 `engine.Module`·`engine.SerializableModule`만 나열하는지 개별 검증 필요.
- **Impact**: 구현체가 선택 인터페이스를 부분 구현하다가 시그니처를 바꿔도 컴파일 타임에 못 잡음. 런타임 type assertion 실패 시 silent fallback(public BuildState)이 발동해 F-module-1 같은 보안 사고로 이어짐.
- **Proposal**:
  1. 모든 모듈에서 구현하는 모든 선택 인터페이스를 `var (...)` 블록에 명시하는 룰을 `mmp-module-factory` 스킬에 추가.
  2. `go vet` 대체용 lint: 모듈 디렉터리마다 assertion 블록이 반드시 존재하는지 CI check 추가(W2 `04-test-engineer` cross-ref).
- **Cross-refs**: [cross:04-test-engineer] CI lint · [cross:08-docs-navigator] mmp-module-factory 스킬 갱신

### F-module-6: W1 인벤토리 수치 drift — PlayerAware 0→8, Schema 22→21, PhaseHook 집계 누락
- **Severity**: P2 (감사 자체 품질)
- **Evidence**:
  - W1 `module-inventory.md:74` "PlayerAwareModule (선택) | 0 | 33 | **0%**" — 실측 **8/33 = 24%**(whisper·timed_clue·conditional_clue·trade_clue·starting_clue·round_clue·hidden_mission·voting).
  - W1 `module-inventory.md:69` "ConfigSchema | 22 | 33" — `Schema()` 함수 정의 Grep 결과 **21개** (group_chat·text_chat·event_progression·hybrid_progression·reading·skip_consensus·ending·script_progression·hidden_mission·voting·accusation·timed_clue·conditional_clue·trade_clue·starting_clue·round_clue·clue_interaction·location_clue·floor_exploration·timed_exploration·room_based_exploration).
  - W1은 `PhaseReactor` 8개만 집계, `PhaseHookModule` 17개는 카운트 행 자체 부재.
- **Impact**: W2 단독이 W1 인벤토리 기반으로 finding을 쓰면 잘못된 베이스라인 → severity 오판. F-module-1이 실제로는 crime_scene로 좁혀지지만 W1 숫자를 믿으면 전 모듈 패닉.
- **Proposal**: W1 인벤토리 수정 — 본 draft §Metrics를 ground truth로 반영(W2 `08-docs-navigator` cross-ref).
- **Cross-refs**: [cross:08-docs-navigator] W1 산출물 교정

## Metrics

| 항목 | W1 주장 | 실측 | 갭 |
|------|-------:|----:|---:|
| 모듈 총수 | 33 | 33 | 0 |
| engine.Module + Factory + Register | 33 | 33 | 0 |
| ConfigSchema (`Schema()`) | 22 | **21** | -1 |
| PhaseReactor (`ReactTo`+`SupportedActions`) | 8 | 8 | 0 |
| PhaseHookModule (`OnPhaseEnter/Exit`) | — | **17** | +17 (W1 누락) |
| GameEventHandler (`Validate`+`Apply`) | 17 | 확인 필요 | — |
| SerializableModule (`SaveState`+`RestoreState`) | 11 | 12 (connection 포함) | +1 |
| WinChecker (`CheckWin`) | 4 | 4 (voting/hidden_mission/accusation/combination) | 0 |
| **PlayerAwareModule (`BuildStateFor`)** | 0 | **8** | +8 |
| PhaseAction enum 항목 | 17 | 17 | 0 |
| `ActionRequiresModule` 매핑 항목 | — | 10 | ActionLockModule/Unlock/PlaySound/PlayMedia/SetBGM/StopAudio/BroadcastMessage 7개 미매핑 |

**P0/P1/P2 분포**: P0 1, P1 3, P2 2 → P0+P1 = 67% (gate 50% 통과).

## Advisor-Ask

1. **crime_scene 3 모듈(evidence/location/combination)에 PlayerAwareModule 추가 범위** — 증거 공유가 "전 참여자 브로드캐스트"인지 "개인 수첩 모델"인지 장르별 디자인 결정. v3 게임플레이 스펙에 대한 advisor 결정 필요(F-module-1 P0 처리 방식).
2. **PhaseReactor vs PhaseHookModule 통합 RFC 필요 여부** — 본 감사는 문서화/테스트로 P1 종결 제안하나, Phase 19 이후 신규 장르 추가 계획이 있다면 인터페이스 단일화 RFC를 advisor가 우선순위화해야 할지(F-module-2).
3. **consensus_control `validConsensusActions` vs `PhaseAction` enum 이중성** — 런타임 라우팅을 단일 enum으로 통합하는 것이 다른 작업(에디터 타임라인 UX, module-spec 문서)에 미치는 파급 범위를 advisor가 cross-cutting 판정할지(F-module-3).

## 참조

- 엔진 규약: `apps/server/internal/engine/types.go:14-139`, `module_optional.go:12-61`
- 등록·팩토리: `apps/server/internal/engine/registry.go:22-30`, `factory.go:66-95`, `apps/server/internal/module/register.go`
- 스냅샷 경로: `apps/server/internal/session/snapshot_send.go:86-111`, `snapshot.go:73-77`
- W1 인벤토리: `docs/plans/2026-04-17-platform-deep-audit/refs/shared/module-inventory.md`
