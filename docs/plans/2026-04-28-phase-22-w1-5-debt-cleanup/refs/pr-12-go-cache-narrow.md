# PR-12 — actions/setup-go cache narrowing (build cache 제외)

> Parent: [`../checklist.md`](../checklist.md)

**Goal**: `actions/setup-go` 의 default cache 가 `~/go/pkg/mod` + `~/.cache/go-build` 둘 다 push → 매 run 마다 build cache 누적 폭증 (369MB → 2.4GB+). `cache: false` + 명시적 `actions/cache` step 으로 `~/go/pkg/mod` 만 cache 하여 baseline 회복.

## 진단 데이터 (PR-172 stuck 시점, 2026-04-29)

GHA cache 크기 history (`gh cache list`):

| 시점 | Go cache key | 크기 |
|---|---|---|
| 2026-04-22 (Go 1.25.9) | `setup-go-Linux-x64-ubuntu24-...` | 611MB |
| 2026-04-28 09:27 (Go 1.25.0) | `setup-go-Linux-x64-undefined-go-1.25.0-...` | **369MB** ← 정상 baseline |
| 2026-04-28 17:35 (Go 1.24.13) | `setup-go-Linux-x64-undefined-go-1.24.13-...` | 934MB |
| 2026-04-28 23:26 (Go 1.24.13) | 동일 | 1,009MB |
| 2026-04-29 00:37 (Go 1.24.13) | 동일 | 1,017MB |
| 2026-04-29 00:47 (Go 1.25.0) | 동일 | 2,549MB |
| 2026-04-29 01:31 (Go 1.24.13) | 동일 | **2,312MB** |

PR-172 의 E2E shard 4개 모두 "Setup Go" 단계에서 5분+ stuck:
```
Cache hit for: setup-go-Linux-x64-undefined-go-1.24.13-...
Received 0 of 1009429718 (0.0%), 0.0 MBs/sec  ← 1GB stuck
Received 0 of 1009429718 (0.0%), 0.0 MBs/sec
```

GHA cache (Azure blob) → containerized runner (`runners-net` bridge) throughput 정체 + 1GB+ tar 추출 비용.

## Root cause

`actions/setup-go@v5` default 동작:
- `~/go/pkg/mod` (GOMODCACHE) cache push
- `~/.cache/go-build` (GOCACHE) cache push ← **이것이 폭증 원인**

testcontainers-go + race-instrumented test build 의 incremental build cache 가 매 run 마다 누적되어 cache key 안에서 size 폭증.

## 변경 요약

| 파일 | setup-go 호출 수 | 변경 |
|---|---|---|
| `.github/workflows/ci.yml` | 2 (`go-check`, `coverage-guard`) | `cache: false` + `actions/cache` step 추가 |
| `.github/workflows/e2e-stubbed.yml` | 1 | 동일 |
| `.github/workflows/security-deep.yml` | 2 (`osv-scanner`, `codeql go`) | 동일 |
| `.github/workflows/security-fast.yml` | 1 (`govulncheck`) | 동일 |
| `.github/workflows/module-isolation.yml` | 1 | 동일 |
| `.github/workflows/flaky-report.yml` | 1 | 동일 |
| `.github/workflows/phase-18.1-real-backend.yml` | 1 | 동일 |

**총 9 setup-go 호출** — single root cause (build cache 폭증) → single concern (cache narrowing) 카논 부합.

### 패턴 (5 곳 동일)

```yaml
- name: Setup Go
  uses: actions/setup-go@40f1582b2485089dde7abd97c1529aa768e1baff # v5.6.0
  with:
    go-version: "..."
    cache: false  # PR-12: ~/.cache/go-build 누적 폭증 회피

- name: Cache Go modules
  uses: actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3
  with:
    path: ~/go/pkg/mod
    key: go-mod-${{ runner.os }}-${{ hashFiles('apps/server/go.sum') }}
    restore-keys: |
      go-mod-${{ runner.os }}-
```

## 의존성

