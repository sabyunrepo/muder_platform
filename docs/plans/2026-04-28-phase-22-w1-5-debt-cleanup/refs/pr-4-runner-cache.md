# PR-4 — Runner Cache Volume (Playwright + hostedtool)

> Parent: [`../checklist.md`](../checklist.md)

**Goal**: 4 containerized runner 가 매 CI run 마다 Playwright browser (~230MB) 를 fresh download 하는 부담을 named volume cache 로 차단. `actions/setup-go`/`setup-node` 의 GHA cache 는 자체 보존 (PR-168 fold-in 의 H-2 결정).

## 적용 범위

- `e2e-stubbed.yml` (`runs-on: [self-hosted, containerized]`) — Playwright + Node + Go 전체
- `ci.yml` 4 job (`runs-on: self-hosted` only) — **PR-4 적용 범위 밖** (W1.5 PR-5 별도 진행 예정)

## 변경 요약

| 파일 | 변경 |
|---|---|
| `infra/runners/docker-compose.yml` | x-runner-base.environment 에 `PLAYWRIGHT_BROWSERS_PATH` + `RUNNER_TOOL_CACHE` 추가. 각 runner volumes 에 `playwright-cache` + `hostedtool-cache` 2 mount. bottom volumes 2 정의. |
| `infra/runners/README.md` | Cache Volumes 섹션 + 보안 가드 섹션 + 효과 추정치 |
| `.github/workflows/e2e-stubbed.yml` | `e2e` + `merge-reports` job 에 fork PR 게이트 |

## 의존성 (사전 조건)

- PR-167 의 `runs-on: [self-hosted, containerized]` (e2e-stubbed.yml) — main `6fa7460` 머지됨
- 사용자 SSH 권한 (sabyun@100.90.38.7) — 머지 후 재배포
- Phase 22 W1 의 4 containerized runner (PR-165) — Up 상태 유지

## H-2 결정 — `GOMODCACHE`/`PNPM_STORE_PATH` 제거 근거

`actions/setup-go@v5` `cache-dependency-path: apps/server/go.sum` + `actions/setup-node@v4` `cache: 'pnpm'` 가 자체 cache restore 수행. 환경변수 override 시 GHA 가 계산한 key 와 실제 복원 경로 불일치 → cache miss. PR-4 의 named volume 채워지지만 GHA cache 무효화로 매 run 새로 download → 효과 음수 가능.

해결: `setup-*` 자체 cache 보존, Playwright (GHA cache 미적용) 만 named volume 으로 가속.

## H-1 결정 — fork PR 게이트 근거

repo public + `pull_request` 이벤트 trigger + 4 runner 가 같은 cache volume 공유. fork PR 의 untrusted code 가 cache 에 악성 file 주입 시 4 runner 횡전파.

해결: `if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false` — fork PR 은 cache mount runner 우회. 단, 본 게이트는 fork PR 의 e2e job 자체를 skip 시킴 → CI 미실행. trade-off: security > coverage.

## H-4 결정 — race-safe 근거

Playwright browser binary 는 read-only atomic extraction. hostedtoolcache 는 setup-* 가 per-tool-version 디렉토리로 격리하여 저장 (node/20.x.x/... 형태). 4 runner 동시 job 에서 동일 version 을 각각 write 하면 idempotent overwrite — race condition 없음.

pnpm store / Go module cache 는 이미 제거되었으므로 동시 write race 우려 해소.

## H-5 carry-over — Custom Image (Option A)

본 PR 은 Option B (named volume). Phase 23 entry 에 "custom image (Option A) 전환" task 명시 예정 — Playwright 사전 빌드 된 image 로 1st run 도 즉시 hit.

## L-ARCH-1 — RUNNER_TOOL_CACHE 명시

`RUNNER_TOOL_CACHE=/opt/hostedtoolcache` 환경변수 명시 — actions/setup-* 가 이 경로를 읽어 toolchain 저장/복원. 미명시 시 기본값이 컨테이너 내부 임시 경로로 fallback 될 수 있어 dead config.

