# Wave 1 — Runner Pool 부팅 (PR-1)

> Parent: [`../checklist.md`](../checklist.md) | Spec §3, §5

**Goal:** `infra/runners/`에 myoung34/github-runner 4 컨테이너 ephemeral pool을 정의하고 macOS host에서 부팅 → GH에 4 runner 등록 → idle 확인.

**Branch:** `feat/phase-22-runner-containerization` (이미 생성, spec commit `d954328` 위에 task commit 적층)

---

## Task 1 — `infra/runners/` + `.gitignore`

**Files:**
- Create: `infra/runners/.gitignore`

- [ ] **Step 1**: 디렉토리 생성

```bash
mkdir -p infra/runners
```

- [ ] **Step 2**: `.gitignore` 작성

```
# infra/runners/.gitignore
.env
*.log
```

- [ ] **Step 3**: stage + commit (Task 4 README와 묶음, 본 task 단독 commit X)

---

## Task 2 — `docker-compose.yml`

**Files:**
- Create: `infra/runners/docker-compose.yml`

- [ ] **Step 1**: compose 파일 작성

```yaml
# infra/runners/docker-compose.yml
# Phase 22 — Runner Containerization
# Spec: docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md

x-runner-base: &runner-base
  image: myoung34/github-runner:latest
  restart: always
  env_file: .env
  environment: &runner-env
    EPHEMERAL: "true"
    DISABLE_AUTO_UPDATE: "true"
    RUN_AS_ROOT: "false"
    LABELS: "self-hosted,linux,containerized"
  group_add:
    - "${DOCKER_GID}"
  mem_limit: 3g
  networks:
    - runners-net

services:
  runner-1:
    <<: *runner-base
    container_name: containerized-runner-1
    environment:
      <<: *runner-env
      RUNNER_NAME: containerized-runner-1
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner1-work:/runner/_work

  runner-2:
    <<: *runner-base
    container_name: containerized-runner-2
    environment:
      <<: *runner-env
      RUNNER_NAME: containerized-runner-2
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner2-work:/runner/_work

  runner-3:
    <<: *runner-base
    container_name: containerized-runner-3
    environment:
      <<: *runner-env
      RUNNER_NAME: containerized-runner-3
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner3-work:/runner/_work

  runner-4:
    <<: *runner-base
    container_name: containerized-runner-4
    environment:
      <<: *runner-env
      RUNNER_NAME: containerized-runner-4
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner4-work:/runner/_work

volumes:
  runner1-work:
  runner2-work:
  runner3-work:
  runner4-work:

networks:
  runners-net:
    driver: bridge
```

> **참고**: `volumes`와 `environment`를 anchor merge 외에 per-service에서 다시 명시하는 이유는 docker compose가 list/dict merge를 boolean override 방식으로 처리하기 때문. anchor base만 두고 service에서 override가 안전.

- [ ] **Step 2**: `docker compose -f infra/runners/docker-compose.yml config` 실행 → YAML 파싱 OK + service 4개 + named volume 4개 + network 1개 출력 확인

```bash
cd infra/runners
docker compose config
```

Expected: `runner-1`~`runner-4` 4 service 출력, `volumes:` 섹션에 4 named volume, `networks:` 섹션에 `runners-net`.

---

## Task 3 — `.env.example`

**Files:**
- Create: `infra/runners/.env.example`

- [ ] **Step 1**: 작성

```bash
# infra/runners/.env.example
# Phase 22 runner pool 환경변수 — `cp .env.example .env` 후 값 채우기

# GitHub fine-grained PAT
# 발급: https://github.com/settings/personal-access-tokens/new
# Resource owner: sabyunrepo
# Repository access: Only select repositories → muder_platform
# Repository permissions:
#   - Actions: Read and write
#   - Administration: Read and write  (runner 등록에 필수)
#   - Metadata: Read (자동)
ACCESS_TOKEN=

# 대상 repository URL (등록 endpoint)
REPO_URL=https://github.com/sabyunrepo/muder_platform

# 호스트 docker group GID
# macOS: stat -f '%g' /var/run/docker.sock
# Linux: stat -c '%g' /var/run/docker.sock
DOCKER_GID=
```

