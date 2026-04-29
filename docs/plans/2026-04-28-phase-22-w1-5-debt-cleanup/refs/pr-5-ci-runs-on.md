# PR-5 — ci.yml runs-on `[self-hosted, containerized]` 전환

> Parent: [`../checklist.md`](../checklist.md)

**Goal**: ci.yml 4 job (`go-check`, `ts-check`, `coverage-guard`, `docker-build`) 의 `runs-on: self-hosted` → `[self-hosted, containerized]` 전환. PR-170 fold-in 으로 모든 step 이 이미 containerized runner 호환 (`sudo docker run` services + `sudo go test` testcontainers + `sudo apt-get install -y jq` + manual `sudo docker build`) — 본 PR 은 routing label 만 좁힌다.

## 적용 범위

- `.github/workflows/ci.yml` 4 job (단일 파일, 4줄)
- e2e-stubbed.yml: 이미 `[self-hosted, containerized]` (PR-167 부터)
- security-fast.yml / security-deep.yml: 이미 `[self-hosted, containerized]` (PR-170 부터)

## 변경 요약

| 파일 | 변경 |
|---|---|
| `.github/workflows/ci.yml` | 4 job 의 `runs-on: self-hosted` → `[self-hosted, containerized]` |
| `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-5-ci-runs-on.md` | 본 spec |
| `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md` | PR-5 status update |

## 의존성 (사전 조건 — 모두 충족)

- PR-4 (`feat(w1-5): PR-4 Runner Cache + service container + 4-agent fold-in`) 머지 완료 (`bddb68b`)
- PR-170 (`fix(w1-5): PR-8 — runner third-party action 호환`) 머지 완료 (`99aa825`) — services block 우회 + testcontainers-go fold-in + jq install + manual docker build
- 4 containerized runner Up (`docker compose ps` host 검증)
- 사용자 SSH 재배포 완료 (`infra/runners/.env` + `playwright-cache` + `hostedtool-cache` named volume)

## 진단 데이터 (PR-170 1st CI run)

PR-170 의 go-check job (당시 `runs-on: self-hosted` — bare-host 로 routing) 로그 분석:

- Setup Go: `Cache hit for: setup-go-Linux-x64-undefined-go-1.25.0-...` ✅
- 그러나 tar 추출 시 `/usr/bin/tar: ../../../../go/pkg/mod/...: Cannot open: File exists` 다수
- 경로: `/home/sabyun/actions-runner/_work/...` — bare-host runner 디스크
- 해석: GHA cache 자체는 정상 hit, 그러나 이전 run 의 `go/pkg/mod` 가 디스크에 잔존 → tar 가 덮어쓰기 충돌. cache 효과 0 (이미 디스크에 있는 모듈 사용).

containerized runner 로 전환 시 `EPHEMERAL=true` 로 매 job 후 컨테이너 재시작 → 디스크 clean → tar 충돌 해소 + GHA cache fetch 정상 효과. **GHA cache fetch (~369MB) 비용은 본 PR 신규 도입이 아님** — bare-host 에서도 이미 발생 중이었으나 tar 충돌로 효과 0이었다 (Performance review MED-1 명시 보완). 추정 효과: `go-check` 기준 +10~20s/run 절감.

## 보안 — Public repo + Fork PR 게이트

본 PR 은 fork PR 게이트 추가 X (PR-168/PR-170 의 e2e-stubbed.yml + security-deep.yml 게이트와 별개).

**근거**: ci.yml 4 job 은 named volume mount X (Playwright/hostedtool 무관) — fork PR 의 untrusted code 가 cache 경로에 횡전파할 통로 부재. `Run tests` 의 `sudo go test` 는 host docker.sock 접근하므로 fork PR 게이트는 보안 가치 있으나 carry-over.

**Carry-over (Phase 22 W3 또는 별도 PR)**: ci.yml `go-check` 에 `if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false` 게이트 추가. 본 PR scope 밖 (single-concern: routing label 만).

## H-1 결정 — `[self-hosted, containerized]` 매트릭스 의미

GitHub Actions runner labels 는 모두 매칭 (AND). 4 containerized runner 가 `self-hosted,linux,containerized` 라벨 보유 → `[self-hosted, containerized]` matcher 가 정확히 4 runner 만 routing.

bare-host runner (`/home/sabyun/actions-runner/`) 는 `containerized` 라벨 없음 → 본 PR 머지 후 ci.yml 은 bare-host runner 로 routing 되지 않음. tar 충돌 영구 해소.

