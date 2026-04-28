# Phase 22 — Runner Containerization Design

> **Status**: spec draft (brainstorm 완료, plan 미작성)
> **Author**: hoone0802
> **Date**: 2026-04-28
> **Predecessor**: PR-164 ci-infra-recovery (`dbe6a65`) — fix가 아닌 근본 격리

## 1. Goal

self-hosted runner를 호스트 직접 실행에서 **myoung34/github-runner 4 컨테이너 ephemeral pool**로 전환. PR-164의 fix(EACCES + port collision)를 넘어 **runner workspace ↔ dev workspace 동거 함정** 자체를 격리로 제거.

## 2. Background

### 2.1 PR-164에서 해결된 것
- `apps/server/tmp/build-errors.log` EACCES → Dockerfile.dev appuser non-root + `HOST_UID/GID` 주입.
- postgres/redis port 5432/6379 collision → workflow ephemeral port + `${{ job.services.X.ports['Y'] }}` 템플릿 + dev compose 25432/26379 시프트.

### 2.2 PR-164에서 해결되지 않은 것 (Phase 22 scope)
- runner가 `~/actions-runner/_work/muder_platform/muder_platform`에서 user dev workspace와 **같은 디스크/UID**로 동작 → 함정 잔존.
- runner 프로세스가 host에 직접 떠 있어 **isolation 0** (한 runner crash가 다른 job 영향).
- bash 3.2 macOS test가 호스트 macOS bash에 의존 → 향후 host upgrade 시 회귀 위험.

### 2.3 호스트 환경 제약
- **macOS host (Apple Silicon, 32GB RAM)**.
- 상주 컨테이너: langfuse-postgres(5432), langfuse-redis(6379) — 영구 점유.
- dev compose: 25432/26379 시프트 (PR-164).
- RAM 예산: 상주 가구 10GB + 4×3GB runner = 22GB / 여유 10GB.

## 3. Decisions (brainstorm 결과)

| Q | 결정 | 카논 위치 |
|---|------|----------|
| Q1 Docker 접근 방식 | **socket mount** (`/var/run/docker.sock`) | 직전 brainstorm 핸드오프 |
| Q2 Runner 등록 token | **fine-grained PAT** (`ACCESS_TOKEN`, repo scope) | 본 spec §5.1 |
| Q3 Compose 위치 | `infra/runners/docker-compose.yml` | 본 spec §5.1 |
| Q4 Network 모드 | 사용자 정의 bridge `runners-net` | 본 spec §5.4 |
| Q5 명명 | `containerized-runner-1`~`4` | 본 spec §5.2 |
| Q5 라벨 | `self-hosted,linux,containerized` | 본 spec §5.2 |
| Q6 bash 3.2 step | 인라인 `docker run --rm bash:3.2-alpine` | 본 spec §5.5 |
| 재시작 정책 | `restart: always` | 본 spec §5.2 |
| Workspace 격리 | per-runner named volume | 본 spec §5.3 |
| 마이그레이션 | 점진 4 wave (W1~W4) | 본 spec §6 |
| 회수 | GH UI deregister + `~/actions-runner` archive → 1주 후 rm | 본 spec §6 W4 |
| Workflow 라벨 변경 | Wave 3 단일 PR (8 workflow) | 본 spec §6 W3 |

거부:
- ~~DinD~~ (over-engineering, 본 repo 외부 PR 거의 없음 + main 보호)
- ~~host network mode~~ (macOS Docker Desktop 부분 지원, 격리 ↓)
- ~~workload-specific 명명~~ (4 runner 동일 capability)
- ~~기존 host runner 즉시 deregister~~ (회귀 fallback 보존)

## 4. Architecture

```
┌─ macOS host ───────────────────────────────────────────────┐
│                                                             │
│  langfuse-postgres:5432  langfuse-redis:6379   ← 상주        │
│  dev compose (25432/26379)  ← 사용자 dev workflow            │
│                                                             │
│  ┌─ docker network: runners-net (bridge) ─────────────┐    │
│  │  containerized-runner-1  (volume: runner1-work)     │    │
│  │  containerized-runner-2  (volume: runner2-work)     │    │
│  │  containerized-runner-3  (volume: runner3-work)     │    │
│  │  containerized-runner-4  (volume: runner4-work)     │    │
│  │       │                                             │    │
│  │       └── /var/run/docker.sock (bindmount, ro/rw)   │    │
│  └────────┼────────────────────────────────────────────┘    │
│           │                                                 │
│  host docker daemon ◄───── socket call (job container spawn)│
│           │                                                 │
│  job containers (default network, bash:3.2-alpine 등)        │
│                                                             │
└─────────────────────────────────────────────────────────────┘

GitHub.com ◄──── outbound HTTPS (registration + job poll + log)
```

