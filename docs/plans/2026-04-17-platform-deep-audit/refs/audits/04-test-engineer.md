# 04 — Test Engineer Audit (Phase 19 W2 draft)

> 관점: 테스트 전략·인프라 (커버리지 게이트, skip 남용, flaky 계측, fixture, mockgen/testcontainers, CI 통합).
> 범위 외 — 각 도메인 누락 테스트는 해당 draft(01/02/05/06/09)로 `[cross:…]` 포워딩.
> 증거는 `refs/shared/test-baseline.md` §섹션 + 실측(2026-04-17).

## Scope

전 레포 테스트 인프라·전략·CI gate. 대상:
- Go `apps/server/**/*_test.go` (113 파일 · 987 `func Test*`) · `go test -race -coverprofile`
- Frontend `apps/web/src/**/*.test.{ts,tsx}` (108/1034) · `pnpm vitest run --coverage`
- E2E `apps/web/e2e/*.spec.ts` (12/68) · Playwright config·CI workflow
- CI workflows: `ci.yml` (go-check · ts-check · coverage-guard) · `flaky-report.yml` · `e2e-stubbed.yml`
- 비범위: 각 도메인 단위 테스트의 **부재**는 01/02/05/06/09 담당. 여기는 **전략·게이트·인프라**만.

## Method

1. 기존 `test-baseline.md` 재검증 + 3가지 delta 확인:
   - `ci.yml` coverage 게이트 동작(실측: `tail -20` + Codecov upload, 정량 fail 조건 0).
   - Go `t.Parallel()` 채택률 · mockgen `//go:generate` 선언 수.
   - Playwright flaky-report.yml 상태(`@flaky` 태그 grep) · MSW↔백엔드 contract 테스트 존재 여부.
2. Vitest `coverage` config 존재(`vitest.config.ts` v8 provider 확인) vs CI에서 실제 fail 여부.
3. testcontainers 파일 3건(editor ×2 + auditlog)의 재사용 패턴이 공용 fixture builder로 추출됐는지 점검.
4. E2E skip 35건을 "허용(8+3+3=14)" vs "해소 필요(18+3=21)"로 재분류.

## Findings

