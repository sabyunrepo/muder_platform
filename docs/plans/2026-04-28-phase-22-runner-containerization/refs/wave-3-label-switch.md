# Wave 3 — Workflow 라벨 일괄 변경 (PR-3)

> Parent: [`../checklist.md`](../checklist.md) | Spec §6 W3

**Goal:** 모든 workflow의 `runs-on`을 `[self-hosted, containerized]`로 atomic switch + bash 3.2 의존 step을 `docker run --rm bash:3.2-alpine` 인라인으로 변환. half-state 회피를 위해 단일 PR로 일괄 처리.

**Depends:** W2 (PR-2) 머지 + smoke workflow 4 job green 확인 + 1일 이상 stable.

---

## Task 1 — 변경 대상 식별

- [ ] **Step 1**: workflow 파일 grep

```bash
grep -rn "runs-on:" .github/workflows/ | grep -v "node_modules"
```

Expected output: 8 파일 (예시, 실제는 grep 결과로 확인).

- [ ] **Step 2**: 변경 대상 목록 작성 (working memory에 보관)

| # | 파일 | 현재 `runs-on` | 변경 후 |
|---|------|---------------|--------|
| 1 | `ci.yml` | `self-hosted` | `[self-hosted, containerized]` |
| 2 | `e2e-stubbed.yml` | `self-hosted` | `[self-hosted, containerized]` |
| 3 | `security-fast.yml` | `self-hosted` | `[self-hosted, containerized]` |
| 4 | `security-deep.yml` | `self-hosted` | `[self-hosted, containerized]` |
| ... | (실제 grep 결과로 채움) | | |

> 주의: smoke workflow (`ci-containerized-smoke.yml`)는 이미 `[self-hosted, containerized]` → 변경 없음.

- [ ] **Step 3**: bash 3.2 의존 step 식별

```bash
grep -rn "bash --version\|/bin/bash\|BASH_VERSION" .github/workflows/
```

Expected: 0~3 hit. hit 있을 때만 Task 3 진행.

---

## Task 2 — workflow `runs-on` 일괄 변경

> **Edit tool 사용 권장** (sed보다 안전). 각 파일 수동 검토.

- [ ] **Step 1**: 각 workflow 파일 Edit

각 파일에서:
```yaml
# Before
runs-on: self-hosted

# After
runs-on: [self-hosted, containerized]
```

- [ ] **Step 2**: matrix/strategy 안의 `runs-on`도 동일 변경

```bash
grep -A 3 "matrix:" .github/workflows/*.yml | grep -B 1 "runs-on:"
```

발견 시 동일 패턴으로 변경.

- [ ] **Step 3**: 검증 — `runs-on: self-hosted$` 단독 0건 확인

```bash
grep -rn "runs-on: self-hosted$" .github/workflows/ && echo "REMAIN: 위 줄 변경 필요" || echo "OK: 모두 atomic switch"
```

Expected: `OK: 모두 atomic switch`.

- [ ] **Step 4**: stage + commit

```bash
git add .github/workflows/
git commit -m "$(cat <<'EOF'
feat(phase-22): atomic switch workflow runs-on to containerized pool (W3-Task 2)

모든 workflow runs-on: self-hosted → [self-hosted, containerized] 일괄 변경.
half-state 회피를 위해 단일 commit. 기존 host runner는 W4까지 fallback 가드로
유지 (deregister 안 함) — 회귀 시 라벨 매칭으로 자동 흡수.

대상 N 파일: ci.yml, e2e-stubbed.yml, security-fast.yml, security-deep.yml,
... (실제 변경 파일 목록 inline 명시)

Plan: docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — bash 3.2 step → `docker run` 인라인 변환

> Task 1 Step 3에서 발견된 hit 있을 때만. 0건이면 Task 3 skip.

- [ ] **Step 1**: 각 hit step Edit

기존 (예시):
```yaml
- name: Run bash 3.2 compat
  run: bash ./scripts/test-bash-3.2.sh
```

변환:
```yaml
- name: Run bash 3.2 compat (docker run inline — Phase 22)
  run: |
    docker run --rm \
      -v "$GITHUB_WORKSPACE":/work \
      -w /work \
      bash:3.2-alpine \
      sh -c 'bash --version | head -1; bash ./scripts/test-bash-3.2.sh'