---

## Task 4 — `README.md` 운영 절차

**Files:**
- Create: `infra/runners/README.md`

- [ ] **Step 1**: 작성

```markdown
# `infra/runners/` — Phase 22 Runner Pool

myoung34/github-runner 4 컨테이너 ephemeral pool. PR-164 fix를 넘어 runner workspace ↔ dev workspace 동거 함정 자체를 격리.

> **Spec**: `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md`

## Bootstrap (최초 1회)

1. fine-grained PAT 발급 (`.env.example` 주석 참조).
2. `cp .env.example .env`.
3. `.env`에 `ACCESS_TOKEN`, `REPO_URL`, `DOCKER_GID` 채우기.
   - macOS: `DOCKER_GID=$(stat -f '%g' /var/run/docker.sock)`
4. `docker compose up -d`.
5. GitHub Settings → Actions → Runners → 4 row idle 확인.

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
```

- [ ] **Step 2**: stage + commit (Task 1, 2, 3, 4 묶음)

```bash
git add infra/runners/.gitignore infra/runners/docker-compose.yml infra/runners/.env.example infra/runners/README.md
git commit -m "$(cat <<'EOF'
feat(phase-22): infra/runners docker-compose pool definition (W1-Task 1~4)

myoung34/github-runner 4 컨테이너 (containerized-runner-1~4) +
named volume per runner + 사용자 정의 bridge network runners-net +
mem_limit 3g + EPHEMERAL=true + RUN_AS_ROOT=false + 라벨
self-hosted,linux,containerized.

.env.example에 fine-grained PAT 발급 절차 inline 명시. README에 bootstrap,
PAT rotate, decommission 절차 카논화.

Plan: docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — `docker compose config` 검증

- [ ] **Step 1**: host bindmount 0건 검증 (workspace만, docker.sock은 의도된 bind라 허용 리스트)

```bash
cd infra/runners
# docker.sock은 Q1 결정 의도 bind. compose가 multi-line YAML 출력하므로 grep -A1 사용
docker compose config 2>/dev/null | grep -A1 'type: bind' | grep 'source:' | grep -v docker.sock || echo "OK: workspace bindmount 0건"
# 추가: per-runner workspace volume 4건 모두 named volume 검증
docker compose config 2>/dev/null | grep -E "source: runner[1-4]-work" | wc -l
```

Expected:
- 첫 명령: `OK: workspace bindmount 0건` 출력 (docker.sock 4건만 bind, 나머지 0)
- 두 번째 명령: `4` 출력 (named volume per-runner)

> **사전 조건**: 검증 시 `.env` 파일이 존재해야 docker compose config가 fail 안 함. dummy 값으로도 충분 — 실제 검증은 schema/topology만. 임시 dummy 후 삭제 권장.

- [ ] **Step 2**: 4 service + 4 volume + 1 network 확인

```bash
docker compose config | grep -E '^\s+(runner-[1-4]|runner[1-4]-work|runners-net):' | wc -l
```

Expected: 9 (service 4 + volume 4 + network 1).

> Task 5는 commit 없음 (검증만).

---

## Task 6 — 사용자 PAT 발급 + `.env` 채우기

> **사용자 작업** — Claude는 안내만.

- [ ] **Step 1**: Claude가 `.env.example` 주석을 사용자에게 보여주고 PAT 발급 절차 안내.
- [ ] **Step 2**: 사용자가 GitHub UI에서 fine-grained PAT 발급 (repo: muder_platform, perms: Actions r/w + Administration w + Metadata r).
- [ ] **Step 3**: 사용자가 `cd infra/runners && cp .env.example .env` + 값 입력.
- [ ] **Step 4**: 사용자가 `cat .env` 결과 (PAT 마스킹) Claude에게 확인.
  - `DOCKER_GID` 값이 숫자(보통 `0` 또는 `1`)인지 검증. 빈 문자열이면 group_add silent fail.
  - `REPO_URL`이 `https://github.com/sabyunrepo/muder_platform`인지 (PR 머지 후 sabyunrepo).
