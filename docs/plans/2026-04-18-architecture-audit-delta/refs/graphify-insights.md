# graphify 구조 insight (Phase 19 → 20 delta)

> **작성 시점:** 2026-04-18
> **데이터 소스:** `graphify-out/GRAPH_REPORT.md` (6700 nodes / 15398 edges / 531 communities, EXTRACTED 50% + INFERRED 50% avg conf 0.8)
> **Phase 19 ref:** `docs/plans/2026-04-17-platform-deep-audit/` (89 findings)

## Method

graphify 재인덱싱(2026-04-18 09:01)으로 Phase 19 당시 보지 못한 **구조적 패턴**을 추출. 본 문서는 전문가 subagent 영역 감사와 **중복되지 않는** 그래프 고유 인사이트만 기록.

## Key Findings (그래프 고유)

### GI-1 (P1) `unlock()`/`Lock` 과다 허브 — mutex 경합·데드락 리스크
- **근거:** `unlock()` 301 edges + `Lock` 300 edges → **601 edges (전체의 3.9%)가 2개 노드에 집중**
- **의미:** Session Actor Model hyperedge가 있음에도(inbox-based concurrency) mutex 기반 lock이 여전히 광범위. actor 경계 밖에서 락 공유 중.
- **교차:** Phase 19 F-06 perf-observability에 "goroutine leak" P0 있음 — 락 오용과 연관 가능성.
- **제안:** `graphify path "Session Actor" "Lock"`로 실제 경로 확인 후 **mutex hotspot audit (D-PERF-1)** 도출. Phase 21 후보.

### GI-2 (P1) `WriteError()` + `writeJSON()` 병존 → AppError 경로 비일관성 구조적 증거
- **근거:** `WriteError()` 153 edges + `writeJSON()` 119 edges = **272 edges**. 두 헬퍼가 병존하며 과반 handler가 둘 중 하나 선택.
- **의미:** Phase 19 F-05 P0 #1 "RFC 9457 우회 12건"의 **구조적 뿌리**. `writeJSON()` 쓰는 handler 119개 중 일부가 AppError 미적용.
- **교차:** Phase 19 backlog **PR-3 HTTP Error Standardization**과 직접 연결 — 우선순위 **상향 근거 확보**.
- **제안:** `graphify explain "writeJSON"`로 호출자 enum → PR-3 scope 산정.

### GI-3 (P1) `New()` / `NewHandler()` 수동 DI 허브 — 대규모 생성자 의존
- **근거:** `New()` **562 edges** (전체 1위), `NewHandler()` 118 edges
- **의미:** 프로젝트 규칙(수동 DI, 생성자 주입)에 따른 결과지만 의존성 교차가 크다. 모듈 하나 추가 시 생성자 chain 수정 많음.
- **제안:** 우선순위 낮음. Phase 21 이후 backlog: **Module Factory & Registry 커뮤니티 기준 Builder 패턴 도입 타당성 조사**.

### GI-4 (P2) `newTestDeps()` 275 edges — 테스트 결합도
- **근거:** 단일 헬퍼 **275 test edges** (God Node 4위). Phase 19 F-04 coverage 갭과 별개 우려.
- **의미:** 도메인 변경 시 `newTestDeps()` 수정 → 275 테스트 동시 리빌드. 테스트 회귀 폭 크다.
- **제안:** Phase 19 backlog **PR-5 (Coverage Gate + mockgen 재도입)** scope 확장 검토 — 도메인별 fixture 분리 (`newEditorDeps`, `newRoomDeps`, `newClueDeps`).

### GI-5 (P2) Thin community 300+개 — Feature Orphan / 저Coupling 후보
- **근거:** Knowledge Gaps 섹션에 **2-node thin community 300+개**. 예: `OfflinePage.tsx`+함수, `NotFoundPage.tsx`, `CreatorSettlementsPage`, `AdminRevenuePage`, `ShopHistoryPage`, `AdminSettlementsPage` 등 **Admin/Creator 페이지 다수**.
- **의미:** 라우터 외 다른 feature와 엣지 약함. graphify AST 한계도 있지만 일부는 실제 기능 고립 / dead code 후보.
- **제안:** `graphify explain "<page>"` 로 각 페이지 실제 의존 확인 → **dead code candidate 목록** 생성. Phase 19 F-08 (docs-navigator module drift 29→33)와 교차.

