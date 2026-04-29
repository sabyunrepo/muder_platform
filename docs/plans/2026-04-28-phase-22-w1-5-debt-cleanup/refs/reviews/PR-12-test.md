# PR-12 Test Review

## Verdict: conditional

---

## HIGH

**main-only workflow 3개 — PR run 에서 검증 불가**

`flaky-report.yml` (schedule 전용, Monday 06:00 UTC), `phase-18.1-real-backend.yml` (schedule + push, PR trigger 없음) 는 본 PR run 에서 실행되지 않는다. `security-deep.yml` 은 `pull_request: branches: [main]` + `push: branches: [main]` 모두 트리거되므로 PR run 에서 실행되나, CodeQL matrix job(`matrix.language == 'go'`) 에만 `if: matrix.language == 'go'` 조건이 붙은 actions/cache step 이 있고 govulncheck job 에는 조건이 없다 — 정합성은 맞으나 matrix miss 시 cache step 이 go 외 언어에도 실행되는 구조적 노이즈가 남아 있다.

`flaky-report.yml` + `phase-18.1-real-backend.yml` 의 `cache: false` + `actions/cache` 패턴은 **main 머지 후 첫 push/nightly** 에서야 검증된다. 이 두 workflow 에서 step 순서 오류(e.g. `go install` 이 mod cache restore 보다 앞에 오는 경우) 또는 `path: ~/go/pkg/mod` 경로 오인식이 있어도 PR CI 는 green 이다.

---

## MEDIUM

**`go test -race` 의 step timeout 미설정 — fresh compile 조건에서 timeout 위험**

`ci.yml` 의 `go-test` job 에 `timeout-minutes` 선언이 없다(기본 6시간). build cache(`~/.cache/go-build`) 제외로 testcontainers-go v0.42 race-instrumented cold compile 이 매 run 발생한다(추정 90~120초 추가). 현재 은 self-hosted runner 에서 고정 GHA 기본값에 의존 — 향후 runner 자원 부족 시 silent hang 가능. `timeout-minutes: 20` 명시 권고.

**cache hit 검증은 2nd run 이후에만 가능**

1st PR run 은 항상 cache miss (new branch key). `actions/cache` 가 정상 save → 2nd run(re-push 또는 merge 후 push)에서 hit 여부 확인 가능. PR 머지 전 단 1회 green 만으로는 restore 경로가 실제로 동작하는지 검증되지 않는다. cache miss/hit 상태를 출력하는 step 이 없어 artifact 없이는 판별 불가.

---

## LOW

**`go test -race` 커버리지 step 의 sudo 권한 + build cache 미포함 조합**

`ci.yml` L176: `sudo -E env "PATH=$PATH" go test -race -coverprofile=coverage.out ./...` — sudo 환경에서 `~/go/pkg/mod` 는 실제 `/root/go/pkg/mod` 로 resolve 될 수 있다. actions/cache 의 `path: ~/go/pkg/mod` 는 `runner` 사용자 홈(`/home/runner/go/pkg/mod`)으로 restore 되므로 sudo go test 가 mod cache 를 miss 할 가능성 있음. 로컬에서 재현 어렵고 runner 이미지에 따라 다름.

**hostedtoolcache vs actions/cache 통합 검증 step 부재**

`setup-go` 의 Go 바이너리 toolchain 은 hostedtoolcache 에, mod cache 는 `~/go/pkg/mod` 에 별도 저장된다. 두 경로가 모두 정상인지 확인하는 step(e.g. `go env GOPATH GOMODCACHE` 출력) 이 없어 장애 발생 시 어느 레이어가 문제인지 구분하기 어렵다.

---

## carry-over

| # | 항목 | 권고 |
|---|------|------|
| C-1 | `flaky-report.yml` + `phase-18.1-real-backend.yml` cache 패턴 — main 1st push green 확인 후 W1.5 wrap 체크리스트에 결과 기록 | main 머지 후 필수 관측 |
| C-2 | `go test -race` job 에 `timeout-minutes: 20` 추가 | 별도 hygiene commit 또는 PR-12 fold-in |
| C-3 | `sudo go test` + `~/go/pkg/mod` cache path 불일치 — runner 이미지 업그레이드 시 재현 여부 확인 | Phase 22 W2 DEBT 등록 |

---

## 결론

PR run 에서 실행되는 4개 workflow(ci.yml, e2e-stubbed.yml, security-fast.yml, module-isolation.yml)는 변경 패턴을 검증한다. 그러나 **`flaky-report.yml` 과 `phase-18.1-real-backend.yml` 은 PR CI 사각지대** — main 머지 후 첫 nightly/push 에서야 fail 이 드러난다. 이 두 workflow 의 cache step 오류는 flaky test 감지 지연 또는 backend real-backend nightly 중단으로 이어질 수 있다. 머지는 허용하되 main 첫 push 결과를 carry-over C-1 로 추적하는 조건부 통과.
