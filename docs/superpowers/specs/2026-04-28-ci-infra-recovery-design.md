# CI Infra Recovery — Design Spec

**Date**: 2026-04-28
**Topic**: ci-infra-recovery
**Scope**: 단일 hotfix PR (5 file, ~30-50 LOC)
**Driver**: 2026-05-01 admin-skip 정책 만료 D-3 안에 main CI green 확보

## Context

main branch에서 모든 self-hosted runner 워크플로우(`ci.yml`, `e2e-stubbed.yml`, `security-fast.yml`, `security-deep.yml`)가 fail 중. 12개 job 영향. cloud runner 워크플로우(`ci-hooks.yml` 등)는 영향 없음.

QMD 회상(`mmp-plans` k=5):
- Phase 18.3 PR-1(`33d2d72`)에서 코드 레벨 CI 부채(golangci-lint v1↔Go 1.25, ESLint 9 flat config, env leak) 전부 해결
- `feedback_ci_infra_debt.md`는 outdated — "잔여 이슈 없음" 표기지만 main fail 중

이번 작업은 Phase 18.3 카논과 무관한 **새로운 환경 부채** 2건 해결.

## 원인 (Root Cause)

| Issue | 영향 job | 원인 |
|-------|--------|------|
| **Issue 1: EACCES on `apps/server/tmp/build-errors.log`** | 12 jobs (전 self-hosted) | `docker-compose.dev.yml`이 `Dockerfile.dev`를 root 사용자로 실행 + `./apps/server:/build` host bindmount 사용. 컨테이너 안 root가 `apps/server/tmp/`에 air `build-errors.log` + `main` binary 생성 → 호스트 측 owner = `root`. CI runner는 일반 사용자라 `actions/checkout` cleanup 단계에서 unlink 실패 → checkout 자체가 ⓧ로 끝남. 12 job 모두 같은 step에서 fail. |
| **Issue 2: postgres `5432` host port collision** | Go Lint+Test (1) + E2E shards (4) | `ci.yml`/`e2e-stubbed.yml` postgres service container가 `ports: - "5432:5432"` 고정. 동일 self-hosted runner 호스트에 병렬 job 또는 dev compose가 5432 점유 시 `Bind for 127.0.0.1:5432 failed: port is already allocated` 발생. Issue 1 해결돼도 잔존. |

**전환 기간 부채**: runner 호스트에 이미 root 소유 orphan 파일 잔존. PR 머지 전 1회 수동 청소 필요. **2026-04-28 사용자가 `sudo rm -rf` 직접 실행 완료**.

## 결과 (Symptoms 카탈로그)

- `gh run list --branch main` 직전 push 결과: CI ❌ / E2E Stubbed ❌ / Security Fast ❌ / Security Deep ❌ / Phase 18.1 nightly ✅ / ci-hooks ✅
- 모든 fail의 첫 step이 `Checkout` 또는 `Initialize containers`에서 발생 — 실제 비즈니스 로직은 단 한 줄도 실행 못함
- `feature_branch_pr_workflow.md` 정책 위반 없이 머지하려면 admin-skip 의존 — 만료 후 PR 진입 불가

## 권장 / 선택 결정

**B2 — 양쪽 근본 수정** 채택 (사용자 확정 2026-04-28):
- Issue 1: `Dockerfile.dev` + `docker-compose.dev.yml` UID/GID 매칭으로 root 소유 파일 생성 자체 차단
- Issue 2: workflow service container를 ephemeral host port로 전환

**기각된 대안**:
- B1 (workflow yaml만) — Issue 1 재발 가능 (dev 사용 시점마다)
- B3 (air tmp_dir docker named volume) — hot reload 검증 범위 ↑, scope 위반
- A (workflow에 `sudo rm -rf` step) — defense-in-depth로 간주됐으나, 사용자가 이미 1회 청소 완료 + B2가 root cause 제거하므로 불필요한 고정 부채 회피

## Components (변경 파일)

### 1. `apps/server/Dockerfile.dev`

**변경**: 비-root user 추가 + `USER` 지시어. `air` 실행 권한 보존.
```dockerfile
# (추가)
ARG USER_UID=1000
ARG USER_GID=1000
RUN groupadd -g ${USER_GID} appuser && \
    useradd -m -u ${USER_UID} -g ${USER_GID} -s /bin/bash appuser

# (기존 setup 후, ENTRYPOINT 또는 CMD 직전)
USER appuser
```

**근거**: `USER_UID`/`USER_GID`는 build-time arg로 받아 호스트와 일치. 컨테이너 안 air가 만드는 모든 파일은 호스트 측에서 같은 사용자 소유.

### 2. `docker-compose.dev.yml`

**변경**: `build.args` + `user` 추가.
```yaml
services:
  server:
    build:
      context: ./apps/server
      dockerfile: Dockerfile.dev
      args:
        USER_UID: ${HOST_UID:-1000}
        USER_GID: ${HOST_GID:-1000}
    user: "${HOST_UID:-1000}:${HOST_GID:-1000}"
    # (나머지 그대로)
```

**근거**: `HOST_UID`/`HOST_GID` env로 받아 image build + runtime 모두에 적용. 미설정 시 `1000` fallback (대부분 Linux dev 환경 default).

### 3. `.github/workflows/ci.yml`

**변경**: 영향 받는 모든 job (`typescript`, `go`, `coverage-guard`)의 service container 포트 매핑 + DATABASE_URL/REDIS_URL.

