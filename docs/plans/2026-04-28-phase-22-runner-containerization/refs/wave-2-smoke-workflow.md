# Wave 2 — Smoke Workflow (PR-2)

> Parent: [`../checklist.md`](../checklist.md) | Spec §6 W2

**Goal:** W3 atomic switch 전 안전 가드. 신규 workflow 1개를 `runs-on: [self-hosted, containerized]`로 추가해 4 컨테이너 runner pool에서 hello-world + go test + ts test + bash 3.2 step이 모두 동작하는지 검증.

**Depends:** W1 (PR-1) 머지 완료 (4 runner idle).

---

## Task 1 — `ci-containerized-smoke.yml` 작성

**Files:**
- Create: `.github/workflows/ci-containerized-smoke.yml`

- [ ] **Step 1**: workflow 작성

```yaml
# .github/workflows/ci-containerized-smoke.yml
# Phase 22 W2 — containerized runner pool smoke test
# 목적: W3 atomic switch 전 4 runner pool이 hello/go/ts/bash 3.2 모두 처리 가능 검증

name: Containerized Smoke

on:
  pull_request:
    paths:
      - '.github/workflows/ci-containerized-smoke.yml'
      - 'infra/runners/**'
  workflow_dispatch:

jobs:
  hello-world:
    runs-on: [self-hosted, containerized]
    steps:
      - name: Echo runner identity
        run: |
          echo "Runner: $RUNNER_NAME"
          echo "Labels: $RUNNER_LABELS"
          uname -a
          docker --version

  go-build:
    runs-on: [self-hosted, containerized]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.25'
      - name: Build apps/server
        working-directory: apps/server
        run: |
          go build ./...
          go test -count=1 -short ./internal/... 2>&1 | tail -20

  ts-build:
    runs-on: [self-hosted, containerized]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - name: Install + typecheck
        working-directory: apps/web
        run: |
          pnpm install --frozen-lockfile
          pnpm typecheck

  bash-3.2-test:
    runs-on: [self-hosted, containerized]
    steps:
      - uses: actions/checkout@v4
      - name: Run bash 3.2 compat test (docker run inline)
        run: |
          docker run --rm \
            -v "$GITHUB_WORKSPACE":/work \
            -w /work \
            bash:3.2-alpine \
            sh -c 'echo "bash version: $(bash --version | head -1)"; bash --version | grep -q "3.2"'
```

- [ ] **Step 2**: stage + commit

```bash
git add .github/workflows/ci-containerized-smoke.yml
git commit -m "$(cat <<'EOF'
feat(phase-22): smoke workflow for containerized runner pool (W2-Task 1)

W3 atomic switch 전 안전 가드. 4 runner pool에서 hello-world,
go-build (apps/server build + short test), ts-build (apps/web
typecheck), bash 3.2 docker run inline 4 job 검증.

Plan: docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — PR-2 생성 + smoke 실행 검증

- [ ] **Step 1**: push + PR 생성

```bash
git push
gh pr create --title "feat(phase-22): smoke workflow on containerized runners" --body "$(cat <<'EOF'
## Summary
- Phase 22 W2 신규 workflow `ci-containerized-smoke.yml`
- 4 job (hello / go-build / ts-build / bash-3.2-test) 모두 `runs-on: [self-hosted, containerized]`
- W3 atomic switch 전 안전 가드

## Test plan
- [ ] PR 자체 trigger로 4 job green
- [ ] 각 job log에 runner 이름 (containerized-runner-N) 표기
- [ ] bash 3.2 step에서 \`bash --version\`이 \`3.2.x\` 출력
- [ ] go-build에서 \`apps/server\` build + short test pass
- [ ] ts-build에서 \`apps/web\` typecheck pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2**: GH UI에서 workflow run 진입 → 4 job 모두 green 확인.

- [ ] **Step 3**: 각 job 로그에서 runner 이름 추출

```bash
gh run view <run-id> --log | grep -E "Runner: containerized-runner-[1-4]"
```

Expected: 4 job × 1 line, 4 runner 중 일부 또는 전부 사용.

- [ ] **Step 4**: bash 3.2 step 검증

```bash
gh run view <run-id> --log | grep "bash version: GNU bash, version 3.2"
```

Expected: 1 line match.

---

## Task 3 — 4-agent 리뷰 + admin-merge

- [ ] **Step 1**: 4-agent 병렬 리뷰

분야:
- **security**: workflow trigger paths, runner 라벨 노출, docker run scope
- **perf**: pnpm install latency on containerized runner (caching), go test wall clock 비교
- **arch**: smoke workflow vs 기존 ci.yml 중복도 (W3에서 통합되거나 유지)
- **test**: 4 job coverage 충분성, 실패 시 어느 단계가 회귀 가드인지 명확성

- [ ] **Step 2**: HIGH 0 확인 + IMPORTANT 인라인 fix.

- [ ] **Step 3**: admin-merge

```bash
gh pr merge --admin --squash
```

- [ ] **Step 4**: main pull

```bash
git checkout main
git pull
```

---

## Wave 2 검증 (전체)

- [ ] PR-2 머지 완료 (1 commit on main)
- [ ] smoke workflow 4/4 green
- [ ] 4 runner 모두 최소 1회 hello-world 처리 (분산 검증) — `gh run list --workflow=ci-containerized-smoke.yml --limit 5` 확인 후 runner 이름 분포 확인
- [ ] Wave 3 진입 준비 (`refs/wave-3-label-switch.md`)

---

## 회귀 시 fallback

- smoke 실패 → W3 차단. PR-2 revert + 원인 분석 (어느 step? 어느 runner? 어떤 에러?).
- 단일 runner crash → `docker compose restart runner-N` (다른 3 runner는 처리 계속).
- 모든 runner crash → `docker compose down && docker compose up -d` + GH UI 재등록 확인.
