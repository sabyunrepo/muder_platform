---
file: 06-infra-cicd.md
purpose: Docker · Nginx · ARC self-hosted runner · CI 정책 — AI가 배포·검증 파이프라인 파악
audience: design-AI
last_verified: 2026-05-07
sources_of_truth:
  - docker-compose.yml + docker-compose.dev.yml
  - apps/web/nginx.conf
  - .github/workflows/
  - memory/project_infra_docker.md
  - docs/ops/ci-security-worker-reactivation.md
  - memory/sessions/2026-04-28-debt-cleanup-runner-network.md
  - memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md
related: [07-tech-stack.md, 09-issues-debt.md, 08-roadmap.md]
---

# 06. Infrastructure & CI/CD

## 한 줄 요약 {#tldr}

Docker compose가 dev/prod 모두 단일 진입점 — Nginx:80 외부 노출 + 나머지(server/postgres/redis)는 internal network. CI는 GitHub Actions + ARC self-hosted runner (KT Cloud K8s, runner pool). 현재 PR 기본 게이트는 개발 최소 워커 모드로 운영하며, CodeRabbit + 로컬 컨테이너 검증을 우선한다. 자동 CI/security worker 재활성화 기준은 `docs/ops/ci-security-worker-reactivation.md`가 최신 카논이다.

## Docker Compose 구성 {#compose}

> 출처: `docker-compose.yml` (prod 기본) + `docker-compose.dev.yml` (override) + `Makefile` + `memory/project_infra_docker.md`.

| 서비스 | 이미지 | Prod 포트 | Dev 호스트 포트 |
|---|---|---|---|
| `web` | nginx + SPA build | **80 (외부)** | 비활성 (Vite dev server 사용) |
| `server` | Go 1.25 multi-stage (distroless 타깃) | internal | 8080, 9090 |
| `postgres` | postgres:17-alpine | internal | **25432** (default 5432 충돌 회피) |
| `redis` | redis:7-alpine | internal | **26379** (default 6379 충돌 회피) |

### 핵심 명령

```bash
make up prod          # 운영 모드 (Nginx:80 단일 노출)
make up dev           # 개발 모드 (포트 expose, web 컨테이너 비활성)
make down
make build / build-no-cache
make logs s=server
make ps
```

### Dev 모드 UID 매칭

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) \
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

- `Dockerfile.dev`가 ARG로 호스트 UID/GID 받아 `appuser` 생성 — 호스트 bindmount(`apps/server/tmp/`) 권한 충돌 방지.
- `direnv` 사용 시: `.envrc`에 export 추가 후 `direnv allow`.
- **1회만 `--build` 필요** (Dockerfile.dev 변경 반영). 이후 생략 가능.

### 네트워크
- 컨테이너 간: `default` bridge.
- ARC runner 컨테이너와 공유: `runners-net` (Phase 22 W1.5에서 명시). docker-compose.yml `name: runners-net` 명시 필수 (compose project prefix 회피).

## Nginx 리버스 프록시 {#nginx}

> 출처: `apps/web/nginx.conf`.

- SPA 정적 서빙 (`apps/web/dist/`)
- `/api/*` → `server:8080`
- `/ws/*` → `server:8080` (WS upgrade)
- 외부 진입점은 prod에서 80 단일 (장기적으로 Cloudflare Tunnel 연결 예정 — `memory/project_infra_docker.md`)

## CI/CD (GitHub Actions) {#ci}

### Workflow 구성

> 위치: `.github/workflows/`. 정확한 파일 목록은 직접 ls 권장.