### F-test-1: 75% 커버리지 기준선이 CI에서 강제되지 않음
- Severity: **P1**
- Evidence: `.github/workflows/ci.yml:67-71` — `go test -race -coverprofile=coverage.out ./...` 후 `go tool cover -func=coverage.out | tail -20` 만 실행. `fail_ci_if_error: false` (line 79). `coverage-guard` job(line 141-155)은 `echo ::notice warn-only`·"Enforcement PR follow-up scheduled after 2026-05-28" 플레이스홀더만. 75% 임계 체크 코드 존재 0.
- Impact: CLAUDE.md·test-engineer 규약의 **"75%+ Go 커버리지"** 가 현재 0 기준선으로 동작. 32개 패키지가 75% 미달인 상태(`test-baseline.md §1.2`)로 main merge 허용됨.
- Proposal: `go-check` job에 `go tool cover -func=coverage.out | awk '/total/ {if ($3+0 < 75) exit 1}'` 게이트 추가(warn-only 페이즈 1주 → enforce). Codecov delta(기본↔PR)로 **regression ≤0%p** 게이트를 별도 추가(현재 fail_ci_if_error false).
- Cross-refs: `[cross:01]` (domain/*·infra/* 저커버 32패키지는 해당 팀이 보강), `[cross:08]` (문서상 75% 기준과 실제 CI gap — docs drift).

### F-test-2: 0% 커버리지 패키지 9개가 CI·릴리스 파이프라인에 그대로 통과
- Severity: **P1**
- Evidence: `cmd/server`·`internal/db`·`domain/{coin,creator,sound,voice}`·`infra/{otel,sentry,storage}` — `test-baseline.md §1.2` + `go test -cover ./...` 실측. `cmd/server`는 main 엔트리, `infra/otel`·`infra/sentry`는 관측 레이어 · `infra/storage`는 업로드 경로.
- Impact: 프로덕션 런타임 경로(main·관측·업로드)가 단위 테스트 없이 런칭. Phase 18.4 M-2 `TemplateHandler` 사건(= `http.Error` 우회, RFC 9457 미적용) 재발을 탐지할 테스트가 없음. 특히 `infra/sentry` 0%는 에러 마스킹 회귀가 조용히 누락.
- Proposal: 패키지별 **의도 제외 vs 추가** 결정 → "추가" 쪽은 PR 후보화. `cmd/server`는 `main_test.go`로 플래그 파싱·graceful shutdown smoke만, `infra/otel`은 `OTEL_EXPORTER=stdout` inject contract 테스트, `domain/coin`·`creator`는 sqlc + mockgen service 계약 3건.
- Cross-refs: `[cross:01]` (domain/{coin,creator,sound,voice} 실장 테스트), `[cross:05]` (`infra/sentry` redaction), `[cross:06]` (`infra/otel` 트레이스 hook 검증).

### F-test-3: `t.Parallel()` 채택률 <1% — race/goroutine leak 회귀 가시성 낮음
- Severity: **P1**
- Evidence: `grep -r 't\.Parallel()' apps/server` 실측 **5건 / 987 테스트**(0.5%). 채택된 파일은 `ws/hub_lifecycle_test.go`·`domain/room/service_test.go` 2개뿐. `-race` 플래그는 CI에서 활성화지만 관측 대상 goroutine이 거의 없어 효과 감소.
- Impact: 세션 수준 goroutine leak(Phase 7.7 후속에서 반복 제기)·WS broadcast fan-out race가 실제 병렬 재현되지 않아 drift. 현재 Go 테스트가 "singleton 시간순" 실행 패턴에 의존 → CI 시간 ≈2분으로 괜찮지만 **레이스 탐지 능력**은 이론치의 일부만 발휘.
- Proposal: 순수 함수·table-driven이 명확한 테스트부터 `t.Parallel()` 의무화(lint rule: `go vet` custom 또는 golangci-lint `paralleltest`). 상태 있는 fixture 테스트는 명시적으로 `// intentionally sequential: shared DB` 주석 요구.
- Cross-refs: `[cross:06]` (goroutine leak 계측 · pprof hook).

### F-test-4: `mockgen` 사용 0건 — 규약 위반 또는 규약 수정 필요
- Severity: **P2 (경계: P1 후보)**
- Evidence: `grep -r '//go:generate mockgen' apps/server` → **0건**(baseline §1.3). 수동 mock 1건(`domain/payment/mock_provider.go`). CLAUDE.md/Go 규약: "mockgen + testcontainers-go, 75%+ 커버리지".
- Impact: service 인터페이스 ↔ 실제 mock drift 위험. Handler 테스트 276 `httptest.New*` 대부분이 **concrete service**를 real impl으로 호출하는 integration 형태 → 실행 빠르지만 **경계면 계약** 단위가 아니라 광역. 규약과 실재 drift로 신규 팀원 onboarding 혼선.
- Proposal: **두 갈래 결정**. (A) 규약 유지 → `internal/domain/{auth,room,editor}/service.go` 3건에 `//go:generate mockgen` 선언 + `make mocks` target 도입. (B) 규약 수정 → CLAUDE.md에서 "mockgen 필수" 삭제하고 "service 인터페이스는 real impl + testcontainers 우선" 명문화. 현 실재는 (B)에 더 가까움.
- Cross-refs: `[cross:03]` (module-architect가 결정 의도 재확인), `[cross:08]` (문서·규약 업데이트).

### F-test-5: Vitest coverage 게이트는 existential하지만 임계 0 — 리그레션 무감각
- Severity: **P1**
- Evidence: `apps/web/vitest.config.ts:13-30` v8 provider·json-summary·json·html reporter 정의(baseline 작성 시점보다 개선). `ci.yml:120-136`: `pnpm --filter @mmp/web test:coverage` + Codecov upload + `vitest-coverage-report-action` PR summary. **그러나** `fail_ci_if_error: false`(line 129) + 수치 임계 비교 로직 0 + `coverage-guard` warn-only(F-test-1과 동일 placeholder).
- Impact: coverage 리포트 생성·Codecov 적재는 OK. 하지만 PR이 커버리지 20%p 떨어트려도 CI green. Phase 18.6 ThemeCard schema drift처럼 reducer·handler drift가 커버리지 저하로 선행 신호를 주지 못함.
- Proposal: `ci.yml ts-check`에 `jq '.total.lines.pct' coverage/coverage-summary.json` 으로 기준선 게이트(초기 60% → 분기별 +5%p). 또는 davelosert action의 `comment-on: pr`만이 아니라 `thresholdLines: 60` 옵션 활용.
- Cross-refs: `[cross:02]` (frontend가 대상 슬라이스 비율 측정 후 현실적 임계 제안).

### F-test-6: `@flaky` 태그 0건 · flaky-report 워크플로우가 "영원히 비어있음"
- Severity: **P2**
- Evidence: `.github/workflows/flaky-report.yml:1-190` Monday 06:00 UTC cron · `--grep @flaky --retries=3` · **그러나** `apps/web/e2e/**`에서 `@flaky` 태그 붙은 테스트 0건(주석 언급 2건 — `common.ts:177`·`clue-relation-stubbed.spec.ts:13,16`은 계획만). "Artifact-only for now — issue bot auto-creation is a follow-up"(line 4) 상태 유지 중.
- Impact: Phase 18.1·18.6·18.8 progress에 기록된 실재 flaky 패턴(`H7 MaxPlayers`·`4-context party WS handshake race`)이 **태그 없이 수정 후 종결** → 회귀 감시 루프 없음. 워크플로우 실행 비용(postgres+redis+goose+server+playwright) 전부 소비하면서 대상 0건.
- Proposal: **정리 2안**. (A) 실제 flaky 기록된 테스트 3-5건에 `@flaky` 태그 추가 + Phase 18.8 PR-5 완료 시 `game-session-live`의 handshake race 케이스를 명시 태깅. (B) 현재 태그 0 상태면 `flaky-report.yml` 실행을 `workflow_dispatch` 전용으로 스위치 + README에 "태그 생성 시 cron 재활성" 안내.
- Cross-refs: `[cross:06]` (flaky 근본 원인 중 goroutine/timing 부분).

### F-test-7: MSW 핸들러 ↔ 백엔드 envelope_catalog 자동 drift 검증 0
- Severity: **P1**
- Evidence: MSW handler 6개(`auth/clue/game-ws/index/room/theme`). 검색 `contract_test|contract.test|contract.spec` → **0 매치**. `mmp-ws-contract` 스킬은 수동 체크리스트만 제공, 자동 검증 파일 부재. baseline §1.3·4 scope-matrix 09 cross 플래그 이미 기록.
- Impact: 백엔드 `ws/envelope_catalog.go`에 새 타입 추가 후 MSW 핸들러 미반영 → Vitest는 통과, E2E stubbed도 통과(핸들러가 이벤트를 전혀 emit 안 함), **실제 런타임만 `unknown message type` warning**. 이는 severity-rubric 경계 케이스의 P1 예시 정확히 해당(`docs/plans/.../severity-rubric.md §29-31`).
- Proposal: 백엔드에서 `envelope_catalog.go` → `envelopes.json` 스냅샷 생성(`go generate`) · 프론트 vitest에서 `import json` 후 MSW handler module이 해당 이벤트 key를 export하는지 `expect.objectContaining(envelopes)` 어설션. CI에서 envelope snapshot이 handler index보다 새로우면 fail.
- Cross-refs: `[cross:09]` (WS contract primary), `[cross:02]` (reducer 측 대응).

### F-test-8: E2E skip 35건 중 **21건이 "허용" 아닌 "미해결 gap"** — 플래그와 근본원인 혼재
- Severity: **P1**
- Evidence: baseline §3.2 — 선행 상태 미충족 18건 + 데이터 부족 3건 = 21건이 "backend 또는 PLAYWRIGHT_BACKEND gate"가 아니라 state/seed guard로 skip. 대표: `game-redaction` 4건·`game-session` 7건·`game-visual` 4건·`game-reconnect` 2건. Phase 18.6→18.8 기간에 skip이 11→35로 증가한 원인의 핵심. 스텁 복제본은 `game-redaction-stubbed`·`clue-relation-stubbed` 두 개만 존재, `game-session-live` 복제본은 **없음**(baseline §3.3 "gap — PR-5 계획").
- Impact: "stubbed CI green"이 실제 커버리지 허상. Phase 18.8 PR-5가 아직 open이면 production WS race regression 감지 수단이 여전히 nightly(PLAYWRIGHT_BACKEND)에만 의존.
- Proposal: Phase 19 PR 후보로 (a) `game-session-stubbed.spec.ts` 복제 추가 · (b) state guard 18건을 "helper `ensureGamePage()` 수렴" 패턴으로 전환하여 skip이 아닌 fixture setup 실패로 전환(실패 시 reason 명시) · (c) seed fixture(단서 2개) 추가로 clue-relation-live 3건 해소.
- Cross-refs: `[cross:09]` (WS 스냅샷 resume fixture), `[cross:02]` (frontend fixture helper).

### F-test-9: `testcontainers` 3건이 공용 fixture helper로 추출되지 않음
- Severity: **P2**
- Evidence: `grep testcontainers` → 3 파일: `domain/editor/clue_relation_test_fixture_test.go`, `domain/editor/clue_relation_service_test.go`, `auditlog/store_test.go`. `apps/server/**/testfixture*.go` glob 0 매치. 각 테스트가 Postgres 컨테이너 spin-up·migration 로직을 개별 소유.
- Impact: 0% 커버리지 9패키지 중 `infra/postgres`·`infra/cache` 보강 시 같은 boilerplate를 또 복제해야 함 → fixture idempotency 위반 가능성 증가. t.Cleanup 패턴 28건(baseline §1.3)은 양호하지만 helper 없이 파편화.
- Proposal: `apps/server/internal/testfixture/postgres.go` + `redis.go` helper 도입(signature: `NewPostgres(t *testing.T) (*sql.DB, cleanup)`). 기존 3 파일 리팩터 + F-test-2에서 제안한 infra/* 테스트 작성 시 재사용.
- Cross-refs: `[cross:01]` (domain/* 저커버 보강 시 helper 필요), `[cross:06]` (infra/otel 관측 테스트 동일 패턴).

### F-test-10: Integration-heavy, contract-light — 빠르지만 경계면 신호 부족
- Severity: **P2**
- Evidence: `httptest.New*` 276건 / 27 파일(handler 전반). 반면 service 인터페이스 단위 mock 기반 테스트 1건(`payment`). **handler→service→repo 전체**를 실제 wiring으로 돌림 → 실행 2분, 디버깅 시 failure localization이 어려움. 공용 fixture 없이 각 테스트가 server builder 반복.
- Impact: Phase 18.7 migration drift hotfix 같은 "중간 계층 단독" 회귀가 handler 테스트 레이어에서 노이즈로 묻힘. 신규 도메인(creator settlement 등) 추가 시 boilerplate 비용 선형 증가.
- Proposal: 신규 도메인은 **contract 3단 분리**: (i) service unit(mock repo, mockgen 결정 따름), (ii) repo integration(testfixture helper), (iii) handler e2e(한 케이스). 기존 handler 테스트는 그대로 두되 신규 코드는 패턴 채택(강제 아님 → 점진). 리팩터 backlog는 F-test-9 helper 선행 조건.
- Cross-refs: `[cross:01]` (계층 경계 이슈와 같은 뿌리), `[cross:03]` (module은 이미 분리 잘 됨 — 패턴 참고).

## Metrics

| 지표 | 값 | 목표 | 출처 |
|-----|----|-----|-----|
| Go 커버리지 평균 | 44.6% | ≥75% | `test-baseline.md §1.2` |
| Go 0% 패키지 | 9 | 0 (의도 제외 3 한계) | §1.2 |
| `t.Parallel()` 채택률 | 5/987 = 0.5% | ≥30% | 실측 grep |
| `mockgen` 선언 | 0 | 결정 필요 | §1.3 |
| Vitest 수 / pass | 1034 / 1034 | - | §2.1 |
| Vitest coverage 게이트 | warn-only | 임계 60%p 하드 fail | `ci.yml:141` |
| E2E skip 분류 | 14 허용 / 21 gap | gap ≤5 | §3.2 |
| `@flaky` 태그 | 0 | ≥3 or workflow 비활성 | 실측 |
| testcontainers fixture helper | 없음 | `internal/testfixture/*` | §3.5 |
| P0 / P1 / P2 | 0 / 6 / 4 | P0+P1 ≥50% → **60% OK** | 본 draft |

## Advisor-Ask

1. **mockgen 규약** — CLAUDE.md가 요구하는 "mockgen + 75%"는 현재 코드베이스(integration 중심)와 상충. Advisor: 규약을 (A) "mockgen 재도입 + F-test-4 (A)안"으로 정렬할지, (B) "integration 우선 + mockgen은 신규 3rd-party provider만"으로 문서 수정할지 결정 필요. 본 draft에서는 결정 보류.
2. **커버리지 임계 ramp** — F-test-1/F-test-5에서 초기 60% → 분기별 +5%p 제안. Advisor: Phase 19 backlog에 "커버리지 게이트 PR"을 **단일 PR(모든 영역 한 번에 hard-fail)** 로 둘지, **영역별 점진(backend → frontend → e2e)** 로 둘지 선호를 지정해달라.
3. **E2E skip gap 21건 해소 로드맵** — F-test-8에서 (a)(b)(c) 3단계 제안. Phase 18.8 PR-5가 열려있다면 19 backlog로 흡수할지, 18.8 내에서 추가 PR-6로 처리할지는 phase 경계 결정 필요. 본 draft는 19로 가정.