**Phase 22 W3 carry-over**: bare-host runner 등록 해제 — 사용자 SSH 직접 작업, infra-runners 와 무관.

## H-2 결정 — services block / testcontainers-go / jq / docker build

본 PR 시점에 이미 PR-170 fold-in 으로 4 부채 해소:

| 부채 | PR-170 fold-in 위치 |
|---|---|
| services block ↔ myoung34 호환 | ci.yml#go-check `Start postgres + redis` (manual `sudo docker run`) |
| testcontainers-go ↔ docker.sock permission | ci.yml#go-check `Run tests` (`sudo -E env "PATH=$PATH" go test`) |
| jq 부재 | ci.yml#coverage-guard `Ensure jq installed` (`sudo apt-get install -y jq`) |
| docker.sock build permission | ci.yml#docker-build `Build Docker image (manual via sudo docker)` |

→ 본 PR 의 routing 변경 후 4 부채 모두 즉시 작동. 추가 fold-in 불필요.

## H-3 결정 — single-concern

본 PR scope: 4 줄 routing label 변경만. fork PR 게이트, RUNNERS_NET regex 강화, Phase 23 Custom Image migration 은 모두 carry-over.

**근거**: `memory/feedback_branch_pr_workflow.md` single-concern 카논. 4 줄 변경의 root cause 는 단일 (routing 좁힘). 다른 concern fold-in 시 review scope 폭증.

## 검증 시뮬

### Case A — main push (1st run)

- 4 job 모두 containerized runner 4대 중 하나로 routing
- Setup Go: GHA cache hit (PR-170 진단 동일)
- Run tests: `sudo go test` testcontainers-go SUCCESS (PR-170 동일 fold-in)
- Build Docker image: `sudo docker build` SUCCESS (PR-170 fold-in)
- Coverage guard: `jq` 사전 install 후 통과 (PR-170 fold-in)

### Case B — bare-host runner 활용도

- ci.yml 의 4 job → bare-host 0 routing (label mismatch)
- security-fast/deep, e2e-stubbed.yml → containerized 4대 (이미 PR-170 부터)
- bare-host runner 는 사용자 host 의 별도 self-hosted runner 등록일 가능성 — 본 PR scope 밖
- Phase 22 W3 carry-over: bare-host runner 등록 해제 (사용자 SSH 작업)

### Case C — 4 containerized runner 동시 점유

- PR-167 부터 e2e-stubbed.yml 이 4 shard 동시 routing (4 runner 점유)
- 본 PR 후 ci.yml 의 go-check + ts-check + coverage-guard + docker-build 도 4 runner 풀 공유
- pull_request 이벤트 시 모든 workflow 동시 trigger → 4 runner pool 포화 가능
- queue 대기 시간 ↑ 가능성. PR-4 의 cache 효과 (Playwright + hostedtool hit) 로 job 시간 단축 → 점유 해소 빠름

## Out of Scope (carry-over)

### Phase 22 W3
- ci.yml `go-check` fork PR 게이트 추가
- bare-host runner 등록 해제 (사용자 SSH 작업)
- RUNNERS_NET regex 정확 매칭 (PR-170 Sec-MED-1) — `bad_runners-net` 매칭 가능 패턴

### Phase 23 (Custom Image Option A)
- base image 사전 install (Node v20 + docker group GID 990 + Playwright + jq + govulncheck)
- PR-170 fold-in 4건 자연 dead code 가능
- Composite action `.github/actions/start-services/action.yml` (PR-170 Arch-HIGH-1)

## 4-agent review 결과 요약

본 PR diff 기준 (4줄 변경 + spec):

| Agent | 검토 영역 | 예상 결과 |
|---|---|---|
| Security | fork PR 게이트 부재 (carry-over OK), 4 runner pool 점유 | LOW (carry-over 명시) |
| Performance | bare-host tar 충돌 해소, 4 job 시간 단축, queue 점유 ↑ | LOW~MED (queue trade-off 수용) |
| Architecture | single-concern, spec drift 부재 | LOW (clean) |
| Test | regression test 추가 X (workflow level), CI 통과 = 검증 | LOW (CI = test) |

상세는 `reviews/PR-5-{security,performance,arch,test}.md` 4 파일.

## 카논 ref

- 부모 plan: `../checklist.md`
- PR-4 spec: `pr-4-runner-cache.md`
- PR-170 1st CI run 진단: `pr-8-runner-action-compat.md`
- 4-agent 강제 정책: `memory/feedback_4agent_review_before_admin_merge.md`
- single-concern: `memory/feedback_branch_pr_workflow.md`
