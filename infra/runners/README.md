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

- 사전 install: jq, govulncheck, Go 1.25, Node 20, Playwright deps
- docker GID 990 정착 (testcontainers-go + Trivy 자연 권한)
  - **GID 990 의미**: Dockerfile이 `groupadd -g 990 docker-host`로 group 생성 후 runner user에 가입. 사용자 host의 docker.sock GID와 매칭되어야 효력. `.env`의 `DOCKER_GID`가 dual-control 추가 안전망 (compose `group_add: ${DOCKER_GID}`)
- `ACTIONS_RUNNER_HOOK_JOB_STARTED` cleanup script — `~/go/pkg/mod` + `~/.cache/go-build`을 매 job 직전 비움 (EPHEMERAL=true가 file system reset 안 하는 myoung34 동작 정공)

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

## Cache Volumes (PR-4 + fold-in, 2026-04-28)

4 runner 가 공유하는 cache named volume. EPHEMERAL=true 와 무관하게 유지.

**PR-168 fold-in (H-2)**: `pnpm-cache`/`go-cache` 제거 — `actions/setup-go`/`actions/setup-node` 의 GHA cache 와 충돌. `setup-*` 자체 cache 보존, Playwright (GHA cache 미적용) + hostedtool 만 volume cache 사용.

### 구성

| volume | mount | 용도 |
|---|---|---|
| `playwright-cache` | `/opt/cache/playwright` | Playwright browser binary (chromium/firefox) |
| `hostedtool-cache` | `/opt/hostedtoolcache` | actions/setup-go, actions/setup-node 의 toolchain cache |

### 환경변수

`x-runner-base.environment` 에서 명시 (workflow step 이 직접 읽음):
- `PLAYWRIGHT_BROWSERS_PATH=/opt/cache/playwright`
- `RUNNER_TOOL_CACHE=/opt/hostedtoolcache` (L-ARCH-1: actions/setup-* hostedtoolcache 위치 명시)

### Phase 1 효과 (재산정 — PR-168 fold-in 후)

cache mount 범위가 `playwright-cache` + `hostedtool-cache` 2개로 축소 (pnpm-store/Go mod cache 는 GH-managed cache 사용 — H-2 fold-in).

- 1st run: ~10분 setup (full download → cache 빌드)
- 2nd run+: setup ~2~3분 (Playwright + Go/Node toolchain hit, pnpm install 은 GHA cache 의존)
- pnpm-lock 변경 시: GHA cache miss → 새 install ~2~3분
- Playwright bump 시: 해당 browser ~1분 download

→ "최대 70% 단축" 은 GHA cache 가 정상 작동할 때의 추가 효과 (Playwright 만 단독).

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

GH UI Settings → Actions → Runners 에서 4 runner idle 재확인.

### 디스크 사용량

cache 누적 후 예상치:
- `playwright-cache`: 200~500MB (chromium 150MB + firefox 80MB + system deps)
- `hostedtool-cache`: ~200MB (Go toolchain + Node)

총 ~400~700MB (pnpm/Go cache 제거로 이전 대비 ~3~4GB → ~0.7GB 감소). 정기 재 build 시 docker volume prune 권장.

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