대표 workflow:
- **`ci.yml`** — Go test, web test, lint, typecheck, migration drift gate, codecov, govulncheck, gitleaks, trivy, OSV, CodeQL, SBOM, provenance
- **`e2e-stubbed.yml`** — Playwright 4 shard (chromium + firefox), self-hosted containerized
- **`renovate.yml`** — 의존성 자동 PR
- **`runner-image.yml`** (Phase 23 도입) — custom runner image 빌드 + GHCR push
- **arc.yml** (UNVERIFIED 정확한 파일명) — ARC RunnerScaleSet values + smoke test (PR #179)

### 현재 required status checks

> 2026-05-07 기준 `gh api repos/sabyunrepo/muder_platform/branches/main/protection`로 확인.

- Required check: `CodeRabbit`
- Strict up-to-date: enabled
- Required approving review count: 0
- Stale PR review dismissal: enabled

개발 최소 워커 모드에서는 GitHub Actions full CI/E2E/security worker를 PR 생성이나 push만으로 자동 실행하지 않는다. 코드 변경 PR은 PR 생성 전 `scripts/mmp-local-ci.sh quick`을 기본 실행하고, 위험도에 따라 `coverage`, `e2e`, `full`로 넓힌다.

서비스 운영 전 자동 worker를 다시 켜는 기준과 branch protection 갱신 절차는 `docs/ops/ci-security-worker-reactivation.md`를 따른다.

## ARC Self-hosted Runner (Phase 22~23) {#arc}

> 출처: `memory/sessions/2026-04-28-phase-22-w1-complete.md`, `2026-04-28-debt-cleanup-runner-network.md`, `2026-04-29-phase-23-custom-runner-image-merge.md`.

### 인프라
- **KT Cloud KS (Kubernetes Service)** — `actions-runner-controller` 운영
- **5 runner pool** — `containerized-runner-1~5`, host `sabyun@100.90.38.7`
- **이미지 소스** (Phase 23 이후): `ghcr.io/<org>/mmp-runner:<tag>` (이전 KT registry, 가용성 이슈로 전환 — commit 035f004)
- **이미지 toolchain** (Phase 23): image-resident — Go 1.25, Node 20, pnpm, Playwright 브라우저 사전 설치 (commit 01d2808)

### 호스트 구성
- `~/infra-runners/docker-compose.yml` — runner pool compose
- **현재 `~/infra-runners`는 git repo가 아님** — 사용자 manual sync. PR 머지 자동 동기화 부재. W1.5 PR-7 후보로 등록.
- **PAT 노출 위험** — `docker compose config` 출력에 PAT 그대로 노출됨 (2026-04-28 발견). 사용자 회전 권고.

### Service container init bug (Phase 22 W1.5)
- `myoung34/github-runner` ↔ GH Actions service container 호환 부재
- 우회: workflow step에서 `docker run --network runners-net` 직접 호출
- 추가 fix:
  - sudo docker prefix (workflow step의 sup group 990 lost)
  - `runners-net` 동적 검출 (compose project prefix 회피)
  - host 재배포 후 4 shard 진행

## 머지 정책 {#merge-policy}

> 출처: `AGENTS.md`, `.codex/skills/mmp-pr-lifecycle/SKILL.md`, `docs/ops/ci-security-worker-reactivation.md`.

### 현 상태 (2026-05-07 기준)

- `main` 직접 커밋 금지.
- feature branch/worktree → PR → merge.
- PR 기본 게이트는 CodeRabbit clear, unresolved review thread 0, focused local validation evidence.
- 기본 PR 처리에서는 `ready-for-ci` 라벨과 `workflow_dispatch`를 사용하지 않는다.
- GitHub Actions full CI는 위험 PR의 명시적 최종 확인 버튼으로만 사용한다.

### 정상 자동 worker 모드 복귀

자동 CI/security worker 복귀는 `docs/ops/ci-security-worker-reactivation.md`의 Phase 1/2 기준을 따른다. required status check는 실제 PR head에서 안정적으로 생성되는 check만 추가한다.

## 4-agent Review (admin-merge 전 강제) {#4-agent-review}

> 출처: `memory/feedback_4agent_review_before_admin_merge.md`.

- **언제**: 모든 PR (Auto mode + CI admin-skip 모드 포함)
- **무엇**: 4 병렬 agent — security / perf / arch / test
- **HIGH 잔존 시**: 머지 금지 → fold-in 또는 분리 PR
- **이유**: PR-2c (#107) 리뷰 생략 후 HIGH `handleCombine` deadlock 누락 → hotfix #108 발생

대표 사례:
- PR-167 (DEBT cleanup) — 4-agent HIGH 4건 발견 → H-SEC-1/H-ARCH-1/H-ARCH-2 fold-in, H-TEST-1은 W1.5 PR-1 분리
- PR-168 (Runner Cache) — HIGH 5건 fold-in (fork PR poisoning, setup-go cache 충돌, race-safe 근거 등)

## 환경별 동작 차이 {#env-diff}

| 환경 | DB | Redis | WS 인증 | 비고 |
|---|---|---|---|---|
| **dev** (compose) | 25432 (host) | 26379 (host) | JWT 또는 `?player_id=` fallback | UID 매칭 필요 |
| **CI** (ARC) | service container | service container | JWT 강제 | runners-net bridge 공유 |
| **prod** (계획) | K8s 1 Deployment + managed Postgres | managed Redis | JWT only | Cloudflare Pages (web) |

## DB Migration 정책 {#migration-policy}

- 자동 적용: server 시작 시 `goose Up` 실행 (UNVERIFIED 정확한 위치 — main 또는 init).
- 수동: `cd apps/server && goose -dir db/migrations postgres "$DATABASE_URL" up`
- **외래키 변경 / 데이터 마이그레이션**: 6전문가 토론 절차 강제 (`memory/feedback_migration_workflow.md`)
- migration drift gate (CI) — PR이 migration 추가하면서 sqlc generate 누락 시 차단

## graphify (의존성 그래프) {#graphify}

> 출처: `memory/feedback_graphify_first.md`, `memory/project_graphify_refresh_policy.md`.

- 위치: `graphify-out/GRAPH_REPORT.md`, `graph.json`, `manifest.json`
- 사용: 아키텍처/의존성 질문은 graphify 먼저, 그 다음 QMD, 마지막에 코드 직접 read
- refresh 정책 (D — 2026-04-18 결정):
  - **Phase 종료 시점만** fresh rebuild + PR 커밋
  - 일상 post-commit/watch/update는 **로컬 전용·커밋 금지**
  - 현재 graphify-out에 `.needs_update` 표시 있음 (오늘 2026-04-30 mtime)

## QMD (로컬 문서 검색) {#qmd}

> 출처: `memory/reference_qmd_setup.md`, `memory/feedback_qmd_memory_leak.md`.

- 4 컬렉션: `mmp-plans` (291), `mmp-memory` (66), `mmp-specs` (9), `mmp-v2-docs` (98)
- 사용 룰: `docs/plans/`, `memory/` 경로는 grep 대신 QMD 우선 (`memory/feedback_qmd_plan_resume.md`)
- 메모리 누수 회피: 컬렉션 최소화 + 장시간 세션 주기 재시작

## AI 설계 시 주의 {#design-notes-for-ai}

- **신규 workflow 추가**: `runs-on` 은 `[self-hosted, containerized]` (Phase 22 W1.5 PR-5 H-3 정책 — 09-issues-debt.md 참조).
- **신규 status check**: branch protection에 추가하지 않으면 무효. 사용자가 GitHub UI에서 등록해야 함.
- **secret 노출 위험**: GH Actions에서 `docker compose config` 출력 금지 (PAT plain text 노출).
- **K8s 배포 정책**: 현재 prod 배포 정책 미확정 — 신규 phase 설계 시 `09-issues-debt.md` 의 prod readiness 체크.
- **admin-skip 종료 후**: 정상 머지 모드 복귀 = 13 required check 모두 green 필요. 회피 패턴 도입 금지.
