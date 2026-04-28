# Task 7+8+9 — Push, Review, Merge

## Task 7: push & 13 검사 CI green 검증

**Files:** (push only)

**근거:** spec 핵심 검증. main과 동일 환경 self-hosted runner에서 13 검사 모두 green 떠야 admin-skip 만료 가능.

- [ ] **Step 7.1: branch push**

Run:
```bash
git push -u origin fix/ci-infra-recovery
```
Expected: GitHub branch 생성 + workflow 자동 트리거.

- [ ] **Step 7.2: PR 생성**

Run:
```bash
gh pr create --title "fix(ci-infra): runner orphan + postgres port collision 정상화" --body "$(cat <<'EOF'
## Summary
- self-hosted runner CI 12 job fail 정상화 (EACCES + postgres 5432 collision)
- Spec: docs/superpowers/specs/2026-04-28-ci-infra-recovery-design.md
- Plan: docs/plans/2026-04-28-ci-infra-recovery/checklist.md

## Root Cause
1. `docker-compose.dev.yml` + `Dockerfile.dev`가 root 사용자로 컨테이너 실행 → `apps/server/tmp/*` 호스트 bindmount 파일이 root 소유 → CI runner checkout cleanup EACCES
2. CI workflow service container의 `5432:5432` / `6379:6379` 고정 host port → 같은 self-hosted runner 호스트의 병렬 job 충돌

## Fix
- `Dockerfile.dev` ARG USER_UID/USER_GID + appuser non-root user
- `docker-compose.dev.yml` build.args + runtime user 두 단계 UID 주입
- `ci.yml` + `e2e-stubbed.yml` ephemeral port + `\${{ job.services.X.ports['Y'] }}` 템플릿
- `e2e-stubbed.yml` goose 연결 문자열 + psql -p 플래그
- `apps/server/CLAUDE.md` dev 시작 명령 카논

## Pre-flight (사용자 수행 완료)
- [x] runner host orphan 청소 (`sudo rm -rf .../apps/server/tmp/*`, 2026-04-28)
- [ ] PR 머지 후 1회 dev rebuild

## Test plan
- [ ] 로컬 dev compose 회귀 PASS (air hot-reload + 호스트 user owner)
- [ ] 13 검사 CI green
- [ ] 4-agent 리뷰 (security/perf/arch/test)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 7.3: 13 검사 결과 폴링**

Run (수동):
```bash
gh pr checks
```

**기대 검사 13건** (모두 ✅):
- CI / Go Lint + Test
- CI / TypeScript Lint + Test + Build
- CI / Coverage Regression Guard (needs go+ts → 자동)
- CI / Docker Build Check (needs go+ts → 자동)
- E2E — Stubbed Backend / chromium shard 1
- E2E — Stubbed Backend / chromium shard 2
- E2E — Stubbed Backend / firefox shard 1
- E2E — Stubbed Backend / firefox shard 2
- E2E — Stubbed Backend / Merge Playwright reports
- Security — Fast Feedback / govulncheck
- Security — Fast Feedback / gitleaks
- Security — Deep Scan / osv-scanner
- Security — Deep Scan / CodeQL javascript-typescript
- Security — Deep Scan / CodeQL go
- Security — Deep Scan / Trivy

(Phase 18.1 nightly는 무관 — 이미 success.)

admin-skip 정책상 모두 green 아니어도 머지 가능하나, **이 PR은 정확히 모두 green 떠야 의미** — 1건이라도 fail이면 root cause 미해결로 간주, 추가 조사 필요.

- [ ] **Step 7.4: 일부 fail 시 분기**

| 증상 | 원인 후보 | 대응 |
|---|---|---|
| EACCES 다시 발생 | runner host에 다른 orphan (예: `node_modules/.cache`) | 추가 청소 또는 workflow에 broader cleanup step |
| postgres 충돌 잔존 | Mac dev compose가 같은 host 5432 점유 | dev down 후 재push, 또는 dev 머신 분리 결정 |
| goose connection refused | ephemeral port가 healthcheck 전 templated | `goose` step 직전 `pg_isready` wait 추가 |
| psql -p 인식 안됨 | psql 버전/libpq path 이슈 | 후속 PR로 `psql --version` 디버그 step |

각 분기는 **별도 commit**으로 fix → push → 재검증.

---

## Task 8: 4-agent 병렬 리뷰

**Files:** (리뷰 only — 발견 시 수정 commit 추가)

**근거:** `memory/feedback_4agent_review_before_admin_merge.md` 카논. PR-2c (#107) 사고 (handleCombine deadlock 누락) 재현 방지. compound-mmp `/compound-review` SKILL 진입.

- [ ] **Step 8.1: compound-review 호출**

다음으로 4 agent 병렬 spawn (security-reviewer / code-reviewer / architect / test-engineer, 모두 sonnet-4-6):
```
/compound-review fix/ci-infra-recovery
```
Expected: `docs/plans/2026-04-28-ci-infra-recovery/refs/reviews/PR-1.md` 생성. HIGH/MEDIUM/LOW 분류.

- [ ] **Step 8.2: HIGH 발견 시 in-PR fix**

HIGH 1건 이상이면:
1. 메인 컨텍스트가 문제 분석 + fix 결정
2. fix commit 추가
3. push → 같은 PR (force-push 아님, 추가 commit) → 13 검사 재검증
4. round-2 4-agent 재호출 → 모두 RESOLVED 확인

(Wave 4 PR-10 관례에 따라 round-N 패턴 — 신규 발견 시 round-3, round-4까지 가능.)

- [ ] **Step 8.3: 리뷰 보고서 commit (있으면)**

리뷰 결과 파일 git tracked면:
```bash
git add docs/plans/2026-04-28-ci-infra-recovery/refs/reviews/PR-1.md
git commit -m "docs(ci-infra): 4-agent review report PR-1"
```

---

## Task 9: admin-merge

**Files:** (머지 only)

**근거:** `memory/project_ci_admin_skip_until_2026-05-01.md` — 2026-05-01 만료 정책. 본 PR은 **정책 만료 전** 머지 + 사실상 13 검사 모두 green 도달 보장.

- [ ] **Step 9.1: 4-agent HIGH 0 + 13 검사 green 최종 확인**

```bash
gh pr checks
```

- [ ] **Step 9.2: admin merge**

Run:
```bash
gh pr merge --admin --squash --delete-branch
```
Expected: main에 squash commit + branch 자동 삭제.

- [ ] **Step 9.3: main 동기화 + 사용자 dev rebuild 안내**

Run:
```bash
git checkout main
git pull
echo "✅ Merged. 다음 dev 시작 시 1회 --build 추가:"
echo "   HOST_UID=\$(id -u) HOST_GID=\$(id -g) docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build"
```

- [ ] **Step 9.4: TaskList #1 완료 마킹**

Tool: `TaskUpdate {"taskId":"1","status":"completed"}`. P2 (PR-11 hygiene) 자동 unblock.

`/compound-resume` 또는 `/compound-cycle`로 다음 단계 진입.
