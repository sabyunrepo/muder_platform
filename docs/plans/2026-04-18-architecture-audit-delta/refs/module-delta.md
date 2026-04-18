# 03 module-architect — Delta Audit (ba20344 → 23c925c)

> Window: Phase 20 (PR-1 ~ PR-6) + graphify tooling. Scope: `apps/server/internal/engine/` + `apps/server/internal/module/`.
> Baseline: Phase 19 F-03 (2026-04-17) — P0:1, P1:3, P2:2.

## Phase 19 F-03 해소 상태

| ID | 제목 | Sev | Delta 상태 | 근거 |
|----|------|----:|-----------|-----|
| **F-module-1** | **crime_scene PlayerAwareModule 누락 (evidence/location/combination)** | **P0** | **미해소** | `evidence.go:394-399` / `location.go:311-316` / `combination.go:527-533` assertion 블록 현행 확인 → `PlayerAwareModule` 여전히 **부재**. Phase 20 PR-5는 CRAFT 트리거 · CurrentRound · GroupID만 추가했고 `BuildStateFor` 미도입. `discovered / collected / positions / history / completed / derived` 모두 per-player map인데 public `BuildState()`가 전체를 그대로 marshal. |
| F-module-2 | PhaseReactor ↔ PhaseHookModule 인터페이스 중복 | P1 | 미해소 (변화 없음) | Phase 20은 두 인터페이스 자체를 건드리지 않음. `module_optional.go` 무수정. |
| F-module-3 | gm/consensus/skip_consensus — ActionLock/Unlock 미매핑 | P1 | 미해소 (변화 없음) | `types.go:54-65` `ActionRequiresModule` 매핑 그대로. `ActionLockModule` / `ActionUnlockModule` 여전히 미배정. |
| F-module-4 | 장소 도메인 3-way 분산 (location / location_clue / floor_exploration) | P1 | **부분 해소** | PR-2/PR-3/PR-5가 `theme_clues` · `theme_locations`에 `reveal_round / hide_round / from_round / until_round / round_schedule` 컬럼을 추가하고 `clue_edge_groups` 통합 스키마 도입 → 에디터·DB 레이어에서 "라운드 단위 가시성"이 공통 노브로 수렴. 다만 **모듈 런타임 쪽(3개 모듈)은 여전히 각자 state** — 통합은 데이터·에디터 층에만. |
| F-module-5 | 컴파일 타임 인터페이스 체크 커버리지 불균형 | P2 | 미해소 (변화 없음) | combination 의 assertion 블록에 PlayerAwareModule 미추가(신규 craftedAsClueMap 헬퍼가 per-player 상태를 새로 만들었음에도). |
| F-module-6 | W1 인벤토리 수치 drift (PlayerAware 0→8 등) | P2 | **해소 불필요**(문서 갱신 과제) — W2 draft Metrics 표가 ground truth. |

**요약: crime_scene PlayerAware P0는 Phase 20에서 해소되지 않았다.** (실측 `BuildStateFor` 구현 8개 모듈 목록 변화 없음 — whisper · hidden_mission · voting · starting_clue · round_clue · timed_clue · conditional_clue · trade_clue.)

## 신규 Finding

### D-MO-1: CRAFT 트리거 도입이 PlayerAware 누락을 강화 (P0 상향 근거)
- **Severity**: P0 (상향)
- **Evidence**:
  - `combination.go:185-194` — `craftedAsClueMap(playerID)` 신규 함수가 per-player derived set을 반환.
  - `combination.go:151-175` — `checkNewCombos`가 `discovered + crafted` 세트를 `graph.Resolve`에 주입해 CRAFT 트리거 클루를 게이트.
  - `combination.go:318-323` — `combinationState.Completed / Derived / Collected` 세 map을 snapshot으로 그대로 반환. `BuildState()`(349-355)는 모든 playerID 키 맵을 marshal.
  - `combination.go:527-533` — `var _ engine.PlayerAwareModule = (*CombinationModule)(nil)` 없음.
