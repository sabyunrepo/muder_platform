# Test Engineer Delta — Phase 19 F-04 → Phase 20 (2026-04-18)

> **Window:** `ba20344` (Phase 19 final) → `23c925c` (main, 2026-04-18) · ~1.5일
> **기반:** Phase 19 F-04 (P0:0 / P1:6 / P2:4, 10 findings) + `test-baseline.md` (2026-04-17 실측)
> **실측:** `go test -cover` 2026-04-18 (apps/server 모듈 루트).
> **범위:** Phase 20(#71~#78) + graphify 툴링(#79~#81)로 추가·삭제된 테스트 파일만. 비범위 영역은 variant 추정.

## 1. Phase 19 F-04 Finding별 해소 상태

| ID | Title | Sev | Phase 20 이후 상태 | 증거 |
|----|-------|-----|------|------|
| F-test-1 | 75% Go coverage gate CI 미강제 | P1 | **UNCHANGED** | `.github/workflows/ci.yml:70-79` · `tail -20`만 실행 / `fail_ci_if_error: false` / `coverage-guard:141-155` warn-only placeholder 유지 |
| F-test-2 | 0% 커버리지 패키지 9건 | P1 | **UNCHANGED (9/9 여전)** | 실측: `cmd/server`·`db`·`domain/{coin,creator,sound,voice}`·`infra/{otel,sentry,storage}` 전부 0.0% 그대로. coin/creator는 `ok` 빌드로 바뀌었으나 테스트 0 |
| F-test-3 | `t.Parallel()` 채택률 0.5% | P1 | **UNCHANGED** | 신규 delta 테스트 27개 파일 중 `t.Parallel()` 호출 0건 (clue/graph·round_filter·clue_edge_handler 전부 sequential) |
| F-test-4 | mockgen 0건 (규약 drift) | P2 | **WORSE (역주행)** | Phase 19 backlog PR-5가 mockgen **재도입** 결정했으나 Phase 20은 결정 불이행. `clue_relation_service_test.go`(testcontainers+integration) 삭제 → `clue_edge_handler_test.go`(수동 `mockService` 구조체 확장)로 대체 → 수동 mock 면적만 늘었고 `//go:generate mockgen` 여전히 0건 |
| F-test-5 | Vitest coverage threshold 0 | P1 | **UNCHANGED** | `apps/web/vitest.config.ts` threshold 미설정 / `ci.yml:120-133` Codecov + vitest-coverage-report-action 그대로 / `fail_ci_if_error: false` |
| F-test-6 | `@flaky` 태그 0건, flaky-report 공회전 | P2 | **UNCHANGED** | Phase 20 신규 E2E `clue-edges-stubbed.spec.ts` 주석에 "CI shard에서 flaky 관측 시…" 언급만. 실제 `@flaky` 태그는 여전히 0건 |
| F-test-7 | MSW↔envelope_catalog 자동 drift 검증 0 | P1 | **UNCHANGED** | Phase 20 변경 범위는 HTTP(clue-edges) 한정. WS envelope/handler 대조 아직 미구현. `contract_test` 0 매치 유지 |
| F-test-8 | E2E skip 21건 gap | P1 | **PARTIAL REGRESSION** | `clue-relation-live.spec.ts` → `clue-edges-live.spec.ts` rename + 구조 유지. Live에는 여전히 4 skip(backend gate 1 + "단서 2개 미만" 2 + "엣지 없음" 1). **Stubbed 복제본(PR-6) 추가는 +항목** (clue-edges-stubbed 3 테스트, skip 0). `game-session-stubbed` 여전히 gap |
| F-test-9 | testcontainers fixture helper 추출 안 됨 | P2 | **PARTIAL (half-step)** | `clue_relation_test_fixture_test.go` → `test_fixture_test.go`로 rename + setupFixture() 헬퍼 추출. **그러나** `internal/testfixture/` 공용 모듈이 아닌 editor 패키지 내부 국한. auditlog/store_test.go는 여전히 별도 boilerplate 보유 |
| F-test-10 | integration-heavy, contract-light | P2 | **MIXED** | delta의 `clue_edge_handler_test.go`는 contract-light 스타일(5 pure mock tests: empty/OK/invalid-json/cycle/craft-or)로 **개선**. 반대로 `clue_relation_service_test.go`(testcontainers integration) 삭제 → integration 단위 테스트 커버리지 손실 |

**요약:** P1 6건 중 해소 0 / partial 2 (F-test-8/10) / 역주행 0 · **P1 미해소 4건 유지**. P2 4건 중 해소 0 / partial 1 (F-test-9) / 역주행 1 (F-test-4).

## 2. 신규 Finding (D-TE-N)

### D-TE-1 · `domain/editor` 커버리지 19.6% → **16.7% 하락** (P1, New)
- **증거:** Phase 19 baseline `domain/editor` 19.6% (`test-baseline.md §1.2`) vs 2026-04-18 실측 16.7% (실측 로그: `go test -cover ./internal/domain/editor/...` 7.264s).
- **원인:** Phase 20 PR-4가 `clue_relation_service.go` + `clue_relation_service_test.go`(testcontainers integration — 약 300줄 추정) **삭제**하고 `clue_edge_service.go` + `service.go` 내 통합 구현 추가. 새 통합 구현에 대한 단위 테스트 보강 없이 `clue_edge_handler_test.go` 핸들러 레벨만 추가 (mock 기반) → statement 분모 증가, 실행 분자는 미증가.
- **영향:** 신규 AUTO/CRAFT trigger 로직·편집 파이프라인이 가장 취약한 구간에서 커버리지 선행 신호 더 흐림.
- **제안:** Phase 21에서 `clue_edge_service_test.go` 신설 (service layer unit — AUTO/CRAFT branch × cycle × orphan-source 3 매트릭스). F-test-2 해소 PR과 병합 권장.

### D-TE-2 · E2E 데이터-부족 skip 패턴 복제 (P2, New)
- **증거:** `clue-edges-live.spec.ts:58/84/113` — `if (count < 2) test.skip(true, "단서가 2개 미만")` / `"엣지가 없음"`. 이는 F-test-8에서 "state guard 18건"으로 분류한 **동일 패턴이 신규 spec에도 재현**됨.
- **영향:** Phase 19가 "skip이 아닌 fixture setup 실패로 전환"을 제안했는데 Phase 20이 기존 패턴을 답습. live spec skip 집계 상향 압력.
- **제안:** Phase 21 E2E skip-recovery PR에 `ensureSeedClues(n)` 유틸 + `test.fail()` 전환 포함. 혹은 `beforeAll` 시드 fixture(단서 2개 필수) 주입.

### D-TE-3 · React Flow 렌더 타이밍 동기화 주석만 존재, 실제 동기화 포인트 없음 (P2, New)
- **증거:** `clue-edges-stubbed.spec.ts:13-17` 주석 "CI shard에서 flaky가 관측되면 `.react-flow__viewport` waitFor 동기화 포인트를 추가하고 retry는 도입하지 않는다" — 예방 주석만 있고 실제 동기화는 `toHaveCount(3)` + `FLOW_TIMEOUT=10s`로만 완화.
- **영향:** React Flow fitView 애니메이션 완료 전 `data-id="..."` 노드 클릭 테스트(line 59-70)는 동기화 포인트 부재 → CI shard race 조건 재현 가능.
- **제안:** `.react-flow__viewport` transform 안정화 waitFor + React Flow `onInit` 콜백 훅킹. Playwright retries=2는 race 마스킹이므로 유지 금지.

### D-TE-4 · `mockService` 거대 스텁 패턴 (P2, New)
- **증거:** `apps/server/internal/domain/editor/handler_test.go:21-150` — 30+ 메서드 stub 구조체 수동 관리. Phase 20에서 `getClueEdgesFn`·`replaceClueEdgesFn` 2 필드 추가. `internal/domain/editor` Service 인터페이스 변화마다 이 파일 수동 편집 필수.
- **영향:** Phase 19 Resolved Decision #3("mockgen 재도입")과 상충. Service 인터페이스 drift 위험이 눈에 띄지 않게 누적 중.
- **제안:** Phase 19 backlog PR-5 실행 시 **최우선** 대상이 이 파일. `//go:generate mockgen -source=service.go` + `make mocks` target → `mockService` 수동 구조체 삭제.

### D-TE-5 · Vitest hoisted mock 복잡도 증가 (경미, Info)
- **증거:** `CluesTab.test.tsx:7-51` — `vi.hoisted` + 7개 `vi.mock` (sonner / react-query / Spinner / Modal / Button / editor-api / ClueForm / ImageUpload / ClueCard). 유닛 경계가 과하게 shallow. `ClueCard.test.tsx`는 정상 통합.
- **영향:** mock surface 확대 → 구현 변경 시 테스트 수정 부담 증가. fixture idempotent 여부는 OK (`afterEach(cleanup)`).
- **제안:** react-testing-library의 `render(...)` 단위에서 `ClueCard` 같은 순수 표현 컴포넌트는 mock하지 않고 렌더 위임. 차기 리팩터 backlog.

## 3. 커버리지 변화 수치 (실측 2026-04-18)

| 패키지 | Phase 19 baseline | Phase 20 head | Δ |
|-------|------|------|---|
| `internal/clue` | 97.0% | **96.9%** | -0.1%p (신규 round_filter 추가) |
| `internal/engine` | 88.7% | **88.8%** | +0.1%p |
| `internal/module/crime_scene` | (not isolated) | **92.9%** | (unchanged baseline 88%+) |
| `internal/domain/editor` | 19.6% | **16.7%** | **-2.9%p (D-TE-1)** |
| 0% 패키지 | 9 | **9** | **±0 (미해소)** |

**종합:** 핵심 delta 범위(clue·engine·crime_scene)는 이미 ≥88% 유지. 회귀 지점은 `domain/editor` 단일. 75% 미달 32패키지 수치는 재측정 필요하나 delta window에서 증가 요인은 없음(0% 9건 + editor 하락).

## 4. E2E Skip 변화

| 구분 | Phase 19 baseline | Phase 20 head |
|------|-------------------|----------------|
| 전체 spec 파일 | 12 | **12** (clue-relation rename → clue-edges, editor-golden-path 기존, +clue-edges-stubbed 신규 = +1 새로 -1 rename 상쇄 후 12 유지)  ※ `clue-relation-live`→`clue-edges-live` + `clue-relation-stubbed`→`clue-edges-stubbed` + `clue-relation.spec.ts`(legacy) 제거 |
| 전체 test 수 | 68 | ~66 (대략, rename + 신규 stubbed 3 + legacy 제거로 순증 소폭) |
| skip 총계 | 35 | ~31 (데이터 부족 3건 clue-relation-live → clue-edges-live에 유지 + backend-gate 3~4건 net 감소) |
| Stubbed 복제 커버 | game-redaction, clue-relation | **+ clue-edges** / game-session-live stubbed 여전히 gap |

**주요:** `clue-edges-stubbed.spec.ts`는 skip 0건으로 모범 사례. 단, 노드 클릭 race 취약(D-TE-3). Live 쪽은 데이터 부족 3건 스킵 패턴 답습(D-TE-2).

## 5. Phase 19 backlog PR-5 영향 범위 재산정

원 scope: CI coverage gate + mockgen 재도입 + 0% 9패키지 전략.

Phase 20 이후 변경:
- **mockgen 재도입 범위 확장** — `domain/editor` Service 인터페이스에 `GetClueEdges`/`ReplaceClueEdges` 2 메서드 추가됨. 수동 `mockService`는 현재 30+ 메서드로 비대. mockgen 전환 비용 **증가**.
- **0% 9패키지 그대로** — PR-5 전략 (infra 3건 테스트 + cmd/db "intentionally excluded") 유효. 재조정 불필요.
- **editor 커버리지 D-TE-1이 동반 처리 필요** — PR-5에 `clue_edge_service` 단위 테스트 3-5건 추가 sub-task로 편입 권장.
- **testfixture helper 반쯤 추출** (F-test-9 partial) — PR-5에서 `internal/testfixture/postgres.go` 공용화 시 editor 패키지 helper + auditlog 중복 제거 1회에 가능.

**결론:** PR-5 size **L → XL**. sub-task 4건 추가(clue_edge_service unit, mockService → mockgen 전환, testfixture 공용화, Codecov threshold config). 리스크 여전히 High.

## 6. graphify 커뮤니티 경계 변화

- **Community 0 "Accusation Module & Tests" (136 nodes)** — delta window 내 node 추가 없음. Phase 20은 clue 영역이라 커뮤니티 접점 낮음.
- **Community 4 "Accusation Handler & Crime Scene Tests" (146 nodes)** — `TestGetClueEdges_Empty/OK`·`TestReplaceClueEdges_CycleDetected` 3건이 신규 testMemberName으로 보임 (line 672). 커뮤니티 테스트 전체가 같이 군집화 → 좋은 신호(서비스 + 테스트 공동 진화).
- **Community 10 "Clue Graph & Validation" (106 nodes)** — `clue.ts` mock handler + `clue_graph_resolve` + `clue_visibility_computevisible`이 함께 cluster. 신규 round_filter는 소규모 sub-cluster.
- **Community 135 "Clue Edges E2E Test Suite" (3 nodes)** — line 592: `e2e_clue_edges_live`·`e2e_clue_edges_stubbed`·`e2e_clue_edges` 독립 클러스터 형성. 단 3 nodes로 thin — 체크리스트·DAG와 교차 연결 부족.
- **Thin communities 다수** — `ClueCard.test.tsx`(229), `ClueListRow.test.tsx`(230), `useClueEdgeData.revert.test.ts`(237), `CluePlacementPanel.test.tsx`(401), `LocationClueAssignPanel.test.tsx`(404), `ClueForm.test.tsx`(412), `clueGraphValidation.test.ts`(415) 등이 전부 **2 노드 이하로 고립** — 실제 코드 참조 대비 그래프 링크 부족. Phase 21에서 테스트 인용 정책 검토 후보.

## 7. 우선순위 제안

1. **P1 · D-TE-1 해소** — `clue_edge_service_test.go` 신설 (AUTO/CRAFT branch × cycle × orphan 3매트릭스). Phase 19 PR-5에 sub-task 포함. 2-4h.
2. **P1 · F-test-1/5 게이트** — 기존 backlog PR-5 유지. **우선순위 상향** (Phase 20이 coverage 하락까지 발생시킴).
3. **P2 · D-TE-4 mockService → mockgen** — PR-5 sub-task. editor service 30+ 메서드 → generated mock. 기존 mockService.getClueEdgesFn 등 수동 필드 정리.
4. **P2 · D-TE-2 E2E 시드 fixture** — `ensureSeedClues(2)` helper + `test.fail()` 전환. Phase 18.8 PR-5 계획과 합쳐 일괄 처리.
5. **P2 · D-TE-3 React Flow 동기화** — `.react-flow__viewport` transform 안정화 wait. 단독 hotfix 1h. 현재 stubbed CI 기준 green이나 shard/parallel 환경에서 flaky 위험.
6. **Info · D-TE-5** — 차기 리팩터 backlog.

## 부록 · 실행 로그

```
$ cd apps/server && go test -cover ./internal/clue/... ./internal/domain/editor/... \
    ./internal/engine/... ./internal/module/crime_scene/...
ok  internal/clue               0.498s  coverage: 96.9%
ok  internal/domain/editor      7.264s  coverage: 16.7%    ← D-TE-1
ok  internal/engine             0.825s  coverage: 88.8%
ok  internal/module/crime_scene 0.453s  coverage: 92.9%

$ go test -cover ./cmd/server/... ./internal/{db,domain/{coin,creator,sound,voice}, \
    infra/{otel,sentry,storage}}/...
cmd/server                  0.0%   (no test)
internal/db                 0.0%   (no test)
internal/domain/coin        0.0%   ok (no test funcs)
internal/domain/creator     0.0%   ok (no test funcs)
internal/domain/sound       0.0%   (no test)
internal/domain/voice       0.0%   (no test)
internal/infra/otel         0.0%   (no test)
internal/infra/sentry       0.0%   (no test)
internal/infra/storage      0.0%   (no test)
```

- mockgen 재도입 확인: `grep -rn '//go:generate mockgen' apps/server` → **0건** (backlog PR-5 결정 미이행)
- testcontainers 파일: 2 파일로 축소 (`editor/test_fixture_test.go`, `auditlog/store_test.go`) — 1건 rename, 공용 helper 여전히 부재
- E2E `@flaky` 태그: **0건** 유지
