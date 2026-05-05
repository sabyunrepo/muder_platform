# `infra/runners/` — Phase 22 Runner Pool

myoung34/github-runner 4 컨테이너 ephemeral pool. PR-164 fix를 넘어 runner workspace ↔ dev workspace 동거 함정 자체를 격리.

> **Spec**: `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md`

## ⚠️ PAT Blast Radius (반드시 읽고 운영)

이 PAT는 **`Administration: Read and write`** 권한을 가집니다 — runner 등록 endpoint(`POST /repos/{owner}/{repo}/actions/runners/registration-token`)에 GitHub가 강제하는 최소 scope입니다. 그러나 동일 권한으로 다음도 가능:

- repo 삭제 / ownership 이전
- default branch 변경
- **branch protection 우회** (`feedback_branch_pr_workflow.md` main 보호 정책 무력화)
- collaborator/team 관리
- webhook 변조

**완화 절차 (필수)**:

1. **1Password CLI 패턴** — `.env`를 plaintext로 디스크에 두지 말 것. 1Password에 PAT 저장 후:
   ```bash
   op run --env-file=.env.template -- docker compose up -d
   ```
   `.env.template`은 `ACCESS_TOKEN=op://Personal/mmp-runner-pat/credential` 형태.
2. **30일 회전** — admin-skip 정책 종료(2026-05-01) 전까지. 6개월 표준은 정책 만료 후 적용.
3. **PAT 노출 금지** — 스크린샷, PR description, log, Slack 모두. 노출 발견 시 즉시 revoke + repo audit log 검토.

## Custom Image (Phase 23+)

이 pool은 **`ghcr.io/sabyunrepo/mmp-runner` Custom Image**로 가동합니다 (myoung34 base 직접 사용 X). 정공:

- 사전 install: jq, govulncheck, goose, osv-scanner, Go 1.25, Node 20, Playwright deps
- **Image-resident toolchain (Phase 23 follow-up)** — `PATH`에 Go/Node bin 추가, `GOMODCACHE`/`GOCACHE`/`PNPM_STORE_PATH` ENV pre-set, `apps/server/go.mod` deps `go mod download` pre-bake
- docker GID 990 정착 (testcontainers-go + Trivy 자연 권한)
  - **GID 990 의미**: Dockerfile이 `groupadd -g 990 docker-host`로 group 생성 후 runner user에 가입. 사용자 host의 docker.sock GID와 매칭되어야 효력. `.env`의 `DOCKER_GID`가 dual-control 추가 안전망 (compose `group_add: ${DOCKER_GID}`)
- `ACTIONS_RUNNER_HOOK_JOB_STARTED` script — image-resident cache 보존, idempotent `mkdir`만 수행 (옛 카논의 `rm -rf ~/go/pkg/mod`은 image pre-bake와 충돌해서 제거)

이미지 빌드는 `.github/workflows/build-runner-image.yml`이 main 머지 시 자동 push. visibility = Public (사용자 host pull 인증 0건).

> Spec: `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md`

### GHCR 첫 push 후 1회 운영 절차

1. https://github.com/sabyunrepo/packages/container/mmp-runner/settings → "Manage Actions access" → `muder_platform` add (이렇게 해야 향후 본 repo의 GITHUB_TOKEN이 push 가능)
2. visibility → Public (image에 secret 없음 — Dockerfile은 git 공개)

### 사용자 host 재배포 (main 머지 후)

```bash
ssh sabyun@100.90.38.7
cd ~/muder_platform/infra/runners
git pull
docker compose pull
docker compose up -d
docker compose ps  # 4 service Started
```

### Verification (재배포 후)

```bash
# 컨테이너 부팅
docker logs containerized-runner-1 2>&1 | head -50 | grep -i "Listening for Jobs"

# 사전 install + hook env 검증
docker exec containerized-runner-1 bash -c '
  jq --version
  govulncheck -version
  /opt/hostedtoolcache/go/1.25.0/x64/bin/go version
  /opt/hostedtoolcache/node/20.18.0/x64/bin/node --version
  echo "ACTIONS_RUNNER_HOOK_JOB_STARTED=$ACTIONS_RUNNER_HOOK_JOB_STARTED"
'

# GitHub Settings → Actions → Runners → 4 idle 확인
```

### Rollback (재배포 후 광범위 fail 시)

```bash
git revert <Phase 23 commit>  # compose.yml만 되돌림
docker compose pull
docker compose up -d
# ~5분 내 myoung34 base 또는 직전 GHCR sha tag로 복귀
```