- **Impact**: Phase 19 P0의 "crime_scene 3모듈 per-player 상태 노출"이 Phase 20에서 **CRAFT 트리거(제작형 단서)까지 포함**하도록 확장. 즉 "내가 조합으로 해금한 단서"가 **다른 플레이어 스냅샷에 그대로 포함** 가능. 추리 게임의 "혼자 풀어낸 단서"가 탐지 못한 채 peer 화면에 노출 — 스포일러 +역할 누설 경로가 Phase 19 시점보다 넓어짐.
- **Proposal**:
  1. `Evidence / Location / Combination` 3 모듈에 `BuildStateFor(playerID)` 추가 — 각각 `discovered[playerID]` / `positions[playerID]+history[playerID]` / `completed[playerID]+derived[playerID]+collected[playerID]`만 반환.
  2. assertion 블록에 `var _ engine.PlayerAwareModule = (*XxxModule)(nil)` 추가 — 컴파일 타임 회귀 방지.
  3. Phase 19 F-module-1과 같은 backlog 아이템이지만 Phase 20 변경으로 **우선순위 P0 유지, 범위 확장 주석** 필요.
- **Cross-refs**: [cross:05-security-delta] snapshot redaction · [cross:04-test-engineer] snapshot_redaction_test 에 combination.derived 케이스 추가.

### D-MO-2: `CurrentRound` 도입이 규약에 반영 안 됨 (PhaseReactor 재정의 필요)
- **Severity**: P1
- **Evidence**:
  - `module_types.go:22-34` — `GameState.CurrentRound int32` 필드 추가. 주석에는 "모듈은 `CurrentRound()` 또는 `phase:entered`(payload.round) 구독으로 게이팅"이라고 명시.
  - `phase_engine.go:45-49` — `PhaseEngine.CurrentRound()` public accessor 추가.
  - `phase_engine.go:106` / `:179-186` — Start 시 round=1, AdvancePhase마다 `currentRound++`, `phase.advanced` 이벤트 payload에 `round` 포함.
  - 그러나 `types.go` **Module / PhaseReactor / PhaseHookModule 인터페이스 어디에도 `CurrentRound` 접근 경로가 없다**. 모듈이 round를 읽으려면 (a) `phase.advanced` 이벤트 payload를 파싱하거나 (b) 엔진 reference를 주입받아야 하는데, `ModuleDeps{SessionID, EventBus, Logger}`(types.go:132-136)에는 엔진 핸들 없음.
  - 결과: 설계 주석("modules consult `CurrentRound()` or subscribe to `phase:entered`")과 실제 주입 경로 불일치. 모듈이 round를 알려면 EventBus 구독밖에 없고, 그러려면 각 모듈이 `current` 내부 state를 따로 복제해야 함.
- **Impact**: Phase 20 PR-2/PR-3이 DB에 `reveal_round / from_round / until_round` 컬럼을 추가했지만, 런타임에서 이 값을 런타임 round와 비교할 단일 hook이 없음. 신규 라운드 필터 로직을 구현하려는 모듈마다 제각각 round state를 보유 → Phase 19 F-module-2(PhaseReactor ↔ PhaseHookModule 중복)를 악화.
- **Proposal**:
  1. `engine.PhaseReactor` / `PhaseHookModule`에 `OnPhaseEnter(ctx, phase engine.Phase, round int32)` 형태로 round 파라미터 추가하거나,
  2. `ModuleDeps`에 `CurrentRound func() int32` 또는 `engine.GameClock` 인터페이스 주입,
  3. 결정 전까지 공식 규약은 **"`phase.advanced` 이벤트 payload.round 구독이 유일한 경로"**라고 `engine/README.md`(또는 module-spec refs)에 명문화.
- **Cross-refs**: [cross:01-go-backend-delta] API drift · [cross:08-docs-navigator] module-spec 라운드 스키마 섹션 갱신.