격리 경계:
- runner 컨테이너 ↔ host: filesystem(named volume), network(`runners-net`), process namespace.
- runner 컨테이너 ↔ runner 컨테이너: 각자 named volume, network 같으나 inter-runner 통신 없음.
- runner 컨테이너 ↔ job 컨테이너: socket call로 host docker가 spawn → job은 default bridge network에서 별도 lifecycle.

## 5. Components

### 5.1 `infra/runners/`

```
infra/runners/
├── docker-compose.yml      ← 4 service + named volume + network
├── .env.example            ← ACCESS_TOKEN, REPO_URL, DOCKER_GID
├── .gitignore              ← .env (PAT 보호)
└── README.md               ← bootstrap / register / rotate / decommission
```

### 5.2 `docker-compose.yml` 핵심

```yaml
x-runner: &runner
  image: myoung34/github-runner:latest
  restart: always
  env_file: .env
  environment:
    EPHEMERAL: "true"
    DISABLE_AUTO_UPDATE: "true"
    RUN_AS_ROOT: "false"
    LABELS: "self-hosted,linux,containerized"
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
  group_add:
    - "${DOCKER_GID}"
  networks:
    - runners-net

services:
  runner-1:
    <<: *runner
    container_name: containerized-runner-1
    environment:
      <<: ...   # YAML merge anchor
      RUNNER_NAME: containerized-runner-1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner1-work:/runner/_work
  # runner-2~4 동일 패턴

volumes:
  runner1-work:
  runner2-work:
  runner3-work:
  runner4-work:

networks:
  runners-net:
    driver: bridge
```

### 5.3 Workspace 격리

named volume per runner (`runner1-work`~`runner4-work`). host bindmount **금지** (PR-164 root cause 재발 차단). 검증: `docker compose -f infra/runners/docker-compose.yml config | grep -v 'bind:'`.

### 5.4 Network

`runners-net` (bridge, internal=false). outbound HTTPS만 필요(GitHub.com, ghcr.io, registry-1.docker.io). 향후 monitoring/registry mirror 사이드카가 같은 network로 합류 가능.

### 5.5 bash 3.2 step 변환

기존 호스트 macOS bash 3.2 의존 step은 다음 형식으로 변환:

```yaml
- name: bash 3.2 compatibility test
  run: |
    docker run --rm \
      -v "$GITHUB_WORKSPACE":/work \
      -w /work \
      bash:3.2-alpine \
      sh -c 'bash --version && bash ./scripts/test-bash-3.2.sh'
```

- composite action 미사용 (사용처 1-2 step 예상). 3+ 호출 발생 시 Phase 23 후보.

## 6. Migration plan

| Wave | 내용 | 산출 | 검증 |
|------|------|------|------|
| **W1** | `infra/runners/` 신규 + 4 컨테이너 부팅 + GH 등록 | PR-1 (`feat/phase-22-runner-pool`) | GH UI에 4 row idle 확인 |
| **W2** | smoke workflow 1개 (`.github/workflows/ci-containerized-smoke.yml`) `runs-on: [self-hosted, containerized]` | PR-2 | 12 job 중 hello-world + go test + ts test + bash 3.2 step green |
| **W3** | 모든 workflow `runs-on` → `[self-hosted, containerized]` 일괄 + bash 3.2 step → docker run 인라인 변환 | PR-3 (atomic switch) | main에서 1주 관측 (12 job × 7일 stable) |
| **W4** | 기존 host runner deregister + `~/actions-runner` archive → 1주 후 rm | 운영 노트 (코드 변경 없음, README 업데이트) | host CPU/메모리 free 확인 |

회귀 시 fallback: W2/W3 PR을 revert + GH UI에서 신규 runner deregister → 기존 host runner가 라벨 매칭으로 자동 재흡수 (W4 전까지 회수 안 됨이 보험).

## 7. Error handling