## Bootstrap (최초 1회)

1. fine-grained PAT 발급 (`.env.example` 주석 참조).
2. `cp .env.example .env`.
3. `.env`에 `ACCESS_TOKEN`, `REPO_URL`, `DOCKER_GID` 채우기.
   - **macOS** (Apple Silicon dev): `DOCKER_GID=$(stat -f '%g' /var/run/docker.sock)` 결과를 직접 입력
   - **Linux** (Ubuntu runner host): `DOCKER_GID=$(stat -c '%g' /var/run/docker.sock)` 결과를 직접 입력 (보통 `990` 또는 `999`)
   - 둘 다 env 파일은 shell expansion 안 됨 → 명령 결과를 직접 vim으로 붙여넣기
   - **검증**: `cat .env | grep DOCKER_GID` 결과가 숫자인지 확인. 빈 문자열이면 group_add silent fail → docker.sock permission denied.
4. **PAT scope 검증** (boot 전 안전 확인):
   ```bash
   curl -sH "Authorization: Bearer $(grep ACCESS_TOKEN .env | cut -d= -f2)" \
     https://api.github.com/repos/sabyunrepo/muder_platform/actions/runners | jq '.total_count'
   ```
   숫자(0 이상) 반환 시 정상. `401`/`404`이면 PAT 또는 Resource owner 잘못.
5. **Image pull (Phase 23+ Custom Image)** — `pull_policy: always`로 compose up 시 자동 pull. 첫 부팅 또는 GHCR 권한 검증을 위해 manual pull 권장:
   ```bash
   docker compose pull
   ```
6. `docker compose up -d`.
7. GitHub Settings → Actions → Runners → 4 row idle 확인.

## Cache Volumes (Phase 23 follow-up — image-resident toolchain)

4 runner 가 공유하는 cache named volume. EPHEMERAL=true 와 무관하게 유지.

**카논 reverse (PR-168 H-2 → Phase 23 follow-up)**: 옛 카논은 `pnpm-cache`/`go-cache` 를 제거하고 `setup-*` 의 GHA cache 사용. 그러나 매 run 913MB GOMODCACHE 다운로드 + image의 toolcache pre-bake 무효화 부작용 발견 → image-resident toolchain 카논으로 전환.

### 구성

| volume | mount | 용도 |
|---|---|---|
| `playwright-cache` | `/opt/cache/playwright` | Playwright browser binary (chromium/firefox) |
| `hostedtool-cache` | `/opt/hostedtoolcache` | Go/Node binary toolchain (image pre-bake 대상) |
| `go-mod-cache` | `/home/runner/go/pkg/mod` | `apps/server` Go module deps (image pre-bake + persist) |
| `go-build-cache` | `/home/runner/.cache/go-build` | Go build artifact cache |
| `pnpm-store` | `/home/runner/.pnpm-store` | pnpm content-addressable store (workspace deps) |

Playwright system dependency marker:
- `/opt/mmp-runner/playwright-deps-ready`
- E2E workflows detect this marker and skip the per-job `apt-get update` +
  `playwright install-deps` fallback on ARC runners.
- Browser binaries still use `PLAYWRIGHT_BROWSERS_PATH=/opt/cache/playwright`,
  so Playwright package version drift stays controlled by the repo lockfile.

Pre-baked CLI tools:
- `govulncheck`: used by `security-fast.yml`; pinned in
  `infra/runners/Dockerfile`; workflow must not run a per-job `go install` on
  ARC.
- `goose`: used by `e2e-stubbed.yml` migrations; required PR/full-CI path uses
  the ARC image-resident binary.
- `osv-scanner`: used by `security-deep.yml`; installed from the pinned
  upstream release binary and SHA256 in `infra/runners/Dockerfile`, avoiding a
  per-job Go 1.26 toolchain download just to build the scanner.
- Optional/nightly workflows that still run on `ubuntu-latest` may keep local
  install steps because they do not consume the ARC runner image.

### 환경변수 (image ENV로 정의 — Dockerfile)

`setup-go`/`setup-node` 가 PATH 자동 hit:
- `PATH=/opt/hostedtoolcache/go/${GO_VERSION}/x64/bin:/opt/hostedtoolcache/node/${NODE_VERSION}/x64/bin:${PATH}`
- `GOPATH=/home/runner/go`
- `GOMODCACHE=/home/runner/go/pkg/mod`
- `GOCACHE=/home/runner/.cache/go-build`
- `PNPM_STORE_PATH=/home/runner/.pnpm-store`
- `GOTOOLCHAIN=local` (project go.mod 의 toolchain directive 무시 — image pre-bake 강제)