### D-MO-3: `findCombo` 시그니처 변경이 Validate/Apply 경계에 숨은 계약 변경
- **Severity**: P2
- **Evidence**:
  - `combination.go:227 / :271-289 / :382 / :397` — `findCombo([]string)` → `findCombo(combinePayload)`로 교체.
  - `handleCombine`(:214-262) · `Validate`(:373-385) · `Apply`(:388-408) 세 곳이 **같은 함수를 호출**하지만 Validate는 RLock만, Apply는 Lock 획득 후 호출. 새 `findCombo`는 GroupID 우선 · InputIDs fallback 분기를 담고 있어서 이전보다 길어짐. 분기가 길어지면 Lock hold 시간 증가 → 동시성 핫스팟.
  - Validate 경로에서 GroupID 실패(`unknown group_id`)는 `err` 반환 → 이벤트 거부. Apply 경로가 Validate 없이 호출되면(재접속 snapshot replay 등) GroupID 불일치로 실패 가능.
- **Impact**: 경량이지만, 앞으로 RuleEngine이나 외부 validator가 GroupID 없는 legacy payload를 재생할 때 경고 없이 실패. Phase 19 F-module-5(컴파일 타임 체크) 범주에 편승.
- **Proposal**:
  1. `combinePayload.GroupID`가 빈 문자열일 때 `findCombo`가 반드시 legacy set-match로 fallback하는 현 로직에 **테스트 회귀**(이미 `TestCombinationModule_CraftedSetSurfacesOutput`이 커버) 외에 **재생 시나리오(GroupID 없는 오래된 snapshot replay)** 테스트 추가.
  2. Validate/Apply에서 GroupID 미매칭 시 `log.Warn`만 남기고 set-match fallback을 명시 고려 — 또는 현 동작이 의도적이라면 함수 주석에 "replay 시 group_id 반드시 제공 필요" 명시.
- **Cross-refs**: [cross:04-test-engineer] replay·idempotency 테스트.

### D-MO-4: graphify corpus에 "Module Factory & Registry"가 별도 community로 여전히 군집화 — 커뮤니티 30개 중 확인 완료, Drift 없음
- **Severity**: info
- **Evidence**:
  - `graphify-out/GRAPH_REPORT.md:39` — `[[_COMMUNITY_Module Factory & Registry]]` 커뮤니티 존재.
  - `graphify-out/GRAPH_REPORT.md:19` — `[[_COMMUNITY_Clue Modules (Conditional/Round/Trade)]]` cluedist 3 모듈만 묶임. 다른 cluedist 2개(starting/timed)는 각각 인접 community에 배속 — Phase 19 W1 때도 동일.
  - "Module Factory & Registry" ↔ "Clue Graph & Validation"(line 22) 간 엣지가 Phase 20 CRAFT 추가로 강화됐을 가능성이 있지만 GRAPH_REPORT 상위 개괄에는 가중치 변화 없음.
- **Impact**: Phase 20 변경이 graphify 기준 **모듈 레이어 군집 구조를 재편하지는 않았다**. 즉 아키텍처 "지도" 변경은 없음 → 규약·인터페이스 변화가 없음을 graphify 관점에서도 확인.
- **Proposal**: 후속 감사에서 "Clue Graph & Validation" 커뮤니티가 combination.go 노드와 어떤 엣지 가중치 변화를 가지는지 `/graphify explain` 활용(본 감사 범위 밖).

## 모듈 인벤토리 변화 (Phase 19 → Phase 20)