## 사용자 작업 (PR 머지 후, SSH 직접)

```bash
ssh sabyun@100.90.38.7
cd ~/infra/runners

# 새 docker-compose.yml 가져오기
git pull origin main

# 기존 named volume 삭제 (volume 정의 변경 — pnpm-cache/go-cache 제거됨)
docker compose down
docker volume rm runner-cache_pnpm-cache runner-cache_go-cache 2>/dev/null || true

# 재배포
docker compose up -d

# 검증
docker compose ps                                          # 4 service Up
docker volume ls | grep -E "(playwright|hostedtool)-cache"  # 2 cache volume 생성
docker compose logs runner-1 --tail 10                     # "Listening for Jobs"
```

## 검증 시뮬

### Case A — 1st CI run (cache 빌드)

- e2e-stubbed.yml 4 shard trigger
- "Install Playwright browsers" 단계 fresh download (~3~5분/shard, 단 4 runner 가 같은 volume 공유 → 첫 shard 만 download, 나머지 즉시 hit)
- "Setup Go" / "Setup Node" 단계는 GHA cache 첫 store

### Case B — 2nd CI run (cache hit)

- "Install Playwright browsers" 즉시 hit (~5~10s)
- "Setup Go" / "Setup Node" GHA cache restore (~10~20s)
- 총 setup ~30~60s/shard (이전 ~10분 대비)

### Case C — pnpm-lock 변경 (GHA cache miss)

- "Install dependencies" GHA cache miss → fresh download ~2~3분
- 다음 run 부터 새 cache key 로 hit

### Case D — fork PR

- e2e job skip (fork PR 게이트)
- main 또는 same-repo PR 만 cache mount runner 사용

## Out of Scope (carry-over)

- ci.yml 4 job 의 [self-hosted, containerized] 전환 — W1.5 PR-5 별도
- 자동 cron prune — W1.5 PR-6 별도
- Custom Image (Option A) — Phase 23 entry
- RUNNERS_NET dynamic detection cleanup — host explicit `name: runners-net` 안정화 후 W3 stable 1주 시점

## In-flight Spec drift (PR-168 6 commit 누적)

> Spec 갱신 — `chore/w1-5-runner-cache` branch 가 cache volume 단일 PR 의 의도를 넘어
> service container init bug + RUNNERS_NET dynamic detection + Seed E2E theme migration
> 까지 fold-in 함. Phase 22 W1 spec (myoung34 ↔ GHA `services:` 호환) 의 사후 패치 성격.
> 다음 commit 들의 결정 근거를 본 spec 에 보존:

### `542497b` services block 제거 + workflow step docker run 우회

- **원인**: `myoung34/github-runner` image 가 GHA `services:` block 을
  `Value cannot be null. (Parameter 'network')` 로 거부.
- **결정**: `services:` block 제거 → `Start postgres + redis` step 에서 `docker run`
  으로 직접 기동. 같은 `runners-net` bridge 에 join → hostname 직접 접근.
- **trade-off**: GHA 자동 health/network setup 손실. 수동 health 폴링 (`docker inspect`) 으로 대체.
- **carry-over**: 4-agent perf review 의 MEDIUM-PERF-3 (startup latency +7~20s/shard)
  는 known cost. 사용자 host 의 `myoung34/github-runner` upstream fix 시점에 services block 복귀 검토.

### `4b21eba` RUNNERS_NET 동적 검출

- **원인**: `docker compose up -d` 가 default 로 `<project_dir>_<service>` 형태로
  network 이름에 prefix 붙임. host 의 `~/infra-runners` 디렉토리는 → `infra-runners_runners-net`.
- **결정**: workflow step 에서
  `docker network ls --format '{{.Name}}' | grep -E '(^|_)runners-net$' | head -1`
  로 양쪽 형태 매칭 → `RUNNERS_NET` 환경변수 export.