| 상황 | 대응 |
|------|------|
| PAT 만료/취소 | entrypoint registration fail → exit 1 → `restart: always` 재시도 → 5분 5회 fail 시 멈춤. README에 PAT 회전 절차. |
| docker.sock perm denied | `group_add: [${DOCKER_GID}]` (host docker group GID env inject — `DOCKER_GID=$(stat -f '%g' /var/run/docker.sock)`). |
| Job 도중 host reboot | `restart: always` + ephemeral → 재부팅 시 새 token으로 재등록. 진행 중 job은 GH가 retry. |
| Named volume 디스크 폭주 | runner entrypoint hook 또는 weekly cron으로 `_work` 7일 이상 파일 정리 (W4 이후 별도 PR). |
| GH API rate limit | PAT 1개 + 4 runner 동시 registration → registration token 발급은 unauthenticated rate limit 적용 안 됨 (PAT authenticated). 5000 req/h 안정. |
| Container OOM | `mem_limit: 3g` per runner (compose에 명시) — 4×3=12GB로 host RAM 예산 보호. |

## 8. Testing

- **W1 smoke**: `docker compose up -d` 후 `docker compose logs runner-1 | grep "Listening for Jobs"` (등록 성공 시그널).
- **W2 functional**: smoke workflow PR이 12 job green.
- **W3 regression**: main 머지 후 7일 동안 모든 workflow의 fail rate가 PR-164 머지 시점 baseline과 비교해 동일/낮음.
- **격리 검증**: `docker compose config | grep 'bind:'` empty (host bindmount 0건).
- **회수 검증**: W4 후 `pgrep -f "Runner.Listener"` host에서 0건.

## 9. Out of scope

- Job-level container isolation (workflow `container:` block). 본 phase는 runner pool만 격리.
- ARM64 dedicated runner image. myoung34 x86 image + Apple Silicon emulation으로 충분 검증 후 별도 phase.
- registry mirror / build cache 사이드카. `runners-net` 합류 가능하지만 Phase 23 후보.
- DinD (docker-in-docker). Q1 brainstorm 거부.
- bash 3.2 step composite action 추출. 사용처 3+ 일 때 재고.

## 10. Risks

| 위험 | 완화 |
|------|------|
| PAT scope 광범위 (admin write) | fine-grained PAT 단일 repo 한정 + 6개월 회전 + 1Password 관리 + `.env` gitignore |
| myoung34 image upstream 신뢰 | tag pinning (`latest` → 특정 sha digest) Phase 23 후보 |
| socket mount = host docker 권한 노출 | 본 repo 외부 PR 거의 없음 + main 보호 + admin-skip → 위협 모델 수용 (Q1) |
| Apple Silicon emulation 성능 | W2 smoke에서 wall clock 측정. 기존 호스트 runner 대비 30%+ 느려지면 ARM64 image 검토 |
| 4 runner concurrent + langfuse 동시 가동 | mem_limit 3g per runner + 호스트 free 10GB margin |

## 11. Carry-over from PR-164

PR-164 4-agent 리뷰 LOW/MED 17건은 별도 PR-11 hygiene으로 진행 (Phase 22 scope 외):
- Security LOW: dev compose 25432/26379 → `127.0.0.1` loopback bind
- Security LOW: HOST_UID=0 거부 가드
- Security LOW: CI postgres password를 secrets로
- Perf F-1: `chown -R /go` 스코프 축소
- Perf F-2: Makefile `up` 자동 HOST_UID 주입
- Perf F-3: e2e-stubbed.yml Go 1.24 → 1.25
- Arch I-2: HOST_UID/HOST_GID convention SSOT
- Arch S-3: `memory/project_dev_port_convention.md` 신규
- Test F-8: actionlint CI step
- 외 5+

## 12. References

- 직전 세션 핸드오프: `memory/sessions/2026-04-28-ci-infra-recovery-phase-22-entry.md`
- ci-infra-recovery spec: `docs/superpowers/specs/2026-04-28-ci-infra-recovery-design.md`
- ci-infra-recovery plan: `docs/plans/2026-04-28-ci-infra-recovery/checklist.md`
- 사용자 설명 형식 카논: `memory/feedback_explanation_style.md`
- main 보호 정책: `memory/feedback_branch_pr_workflow.md`
- Sonnet 4.6 위임: `memory/feedback_sonnet_46_default.md`
- 4-agent 리뷰 카논: `memory/feedback_4agent_review_before_admin_merge.md`
- admin-skip 정책 (D-3): `memory/project_ci_admin_skip_until_2026-05-01.md`
- 파일 크기 한도: `memory/feedback_file_size_limit.md`
- 외부 ref: https://github.com/myoung34/docker-github-actions-runner