```yaml
services:
  postgres:
    image: postgres:17-alpine
    env: { ... }
    ports:
      - "5432"             # ← "5432:5432" 에서 host port 제거
    options: { ... }
  redis:
    image: redis:7-alpine
    ports:
      - "6379"             # ← "6379:6379" 에서 host port 제거
    options: { ... }

env:
  DATABASE_URL: postgres://mmp:mmp_test@localhost:${{ job.services.postgres.ports['5432'] }}/mmp_test?sslmode=disable
  REDIS_URL: redis://localhost:${{ job.services.redis.ports['6379'] }}
```

**근거**: GitHub Actions service container는 `ports: - "5432"` 형식 시 host에 무작위 ephemeral port 할당. `${{ job.services.X.ports['Y'] }}`로 동적 참조 가능. 병렬 job들이 서로 다른 host port 할당받아 충돌 0.

### 4. `.github/workflows/e2e-stubbed.yml`

**변경**: ci.yml과 동일 패턴. `e2e` job 1개 (chromium/firefox × shard 1/2 matrix 합쳐 4 run).

### 5. `apps/server/CLAUDE.md` (또는 `CONTRIBUTING.md`)

**변경**: dev 시작 명령 업데이트.
```bash
# 기존
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# 신규
HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**근거**: 첫 1회 `--build` 필수 (Dockerfile.dev 변경 반영). 이후엔 `--build` 없어도 됨. `direnv`/`.envrc` 안내 옵션 추가 가능.

## Data Flow (CI 실행 흐름)

```
GitHub push → workflow trigger → self-hosted runner 머신
  ├─ actions/checkout v4
  │   └─ workspace cleanup: rm -rf .../muder_platform/*
  │       └─ apps/server/tmp/build-errors.log (root 소유)
  │           ├─ 변경 전: ❌ EACCES → checkout fail → 전체 job ❌
  │           └─ 변경 후: ✅ 호스트 user 소유 (← B2 #1 효과) → unlink 성공
  │
  └─ 서비스 컨테이너 시작
      └─ docker run postgres:17-alpine -p ${HOST_PORT}:5432
          ├─ 변경 전: HOST_PORT=5432 고정 → 다른 job 충돌 ❌
          └─ 변경 후: HOST_PORT=ephemeral (auto) → 충돌 0 ✅
```

## Testing

1. **본 PR push**: branch `fix/ci-infra-recovery` → 12개 job green 확인 (Go test, E2E 4 shard, security 6 job, TypeScript)
2. **dev 환경 검증**: Mac에서
   ```
   HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```
   정상 시작. 컨테이너 안 air 정상 동작 (hot reload), `apps/server/tmp/main` 생성 후 호스트 `ls -la`에서 사용자 소유 확인.
3. **prod compose 영향 0 확인**: `docker compose -f docker-compose.yml up`(prod-like)는 `Dockerfile`(non-dev)을 쓰므로 변경 영향 없음. 검증: 병렬로 띄워 정상.
4. **회귀 보장**: 기존 Phase 18.3 카논(golangci-lint v2, ESLint 9 flat config) 그대로 통과 — 본 PR은 그 영역 무수정.

## 4-agent 리뷰

`memory/feedback_4agent_review_before_admin_merge.md` 카논 — admin-merge 전 4-agent 병렬 리뷰 필수.

- **security-reviewer**: postgres password env 노출 변화 없음, `${HOST_UID}` injection 가능성 검토
- **code-reviewer**: Dockerfile multi-stage 일관성, dev/prod 분리 명확성
- **architect**: dev/prod compose 차이 카논 일관성, CONTRIBUTING 한 곳 source of truth
- **test-engineer**: 12 job green 검증, dev rebuild 회귀 시나리오

## Anti-pattern (자가 검증)

- ❌ workflow에 `sudo rm -rf` step 추가 — root cause 우회 (사용자 1회 청소로 대체 완료)
- ❌ prod `Dockerfile` 변경 — scope 위반 (dev only)
- ❌ air tmp_dir 자체 변경 — B3 거부 결정 위반
- ❌ admin-skip 정책 본 PR에서 같이 해제 — 별도 단계(P3 task)로 분리 (single concern)

## Scope (단일 PR)

- branch: `fix/ci-infra-recovery`
- 변경 파일: 5개 (Dockerfile.dev, docker-compose.dev.yml, ci.yml, e2e-stubbed.yml, apps/server/CLAUDE.md)
- 추정 LOC: 30-50
- 추정 시간: 1.5~2시간 (구현 1h + push CI green 검증 30m + 4-agent 리뷰 30m)
- 머지 후속: P2 (PR-11 hygiene), P3 (admin-skip 해제), P4 (Phase 21 dogfooding)

## 비기능 요구사항

- ✅ feature branch + PR 워크플로우 (`feedback_branch_pr_workflow.md`)
- ✅ 4-agent 리뷰 admin-merge 전 (`feedback_4agent_review_before_admin_merge.md`)
- ✅ Sonnet 4.6 위임 카논 (`feedback_sonnet_46_default.md`)
- ✅ user-home memory 작성 X (`feedback_memory_canonical_repo.md`)
- ⚠️ admin-skip 정책 D-3 (2026-05-01 만료) — 본 PR도 admin-merge 적용 (정책 만료 전)

## Out of Scope (carry-over)

본 PR scope 외 — 별도 PR 또는 향후 phase로:
- `feedback_ci_infra_debt.md` outdated 갱신 (PR-11 hygiene 후보)
- prod `Dockerfile` non-root user (dev/prod 일관성 추후 검토)
- self-hosted runner 자체 보안 hardening (`.runner` 설정, sudo 정책 등)
- `direnv`/`.envrc` 도입 (개발자 onboarding 개선)