| 항목 | Phase 19 (2026-04-17) | Phase 20 (2026-04-18) | 갭 |
|------|--:|--:|---:|
| 총 모듈 수 (`.go` non-test) | 33 | **33** | 0 (신규/삭제 모듈 **없음**) |
| `engine.Module` + Factory + init()+Register | 33 | 33 | 0 |
| `ConfigSchema` 구현 | 21 | 21 | 0 |
| `PhaseReactor` 구현 | 8 | 8 | 0 |
| `PhaseHookModule` 구현 | 17 | 17 | 0 |
| `GameEventHandler` 구현 | 17 | 17 | 0 |
| `SerializableModule` 구현 | 12 | 12 | 0 |
| `WinChecker` 구현 | 4 | 4 | 0 |
| **`PlayerAwareModule` 구현** | **8** | **8** | **0 (여전히 crime_scene 제외)** |
| `GameState` 필드 | SessionID/Phase/Modules | +**CurrentRound int32** | +1 |
| PhaseAction enum 항목 | 17 | 17 | 0 |
| `ActionRequiresModule` 매핑 | 10 | 10 | 0 |

**BuildStateFor 구현 목록 (8개, 변화 없음)**: `decision/voting.go` · `decision/hidden_mission.go` · `communication/whisper.go` · `cluedist/trade_clue.go` · `cluedist/timed_clue.go` · `cluedist/starting_clue.go` · `cluedist/round_clue.go` · `cluedist/conditional_clue.go`.

## graphify Insight

- **"Module Factory & Registry"** community(line 39): Phase 20 CRAFT 트리거 추가가 `crime_scene/combination.go` ↔ `clue/graph.go`(TriggerCRAFT 상수) 엣지를 신규 생성. graphify 재인덱스 시 `[[_COMMUNITY_Clue Graph & Validation]]` ↔ `[[_COMMUNITY_Module Factory & Registry]]` 연결 가중치 증가 예상. 현 corpus는 재인덱스 전이라 수치 변화 미반영.
- **"Clue Modules (Conditional/Round/Trade)"** community(line 19): round 필터링 신규 요구가 이 cluster의 5 모듈(starting/round/timed/trade/conditional) 전수에 CurrentRound 구독 유인을 만듦. D-MO-2 해소 시 cluster 내부 결합 강화 예상.
- 다음 graphify 재인덱스(Phase 21 경계)에서 "Clue Graph & Validation" community가 combination.go 노드를 끌어당겨 재배속될 가능성 — architecture drift 관찰 포인트.

## 우선순위 제안

1. **D-MO-1 (P0, 상향 근거)** — Phase 19 F-module-1 backlog 항목에 "Phase 20 CRAFT 포함으로 범위 확장" 주석을 추가하고, `BuildStateFor` 3 모듈 구현을 **다음 phase 최우선 작업**으로 승격. go-backend-engineer + security-reviewer 협업 필요.
2. **D-MO-2 (P1)** — CurrentRound 접근 규약을 Phase 21 초반에 확정. 옵션 A(인터페이스 파라미터 확장) vs 옵션 B(`ModuleDeps` 주입) 결정은 docs-navigator의 module-spec 갱신과 동시 진행.
3. **D-MO-3 (P2)** — replay idempotency 테스트를 `test-engineer`에게 위임. 현 코드 변경 없이 테스트 보강만으로 완료 가능.
4. **D-MO-4 (info)** — 다음 graphify fresh rebuild 시점에 combination↔graph 엣지 변화 재검. docs-navigator가 indexing 타이밍 관리.
5. Phase 19 F-module-2/3/5는 **Phase 20에서 변화 없음** → 후속 감사에서 그대로 carry-over (범위 재확인만).

## 참조

- 원본 감사: `docs/plans/2026-04-17-platform-deep-audit/refs/audits/03-module-architect.md`
- 인벤토리: `docs/plans/2026-04-17-platform-deep-audit/refs/shared/module-inventory.md`
- 엔진 규약: `apps/server/internal/engine/types.go:67-140`, `module_types.go:19-41`, `phase_engine.go:25-49`
- 핵심 변경: `apps/server/internal/module/crime_scene/combination.go:100-115, 151-194, 206-307, 527-533`
- graphify: `graphify-out/GRAPH_REPORT.md:19,22,39`