- [ ] **Step 5**: PAT scope 검증 (boot 전 안전 확인):

  ```bash
  curl -sH "Authorization: Bearer $(grep ACCESS_TOKEN .env | cut -d= -f2)" \
    https://api.github.com/repos/sabyunrepo/muder_platform/actions/runners | jq '.total_count'
  ```
  Expected: 숫자(0 이상). `401`/`404`이면 PAT scope 또는 Resource owner 잘못 → 재발급.

---

## Task 7 — `docker compose up -d` + GH UI idle 검증

- [ ] **Step 1**: 부팅

```bash
cd infra/runners
docker compose up -d
```

Expected: 4 service `Created` → `Started`.

- [ ] **Step 2**: 헬스 + 등록 로그 확인 + 음성 확인

```bash
docker compose ps
docker compose logs runner-1 --tail 30 | grep -E "Listening for Jobs|Connected to GitHub"
# 음성 확인 (H-6 fix): docker.sock permission denied 또는 Token request failed 검사
docker compose logs runner-1 --tail 50 | grep -iE 'permission denied|token request failed' && echo "FAIL: DOCKER_GID 또는 PAT 문제" || echo "OK: 권한/토큰 정상"
```

Expected:
- 4 service `Up`
- "Listening for Jobs" match
- 음성 확인 결과: `OK: 권한/토큰 정상`

- [ ] **Step 3**: GH UI 검증

사용자가 https://github.com/sabyunrepo/muder_platform/settings/actions/runners 에서 4 row 확인:
- 이름: `containerized-runner-1`~`4`
- 상태: `Idle` (녹색)
- 라벨: `self-hosted, linux, containerized`

- [ ] **Step 4**: 5분 후 disconnect 없음 재확인.

> Task 7도 commit 없음 (검증만, 운영 액션).

---

## Task 8 — PR-1 생성 + 4-agent 리뷰 + admin-merge

- [ ] **Step 1**: push

```bash
git push -u origin feat/phase-22-runner-containerization
```

- [ ] **Step 2**: PR 생성

```bash
gh pr create --title "feat(phase-22): runner containerization W1 — infra/runners pool" --body "$(cat <<'EOF'
## Summary
- Phase 22 Wave 1: myoung34/github-runner 4 컨테이너 ephemeral pool 신규 (`infra/runners/`)
- spec `d954328` + W1 task commit
- 호스트 부팅 검증 완료 (4 idle on GH UI)

## Test plan
- [x] `docker compose config` 검증 (host bindmount 0건)
- [x] `docker compose up -d` → 4 service Up
- [x] `docker compose logs runner-1 | grep "Listening for Jobs"` match
- [x] GH UI에 4 row idle (containerized-runner-1~4)
- [ ] CI 12 job (admin-skip 정책 D-3, 2026-05-01 만료)

## 카논 ref
- Spec: `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md`
- Plan: `docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md`
- Predecessor: PR-164 (`dbe6a65`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3**: 4-agent 병렬 리뷰 (`/compound-review` 또는 manual Task tool dispatch)

분야: security (PAT scope + socket mount + named volume) / perf (mem_limit + image latest pinning) / arch (디렉토리 위치 + anchor merge 패턴) / test (검증 스크립트 + smoke workflow 후속 plan).

- [ ] **Step 4**: HIGH 0 확인 + IMPORTANT 인라인 fix.

- [ ] **Step 5**: admin-merge

```bash
gh pr merge --admin --squash
```

- [ ] **Step 6**: main pull + 다음 wave 진입 준비

```bash
git checkout main
git pull
```

---

## Wave 1 검증 (전체)

- [ ] Task 1~4 commit 1건 (Task 묶음)
- [ ] Task 5 검증 PASS (host bindmount 0건)
- [ ] Task 7 GH UI 4 row idle PASS
- [ ] Task 8 admin-merge 완료
- [ ] checklist.md W1 task 8건 모두 체크
- [ ] [`refs/wave-2-smoke-workflow.md`](wave-2-smoke-workflow.md) 진입 준비