### GI-6 (INFO 긍정 신호) Clue Discovery Pipeline 명시화 — Phase 20 성과
- **근거 Hyperedges (신규):**
  - `Clue Discovery Pipeline: Graph.Resolve → FilterByRound → ComputeVisible` [INFERRED 0.85]
  - `Editor clue+location+validation share owned-theme guard pattern` [INFERRED 0.85]
  - `Clue DAG cycle detection (editor + runtime)` [INFERRED 0.80]
  - `ClueEdgeGraph graph components: ClueNode + RelationEdge` [EXTRACTED 1.00]
- **의미:** Phase 19 당시 scattered했던 clue 로직이 이제 **명시적 파이프라인**으로 보임. Phase 20 승격이 아키텍처 명료성에 긍정적.
- **교차:** Phase 19 F-05 security — owned-theme 가드 공유 패턴이 그래프에 나타남 = 일관성 **확인됨** (이전에 공백 우려 있던 영역).

### GI-7 (P2) Audio/Video Orchestrator 이중화 — 통합 후보
- **근거:** Surprising Connection `VideoOrchestrator --shares_data_with--> AudioOrchestrator` [INFERRED]
- **의미:** 두 orchestrator가 유사 구조 + 실제 데이터 공유. 공통 MediaOrchestrator 추출 가능성.
- **제안:** 저우선. Phase 21 이후 **media consolidation 후보**.

### GI-8 (P1) 규칙 문서 ↔ 실제 구현 엣지 약함
- **근거:** Surprising Connection `Go Backend Coding Rules --rationale_for--> AppError` [INFERRED]. 두 노드 사이에 INFERRED edge 1개뿐.
- **의미:** CLAUDE.md 규칙이 apperror.go 내부 comment/docstring으로 참조되지 않음. 새 handler 작성자가 규칙 몰라도 컴파일 통과. 구조적 레민더 부재.
- **제안:**
  - `apps/server/internal/apperror/apperror.go` 상단에 "Coding rule: CLAUDE.md § Go 백엔드" comment 추가
  - Phase 19 backlog PR-3와 병합 가능한 **linter rule** (ex: go vet custom check for `writeJSON` 직접 호출 금지)

## Community Structure Observations

### 의미있는 라벨(상위 30)
Phase 20 이후 라벨링된 커뮤니티에는 **Editor 중심 군집이 6개** (Editor State Handlers, Editor Module Tabs, Editor Config & Flow Design, Characters Tab, Clue Interaction & Editor API, Clue Graph & Validation). Editor 영역이 구조적으로 가장 복잡 = 추가 리팩터 가치.

### Session Actor 관련 커뮤니티 없음
`Session Actor Model` 하이퍼엣지는 있지만 별도 커뮤니티로 분리 안 됨. GI-1 (mutex 과다)과 결합하면 actor model이 그래프상 "isolated cluster"가 아닌 **mutex-heavy 도메인과 얽혀있음** 시사.

## Phase 19 Backlog 우선순위 영향

| Phase 19 PR | graphify 증거 보강 | 우선순위 변화 |
|-------------|---------------------|--------------|
| PR-3 HTTP Error Standardization | GI-2 (WriteError/writeJSON 272 edges) | **상향** (구조적 과다 확인) |
| PR-4 File Size Refactor | 영역별 subagent에 맡김 | 변동 없음 |
| PR-5 Coverage Gate + mockgen | GI-4 (newTestDeps 275 edges) | scope 확장 (fixture 분리) |
| PR-6 Auditlog Expansion | graphify 직접 증거 없음 | 변동 없음 |

## 신규 Phase 21 후보 (graphify 고유)

- **D-PERF-MUTEX (P1):** `unlock()`/`Lock` 601 edges 집중 점검. actor 경계 재확인.
- **D-ARCH-ORPHAN (P2):** Admin/Creator 페이지 thin community 정리 (dead code 감사).
- **D-ARCH-MEDIA (P2):** Audio/Video orchestrator 통합 가능성 검토.
- **D-DEV-RULE (P1):** CLAUDE.md 규칙 → 코드 comment/linter 자동화로 구조적 엣지 강화.

## Cross-reference (subagent 결과와 합쳐야)

다음 domain subagent 결과와 합쳐 `synthesis.md`에서 통합:
- `go-backend-delta.md` — GI-2 (WriteError/writeJSON), GI-8 (규칙 엣지)과 교차
- `test-delta.md` — GI-4 (newTestDeps fixture)과 교차
- `react-delta.md` — GI-5 (페이지 thin community)와 교차
- `module-delta.md` — GI-7 (Orchestrator 통합)과 교차
- `security-delta.md` — GI-6 (owned-theme 가드 패턴) 일관성 확인