- PR-5 (#172) 와 **parallel mergeable** — 같은 파일들 (`ci.yml`) 이지만 다른 영역 (PR-5: routing label / PR-12: setup-go cache)
- `actions/cache@v4.2.3` SHA pin 신규 — Renovate digest 추적 (Phase 18.7 카논)

## 검증 시뮬

### Case A — fresh cache (cache miss)

- Setup Go: hostedtoolcache hit (Go toolchain 자체)
- Cache Go modules: miss → restore-keys fallback → 비어있으면 0
- `go test` 첫 실행: `~/go/pkg/mod` fresh download (~1~2분)
- post-job: `~/go/pkg/mod` 만 cache push (~370MB)

### Case B — go.sum 동일 (cache hit)

- Setup Go: hostedtoolcache hit
- Cache Go modules: exact key hit → `~/go/pkg/mod` restore (~370MB, 30~60s)
- `go test` 빠른 실행 (build cache 없으니 컴파일 비용 발생, 그러나 fetch 비용 절감 > 컴파일 비용)

### Case C — go.sum 변경 (cache restore-keys hit)

- Cache Go modules: exact key miss → restore-keys 으로 이전 cache fetch
- `go test`: 새 dependency download + 변경 module 재컴파일
- post-job: 새 cache key 로 push

### 효과 추정

- Cache 크기: 2.4GB+ → ~370MB (PR-170 baseline 수준)
- Setup Go step: 5분+ stuck → 30~60s
- 매 run 절감: ~3~4분 (fetch 비용 - 컴파일 비용 차)

## H-1 결정 — PR-168 H-2 결정과 양립 가능

PR-168 H-2 결정: "GHA cache 가 actions/setup-go cache 를 처리하므로 named volume 불필요" — **PR-12 는 H-2 retract 아님**. GHA cache 사용은 그대로, cache 범위만 좁힘 (`~/.cache/go-build` 제외).

## H-2 결정 — `restore-keys` fallback 정당화

`go.sum` 변경 시 exact key miss → `restore-keys: go-mod-${{ runner.os }}-` 로 가장 최근 partial cache fetch. `go mod download` 가 신규 dependency 만 추가 fetch — 효율적.

## H-3 결정 — Go version 별 cache key 분리 X

`~/go/pkg/mod` 는 Go version 무관 (module 자체는 source). 5 setup-go (Go 1.24/1.25 혼재) 모두 같은 key 공유 가능. cache 1개로 통일 → cache slot 효율.

## H-4 결정 — `cache-dependency-path` 제거

`cache-dependency-path: apps/server/go.sum` 은 setup-go cache 의 input. `cache: false` 로 setup-go 자체 cache 비활성화 후 무의미 — 명시적 actions/cache 의 `hashFiles` 가 동일 역할. 5 곳 모두 제거.

## Carry-over

### Phase 23 (Custom Image Option A)
- base image 에 `~/go/pkg/mod` 사전 populate → PR-12 의 actions/cache fetch 도 dead code 가능
- 현 PR 의 9 fold-in 은 W1.5 임시 fix, Phase 23 까지 운영
- **composite action `.github/actions/setup-go-narrow/action.yml` 추출** (Architecture HIGH-A1 carry-over) — 9 callsite × 8 line YAML 복제 (~72 라인). setup-go v6 / actions/cache v5 버전업 시 9 곳 일괄 갱신 부담 해소. PR-170 Arch-HIGH-1 (`start-services` composite action) 와 함께 Phase 23 진입 시 추출.

### W1.5 후속 PR (PR-13 후보)
- **build cache 별도 actions/cache** (Performance HIGH-1 carry-over) — `~/.cache/go-build` 제외로 매 run cold compile (`-race` instrumented test ~90~120s 추가). 정공: `path: ~/.cache/go-build` + `key: go-build-${{ runner.os }}-${{ github.sha }}` + `save-always: true` 별도 cache. sha 기반 key 라 매 run 새 entry → 10GB / 7day GHA eviction 정책으로 자동 정리.
- **`go-mod-${{ runner.os }}-` cache key 의 Go version split** (Architecture LOW carry-over) — 현재 9 workflow 가 Go 1.24/1.25 혼재한 단일 key. 향후 build cache 재도입 시 version-split 필수 (1.24 build object ↔ 1.25 호환 문제).
- **schedule-only workflow 검증** (Test HIGH carry-over) — `flaky-report.yml`, `phase-18.1-real-backend.yml` 은 PR run 미실행. main 머지 후 첫 nightly/push 결과 관측 후 회귀 발견 시 hotfix.
- **`timeout-minutes` 명시** (Test MED carry-over) — `ci.yml#go-check` + 8 workflow 의 `Run tests`/`Build server` step 에 `timeout-minutes: 15` 등 명시. silent hang 방지.

## 4-agent review fold-in 항목

본 PR 에 fold-in (코드 변경):
- **Security MED-1**: 9 workflow 의 actions/cache step 다음에 `go mod verify` step 추가 — `restore-keys` fallback 시 stale/오염 cache 차단. checksum 불일치 시 step fail.

본 PR 에 fold-in (문서 변경):
- **Architecture HIGH-A1**: composite action 추출 Phase 23 carry-over 명시 (위 "Carry-over" 섹션)
- **Performance HIGH-1**: build cache 제외 trade-off 명시 + PR-13 carry-over (위 "Carry-over" 섹션)
- **Test HIGH-1**: schedule-only workflow 검증 한계 carry-over (위 "Carry-over" 섹션)

본 PR 에 fold-in 안 함 (carry-over 명시):
- Security LOW-1 (SHA pin 직접 검증) — Renovate 자동 추적으로 위임
- Security LOW-2 (9 workflow cache 공유 ops 문서화) — README 별도 PR
- Performance MED-1 (9 workflow 동시 push race) — GHA cache eviction 정책 의존, 운영 관찰
- Performance LOW-1 (Go version 혼재 stale 경고) — version-split carry-over
- Architecture MED 1-3 (모두 정당화 성립, 코드 변경 X)
- Test MED-2 (1st PR run cache miss 검증 한계) — 본 PR run 자체가 baseline 형성
- Test LOW 2 (sudo HOME 경로 / 이중 layer) — 운영 관찰

## 4-agent review 결과 요약

본 PR diff 기준 (9 setup-go 호출 변경 + 9 actions/cache step 추가 + 9 verify step 추가 + spec):

| Agent | HIGH | MEDIUM | LOW | Verdict |
|---|---|---|---|---|
| Security | 0 | 1 (fold-in: go mod verify) | 2 (carry-over) | conditional → fold-in 후 pass |
| Performance | 1 (PR-13 carry-over) | 1 (race) | 1 (version stale) | conditional |
| Architecture | 1 (Phase 23 composite carry-over) | 3 (정당화) | 2 (관찰) | conditional |
| Test | 1 (schedule-only carry-over) | 2 (timeout / 1st run miss) | 2 (관찰) | conditional |

상세는 `reviews/PR-12-{security,performance,arch,test}.md` 4 파일.

## 카논 ref

- 부모 plan: `../checklist.md`
- PR-5 spec: `pr-5-ci-runs-on.md` (parallel)
- PR-168 H-2 (GHA cache 사용 정당화): `pr-4-runner-cache.md`
- 4-agent 강제 정책: `memory/feedback_4agent_review_before_admin_merge.md`
- single-concern: `memory/feedback_branch_pr_workflow.md`