- **fail-fast**: 검출 실패 시 `::error::` + `docker network ls` 덤프 + `exit 1`.
- **dead-code 잠재성**: `6d5a71d` (compose explicit `name: runners-net`) 적용 후
  prefix 케이스는 사라지지만, 사용자 host 가 본 PR 머지 후 재배포 전까지는 여전히
  prefix 형태 유지. W3 stable 후 cleanup PR 후보.

### `f300b5f` Seed E2E theme — psql CLI → docker exec

- **원인**: containerized runner image 에 `psql` 미설치. 이전 Phase 22 W1 의
  bare-host runner 는 psql 보유.
- **결정**: postgres container 안의 psql 호출 +
  `sudo docker exec -i -e PGPASSWORD=mmp_e2e $PG_NAME psql -U mmp -d mmp_e2e -v ON_ERROR_STOP=1 < seed.sql`
  형태로 stdin redirect.
- **보안**: `PGPASSWORD` 를 `-e` 환경변수 로 전달 (process table 미노출).

### `<EACCES-fix>` Cache volume permissions (PR-168 회귀 fix)

- **원인**: Docker named volume (`playwright-cache`, `hostedtool-cache`) 가 default `root:root` 소유로 생성. `RUN_AS_ROOT: false` runner user 가 `pnpm exec playwright install` 실행 시 `mkdir '/opt/cache/playwright/__dirlock'` EACCES.
- **검증 fail 신호**: a31af3f CI 의 4 E2E shard 모두 `Failed to install browsers / Error: EACCES: permission denied, mkdir '/opt/cache/playwright/__dirlock'` 동일 fail.
- **결정**: workflow step `Install dependencies` 다음에 `Prepare cache volume permissions` step 추가 — `sudo mkdir -p` + `sudo chown -R "$(id -u):$(id -g)"` 로 named volume 의 ownership 정착. 4 runner 가 같은 named volume 공유 — chown idempotent + race 없음.
- **trade-off**: 매 run 마다 chown 실행 (idempotent, ~50ms 비용). 사용자 host 재배포 불필요.
- **대안 (rejected)**:
  - docker-compose.yml entrypoint chown — 사용자 host 재배포 필요
  - mount path 변경 (`~/.cache/ms-playwright`) — named volume 4 runner 공유 효과 손실

### `b320681` shellcheck SC2034

- **원인**: `test-compound-plan-dry-run.sh:9` 의 `TEMPLATE` 변수가 fixture 격리
  (line 17 `TMP_TEMPLATE`) 도입 후 dead code.
- **결정**: 1줄 삭제. 자가 테스트 41/41 통과.

### `<this-commit>` 4-agent review fold-in

- **Sec-MED-1 / Perf-LOW-1**: Diagnostic step (`6aa013c`) 제거 — public CI log 에
  sudo NOPASSWD + runner env 노출 영구 잔존 차단. 사용자 host 진단은 SSH manual 로 완료.
- **Test-HIGH-T2**: `Start postgres + redis` step 에 `set -euo pipefail` 명시 추가
  (GHA 기본 shell 도 `-eo pipefail` 이지만 defensive coding + readability).

## 4-agent review 결과 요약

본 PR 6 commit + fold-in 1 commit 기준:

| Agent | HIGH | MEDIUM | LOW | Verdict |
|---|---|---|---|---|
| Security | 0 | 3 (MED-1 fold-in) | 3 | merge-ready |
| Performance | 0 | 3 (carry-over) | 4 (LOW-1 fold-in) | trade-off 수용 |
| Architecture | 1 (spec drift fold-in) | 2 | 2 | admin-merge OK |
| Test | 2 (T-2 fold-in / T-1 carry) | 3 | 3 | gap → W1.5 PR-5/PR-7 |

상세는 `reviews/PR-168-{security,performance,arch,test}.md` 4 파일.

## 카논 ref

- 부모 plan: `../checklist.md`
- 4-agent review: `reviews/PR-168-{security,performance,arch,test}.md`
- W1 plan: `../../2026-04-28-phase-22-runner-containerization/checklist.md`
- 4-agent 강제 정책: `memory/feedback_4agent_review_before_admin_merge.md`
