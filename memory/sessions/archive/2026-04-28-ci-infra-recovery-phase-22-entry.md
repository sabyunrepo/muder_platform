---
topic: "PR-164 ci-infra-recovery 머지 + Phase 22 runner-containerization brainstorm 진입"
phase: "P1 완료 → P5 (Phase 22) 진행 중"
prs_touched: [PR-#164]
session_date: 2026-04-28
---

# Session Handoff: ci-infra-recovery 머지 + Phase 22 brainstorm 진입

## Decided

- **PR #164 머지** (squash `dbe6a65`) — self-hosted runner 12 job fail 정상화. EACCES (Dockerfile.dev appuser + compose UID/GID 주입) + postgres 5432 collision (workflow ephemeral port + env templating + goose/psql) 두 root cause 영구 제거.
- **dev compose 포트 25432/26379로 시프트** — runner 호스트 langfuse-postgres(영구 5432 점유) + langfuse-redis(영구 6379 점유) 동거 환경 회피. spec 시점 `5432:5432`에서 사후 결정 (drift acknowledgment를 plan refs/task-1-2-dev-compose.md에 추가).
- **Phase 22 brainstorm 진입** (P5 우선순위 격상) — 모든 워크플로우 self-hosted 단일화 + myoung34/github-runner 4 컨테이너 ephemeral + bash 3.2 macOS test → docker run bash:3.2-alpine step 형태로 변환.
- **Phase 22 Q1 — Docker 접근 방식: socket mount (`/var/run/docker.sock`) 채택**. 32GB RAM 안전 예산 (상주 가구 10GB + 4×3GB runner = 22GB / 여유 10GB). 본 repo는 외부 PR 거의 없음 + main 보호 + admin-skip → DinD over-engineering.
- **사용자 설명 형식 카논화** — `memory/feedback_explanation_style.md` 신규. 진단·결정·design 보고 시 원인/결과/권장 3섹션 + 비개발자 친화 어휘.
- **task list 우선순위 재배치** — P1 ✓ → **P5 (Phase 22)** → P2 (PR-11 hygiene) → P3 (admin-skip 해제) → P4 (Phase 21 dogfooding)

## Rejected

- ~~B1 narrow workflow-only~~ — Issue 1 재발 가능 (dev compose 매 사용 시점)
- ~~B3 air tmp_dir docker named volume~~ — hot reload 검증 범위 ↑
- ~~workflow에 `sudo rm -rf` cleanup step~~ — root cause 우회. 사용자 1회 cleanup으로 대체
- ~~DinD 격리~~ — 위협 모델 비례 over-engineering, 본 repo 외부 PR 거의 없음
- ~~bash 3.2 별도 라벨 runner~~ — runner 1개 더 늘리지 않고 docker step 내부 실행으로 해결

## Risks

- **runner workspace = dev workspace 동거 함정** — PR-164는 fix지만 근본 격리는 P5 (Phase 22)에서 해결. P5 진행 전까지 같은 함정 잔존.
- **Phase 22 진행 중 brainstorm 미완료** — Q1만 답변, design 섹션 미시작. spec/plan 미작성. 다음 세션에서 Q2~design 진행 필요.
- **PR-164 carry-over 17건** — 4-agent 리뷰 LOW/MED finding (Sec LOW 7 + Perf F-1/F-2/F-3 + Arch I-2/M-1/M-4/S-1~S-4 + Test F-2~F-8). PR-11 hygiene으로 통합 예정.
- **CI admin-skip 만료 D-3 (2026-05-01)** — P3 진입 전 모든 fail 검사 해소 또는 정책 연장 결정 필요.
- **graphify-out 미커밋** — 정책 D 유지. 일상 commit 금지.
- **runner 등록 token 발급 절차 미결정** — Phase 22 PR 진입 전 결정 필요 (PAT vs repo-scoped registration).

## Files

### 이번 세션 main 변경 (PR-164 squash `dbe6a65`)
- `apps/server/Dockerfile.dev` (ARG USER_UID/GID + appuser non-root)
- `docker-compose.dev.yml` (HOST_UID/GID 주입 + 25432/26379 host port + coupling comment)
- `.github/workflows/ci.yml` (postgres/redis ephemeral port + env templating + ephemeral comment)
- `.github/workflows/e2e-stubbed.yml` (ephemeral port + env + goose 연결 + psql -p)
- `apps/server/CLAUDE.md` (dev startup canonical command + 호스트 포트 명시)
- `docs/superpowers/specs/2026-04-28-ci-infra-recovery-design.md` (spec)
- `docs/plans/2026-04-28-ci-infra-recovery/` (index + 5 refs + reviews/PR-164.md)
- `memory/feedback_explanation_style.md` (NEW)
- `memory/MEMORY.md` (entry 추가)

### 이번 wrap에서 main 변경 (별도 commit 예정)
- `memory/sessions/2026-04-28-ci-infra-recovery-phase-22-entry.md` (이 파일)
- `memory/QUESTIONS.md` (Q-runner-secrets + Q-spec-host-survey append)
- `memory/MEMORY.md` (P1/P5 entry 추가)
- (사용자 승인 시) `memory/MISTAKES.md` (port-mapping NEW 1건)
- (옵션) `memory/feedback_runner_host_port_conflict.md` (NEW)
- (옵션) `memory/project_ci_infra_recovery_progress.md` (NEW)

## Remaining

### P5 Phase 22 brainstorm 재개 (다음 세션 첫 작업)
- Q1 답변 ✓ (socket mount 결정)
- Q2~ : 다음 결정 필요 항목
  - Runner 등록 token 방식 (GitHub PAT vs repo-scoped registration token)
  - compose 위치 확정 (`infra/runners/docker-compose.yml` 제안)
  - Network 격리 (host network vs docker network)
  - 4 runner instance 명명 규칙 (containerized-runner-1~4)
  - bash 3.2 step pattern 표준 형태 합의
- design 섹션 (architecture / components / data flow / testing / scope)
- spec write `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md`
- writing-plans → `docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md`

### P2 PR-11 hygiene 후보 (PR-164 carry-over 17건)
- Security LOW: dev compose 25432/26379 → `127.0.0.1` loopback bind
- Security LOW: HOST_UID=0 거부 가드
- Security LOW: CI postgres password를 secrets로
- Perf F-1: `chown -R /go` 스코프 축소 (`/go/bin`만)
- Perf F-2: Makefile `up` 타겟에 `HOST_UID=$(id -u)` 자동 주입
- Perf F-3: `e2e-stubbed.yml` Go 1.24 → 1.25 align
- Arch I-2: HOST_UID/HOST_GID convention SSOT (현재 4곳 분산)
- Arch S-3: `memory/project_dev_port_convention.md` 신규
- Arch M-4: `feedback_ci_infra_debt.md` outdated marker 제거 + PR-164 참조
- Test F-8: `actionlint` CI step
- 그 외 5+건

## Next Session Priorities

1. **P5 Phase 22 brainstorm 재개** — `superpowers:brainstorming` Q2부터. socket mount 결정은 design 섹션 작성에 inject. Done: spec write 시점.
2. **Phase 22 design 섹션** (architecture / components / testing) — design doc commit. Done: `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md` 존재.
3. **Phase 22 plan write** — `docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md` 초안. Done: index + W1 PR 목록 기술됨.
4. **(병행)** 사용자 결정 대기 항목 — runner 등록 token 방식, compose 위치, network 모드.

## What we did

### `/compound-resume` 진행
세션 시작 시 사용자가 `/compound-resume` 명시 호출. 가장 최근 mtime `memory/sessions/2026-04-28-compound-mmp-wave4-complete.md` + plan vivid-snuggling-pascal.md + 카논 cheat-sheet 일괄 read. 권장 흐름 결정 (CI infra fix → PR-11 hygiene → admin-skip 해제 → Phase 21 dogfooding).

### PR-164 (CI infra recovery) 풀 사이클
qmd-recall (Phase 18.3 ci-infra) → brainstorming (사용자 결정 사항: B2 dev compose UID + workflow ephemeral port 양쪽 근본 수정) → writing-plans (5 ref 파일 분할) → Task 1+2 (Dockerfile.dev appuser + docker-compose.dev.yml HOST_UID/GID) → Task 3+4 subagent-driven (workflow ephemeral port + env templating + goose/psql 템플릿) → Task 5 (apps/server/CLAUDE.md dev startup) → 4-agent 병렬 리뷰 (HIGH 0 실질 / IMPORTANT 3 fold-in 완료) → admin merge `dbe6a65`.

runner 호스트 직접 SSH 작업: dev compose down (volume 보존) → SCP 새 Dockerfile.dev/compose → tar over ssh로 incomplete apps/server 복원 (62MB) → `HOST_UID=$(id -u) HOST_GID=$(id -g) docker compose up --build` → langfuse 5432 충돌 발견 → 사용자 결정 dev port 25432/26379 시프트 → 재시도 → 모든 컨테이너 healthy + sabyun:sabyun owner 검증 완료.

### Phase 22 진입 (P5)
사용자 요청: 모든 워크플로우 self-hosted 단일화 + 컨테이너 워커. P5 task 우선순위 격상 (P2/3/4보다 앞). qmd-recall (Phase 18.7 CI hardening 가장 근접, 신규 토픽) → brainstorming Q1 docker access 방식 → 사용자 socket mount 채택. design 섹션 진입 직전 wrap-up 결정.

## What blocked us

- Phase 22 brainstorm Q1 답변 후 design 섹션 미시작 — 시간상 wrap-up으로 전환
- runner workspace .git 부재 → SCP/tar로 코드 동기화 우회 (rsync 미설치 fallback)
- `removeBlockedBy` task API 부재 → P5 재생성으로 의존성 정리 우회

## Next session 첫 5초

- **첫 메시지**: `/compound-resume`
- **메인의 첫 read**: 이 파일 (`memory/sessions/2026-04-28-ci-infra-recovery-phase-22-entry.md` — 가장 최근 mtime)
- **첫 액션 후보**:
  1. Phase 22 brainstorm Q2 진입 (Runner 등록 token 방식부터)
  2. design 섹션 작성
  3. spec write + plan checklist 초안
- **참고할 카논**:
  - `docs/plans/2026-04-28-ci-infra-recovery/refs/reviews/PR-164.md` (PR-164 4-agent 리뷰 보고서, carry-over)
  - `memory/feedback_explanation_style.md` (사용자 설명 형식 카논)
  - `.claude/plugins/compound-mmp/refs/lifecycle-stages.md` (compound 4단계)