```

- [ ] **Step 2**: 검증 — host bash 의존 0건

```bash
grep -rn "bash --version\|/bin/bash" .github/workflows/ | grep -v "docker run.*bash:" || echo "OK: host bash 의존 0건"
```

Expected: `OK: host bash 의존 0건`.

- [ ] **Step 3**: stage + commit (Task 2와 별도 commit으로 변경 추적 분리)

```bash
git add .github/workflows/
git commit -m "$(cat <<'EOF'
feat(phase-22): bash 3.2 step → docker run inline (W3-Task 3)

호스트 macOS bash 3.2 의존 제거. docker run --rm bash:3.2-alpine
인라인 step으로 변환 (composite action 미사용 — 사용처 N건 ≤ 2).

Plan: docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — PR-3 생성 + 12 job green 확인

- [ ] **Step 1**: push + PR 생성

```bash
git push
gh pr create --title "feat(phase-22): atomic switch all workflows to containerized pool" --body "$(cat <<'EOF'
## Summary
- Phase 22 W3: 모든 workflow runs-on → [self-hosted, containerized] 일괄 변경
- bash 3.2 host 의존 제거 (docker run inline N건)
- 기존 host runner는 W4까지 fallback 가드로 유지

## Test plan
- [ ] PR 자체 trigger로 12 job 모두 green (CI 4 + E2E 5 + Security Fast 2 + Security Deep 4 등)
- [ ] 각 job log에 runner 이름 (containerized-runner-N) 표기
- [ ] bash 3.2 step (해당 시) docker container에서 실행 확인
- [ ] 회귀 없음 — fail rate 비교 baseline (PR-164 머지 시점) 이하

## Migration safety
- W4까지 host runner 유지 → 회귀 시 라벨 매칭으로 자동 fallback
- W4는 main 머지 후 7일 stable 관측 후 별도 운영 노트로 진행

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2**: 12 job green 확인

```bash
gh pr checks <pr-number>
```

Expected: 모든 check `success`.

- [ ] **Step 3**: 각 job runner 이름 분포 확인

```bash
gh run view <run-id> --log | grep -oE "containerized-runner-[1-4]" | sort | uniq -c
```

Expected: 4 runner 중 다수 사용 (분산 처리 확인).

---

## Task 5 — 4-agent 리뷰 + admin-merge

- [ ] **Step 1**: 4-agent 병렬 리뷰

분야:
- **security**: workflow secret 노출 변화 (containerized 라벨로 인한 secret 접근 정책 영향), bash 3.2 step의 마운트 scope
- **perf**: 12 job 평균 wall clock 변화 (host runner 대비 30%+ 느려짐 시 ARM image 검토 flag)
- **arch**: 라벨 통일성 (모든 workflow [self-hosted, containerized] 일관), atomic switch 완성도
- **test**: 12 job coverage 회귀 가드, fail rate 측정 baseline 명확성

- [ ] **Step 2**: HIGH 0 확인 + IMPORTANT 인라인 fix.

- [ ] **Step 3**: admin-merge (admin-skip 정책 확인)

```bash
# 2026-05-01 전이면 admin-skip 가능
gh pr merge --admin --squash

# 2026-05-01 이후이면 정식 CI green 대기 후
gh pr merge --squash
```

- [ ] **Step 4**: main pull

```bash
git checkout main
git pull
```

---

## Task 6 — 7일 stable 관측 (백그라운드)

> 본 task는 다음 phase 진입을 차단하지 않음. 백그라운드 모니터링.

- [ ] **Step 1**: 매일 1회 fail rate 확인

```bash
gh run list --branch main --limit 50 --json conclusion --jq '[.[] | select(.conclusion=="failure")] | length'
```

baseline 비교 (PR-164 머지 시점 7일 fail count) — 변동 ±10% 이내면 stable.

- [ ] **Step 2**: 7일 stable 확인 시 W4 진입 (`refs/wave-4-decommission.md`).

- [ ] **Step 3**: 7일 안에 회귀 발견 시
  1. 회귀 PR revert
  2. host runner가 자동 흡수 (라벨 `self-hosted` 단독 매칭) 확인
  3. 원인 분석 후 W3 hotfix PR

---

## Wave 3 검증 (전체)

- [ ] Task 2 + Task 3 commit 2건 (라벨 변경 + bash 3.2 분리)
- [ ] PR-3 자체 12 job green
- [ ] 4 runner 분산 처리 검증 (uniq -c 결과)
- [ ] admin-merge 완료
- [ ] 7일 stable 관측 (백그라운드, W4 진입 조건)