compose `x-runner-base.environment` 는 Playwright 만 (image ENV 와 별개):
- `PLAYWRIGHT_BROWSERS_PATH=/opt/cache/playwright`
- `RUNNER_TOOL_CACHE=/opt/hostedtoolcache`

### Workflow 카논 (self-hosted only)

`actions/setup-go` / `actions/setup-node` 의 `cache:` 옵션을 **`false`** 로 명시:
```yaml
- uses: actions/setup-go@...
  with:
    go-version-file: apps/server/go.mod
    cache: false  # image-resident: GOMODCACHE/GOCACHE는 named volume mount.
```

GHA cache restore 가 일어나지 않음 → 매 run 의 ~913MB 다운로드 0. cloud (`runs-on: ubuntu-latest`) workflow 는 그대로 GHA cache 사용 (image-resident 무관).

### 효과 (Phase 23 follow-up)

| 항목 | 옛 (PR-168 H-2) | 새 (image-resident) |
|---|---|---|
| 매 run GOMODCACHE 다운로드 | ~913MB (~13초) | **0 (image pre-bake)** |
| Go toolchain mismatch fallback | 매 fire 마다 다운로드 후 named volume 비대 | image PATH 즉시 hit |
| pnpm install 첫 run | GHA cache restore 의존 | named volume 영구 persist (4 runner 공유) |
| security-fast scanner install | 매 fire 마다 `go install govulncheck` | image PATH 즉시 hit |
| E2E migration CLI install | 매 shard 마다 `go install goose` | image PATH 즉시 hit |
| security-deep OSV install | Go 1.26 setup + `go install osv-scanner` | pinned binary 즉시 hit |

### #349 pre-bake 판단 기록

이번 runner image 최적화에서 바로 pre-bake 하는 항목:
- `goose`: 버전 고정(`v3.27.0`)이고 DB migration CLI라 workspace lockfile과
  결합도가 낮다.
- `osv-scanner`: `security-deep.yml`에서 scanner 설치만 위해 Go 1.26.2를
  매번 내려받던 비용을 제거한다. Dockerfile의 release SHA256 검증으로
  supply-chain drift를 줄인다.
- `govulncheck`: 기존 image에 이미 들어가던 도구다. workflow install step만
  제거해 image-resident 카논과 일치시킨다.

이번 PR에서 pre-bake 하지 않는 항목:
- Playwright browser binaries: 속도 이득은 크지만 image size가 빠르게 커지고,
  repo의 Playwright package version과 browser revision이 lockstep으로 맞아야
  한다. 현 단계에서는 `/opt/mmp-runner/playwright-deps-ready` system deps
  marker와 `/opt/cache/playwright` cache를 유지한다.
- `pnpm install` workspace deps: public PR cache poisoning과 secret residue
  위험이 있어 image에 workspace `node_modules`를 굽지 않는다.
- Trivy/gitleaks action 내부 바이너리: action이 관리하는 download/cache 영역이라
  로그 기반 측정 후 별도 이슈에서 판단한다.

### 운영 카논 — image rebuild 후 cleanup

`apps/server/go.sum` 변경 → build CI 가 새 image push. host 재배포 시 `go-mod-cache` 옛 데이터를 명시 cleanup 해야 image의 새 pre-bake 가 적용:
```bash
docker compose down
docker volume rm $(docker volume ls -q | grep -E "go-mod-cache|go-build-cache") 2>/dev/null || true
docker compose pull
docker compose up -d
```

`hostedtool-cache` 도 GO_VERSION/NODE_VERSION bump 시 동일 cleanup 필요.

### 보안 — Public repo + Fork PR 가드

본 repo 는 public + `pull_request` 이벤트 trigger. 4 runner 가 같은 named volume 을 공유하므로 fork PR 의 untrusted code 가 `playwright-cache`/`hostedtool-cache` 에 악성 binary 를 심으면 다음 main job 에 횡전파 가능 (PR-168 4-agent review H-1).

**가드**:
- `e2e-stubbed.yml` 의 `e2e` 와 `merge-reports` job 에 `if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false` 추가 — fork PR 은 cache mount runner 우회.
- GitHub Settings → Actions → "Require approval for first-time contributors" 활성 권고 (사용자 작업).
- cache 오염 의심 시 즉시 `docker volume rm playwright-cache hostedtool-cache && docker compose up -d` 로 정화.

