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

## 카논 ref

- 부모 plan: `../checklist.md`
- 4-agent review: `reviews/PR-168.md`
- W1 plan: `../../2026-04-28-phase-22-runner-containerization/checklist.md`