### 보안 — Secret leak 가드

`pnpm install` 또는 Go build 가 `.npmrc` 등에 `NPM_TOKEN` 같은 secret 를 쓰면 cache 디렉토리에 잔존 가능. **현재 mount 범위는 Playwright browser binary + hostedtool toolchain 으로 한정** (PR-168 fold-in) — pnpm-store/Go mod cache 는 제거 후 GH-managed cache 사용. secret leak 경로 minimal.

운영 점검: `docker exec runner-1 ls -la /opt/cache/playwright /opt/hostedtoolcache` 로 예상 외 파일 부재 정기 확인.

### 적용 (사용자 SSH 직접 작업)

PR 머지 후 host (sabyun@100.90.38.7) 에서:

```bash
ssh sabyun@100.90.38.7
cd ~/infra/runners

# 새 docker-compose.yml 가져오기 (또는 SCP — host의 ~/infra/runners 가 git clone 아닐 시)
git pull origin main

# 기존 named volume 삭제 (Phase 23 follow-up: image pre-bake 적용 위해 옛 cache 제거)
docker compose down
docker volume rm $(docker volume ls -q | grep -E "go-mod-cache|go-build-cache|hostedtool-cache|pnpm-store") 2>/dev/null || true

# 재배포
docker compose pull
docker compose up -d

# 검증
docker compose ps                                          # 4 service Up
docker volume ls | grep -E "(playwright|hostedtool|go-mod|go-build|pnpm)"  # 5 cache volume 생성
docker compose logs runner-1 --tail 10                     # "Listening for Jobs"
docker exec containerized-runner-1 ls /home/runner/go/pkg/mod/cache  # image pre-bake 데이터 확인
```

GH UI Settings → Actions → Runners 에서 4 runner idle 재확인.

### 디스크 사용량 (image-resident toolchain 후)

cache 누적 후 예상치:
- `playwright-cache`: 200~500MB (chromium 150MB + firefox 80MB + system deps)
- `hostedtool-cache`: ~200MB (Go toolchain + Node — image pre-bake 동기화)
- `go-mod-cache`: ~500MB ~ 1.5GB (apps/server deps + 누적 dependency)
- `go-build-cache`: ~300MB ~ 1GB (build artifact cache)
- `pnpm-store`: ~500MB ~ 1.5GB (monorepo content-addressable store)

총 ~1.7GB ~ 4.5GB. 옛 PR-168 카논 (~700MB) 대비 증가하지만 매 run 다운로드 0 + 13초 절감 trade-off. `apps/server/go.sum` bump 시 image rebuild + `docker volume rm` cleanup 필요 (위 카논 참조).

## Troubleshooting (PAT 만료 detection)

`restart: always` + entrypoint registration fail → 32초 간격 무한 restart (max-retry 없음). detection:

```bash
# 5분 윈도우에서 token request fail 카운트
docker compose logs --since=5m runner-1 | grep -c 'Token request failed'
# 5회 이상이면 PAT 만료/취소 의심 → .env ACCESS_TOKEN 교체 + docker compose up -d --force-recreate

# 또는 docker.sock permission denied 음성 확인
docker compose logs runner-1 --tail 50 | grep -i 'permission denied'
# hit 있으면 DOCKER_GID 잘못 → .env 재확인 + docker compose up -d --force-recreate
```

## Register (재등록)

`EPHEMERAL=true`로 job 완료마다 자동 deregister + restart로 자동 re-register. 수동 개입 불필요. 강제 재등록은:

```bash
docker compose restart runner-1   # 단일
docker compose restart            # 전체
```

## Rotate PAT (6개월 주기)

1. GitHub에서 신규 PAT 발급 (구 PAT는 expired 처리 전까지 유지).
2. `.env`의 `ACCESS_TOKEN` 교체.
3. `docker compose up -d --force-recreate` (env 다시 로드).
4. GH UI에서 4 runner re-register 확인.
5. 구 PAT revoke.

## Decommission (Phase 22 완료 후 또는 운영 중단)

1. GH UI에서 모든 runner remove.
2. `docker compose down --volumes` (named volume 같이 삭제).
3. `infra/runners/.env` 안전 삭제 (PAT 포함).

## 운영 기록

- 2026-04-28: Phase 22 W1 부팅 (PR-1)
- 2026-XX-XX: W4 host runner deregister (별도 운영 노트로 기록)
