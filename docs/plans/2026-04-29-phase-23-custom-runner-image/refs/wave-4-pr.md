# Wave 4 — Code Review + PR

> 부모: [checklist.md](../checklist.md) | 이전: [Wave 3](wave-3-workflow-cleanup.md) | 다음: [Wave 5](wave-5-operational.md)

## Task 10: 로컬 docker build 종합 검증 (선택)

선택 task — Wave 1 Task 2 step 2-4에서 이미 docker build + verify 수행 가능. **GHA cache로 PR CI에 위임도 가능**. 사용자 dev (Apple Silicon)에서 amd64 빌드 시 emulation 느림이라 PR CI 위임 권장.

- [ ] **Step 1: PR CI 위임 결정 또는 로컬 buildx로 amd64 emulation 빌드**

선택 사항. PR CI가 self-hosted [containerized] runner에서 native amd64 빌드 → 빠르고 정확.

---

## Task 11: spec + plan first commit + branch push

- [ ] **Step 1: 모든 task별 commit 확인**

```bash
git log --oneline main..HEAD
# Expected: Wave 1-3의 task별 commit ~7건 (Task 1, 2, 3, 4, 5, 6, 7, 8, 9)
```

- [ ] **Step 2: spec/plan 파일을 worktree에 stage**

Wave 0 Task 0에서 untracked 상태로 인계된 spec/plan을 commit:

```bash
git add docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md
git add docs/plans/2026-04-29-phase-23-custom-runner-image/
git commit -m "docs(phase-23): spec + plan checklist (brainstorm + writing-plans 산출)"
```

- [ ] **Step 3: branch push (PR 미생성)**

```bash
git push -u origin chore/phase-23-custom-runner-image
```

PR 생성은 Task 13에서 진행 — push만으로는 build-runner-image.yml CI가 자동 트리거되지 않음 (path filter는 PR/push event에서만 활성).

---

## Task 12: superpowers:requesting-code-review

사용자 명시 결정: 4-agent 우회, superpowers code-review만.

- [ ] **Step 1: Skill `superpowers:requesting-code-review` 호출**

review brief 인자:
- branch: `chore/phase-23-custom-runner-image`
- scope: Custom Image PR (Dockerfile + hook + workflow + compose + README + 9 workflow 정리)
- focus:
  - 보안 표면 (multi-stage builder의 install tool 분리)
  - GHCR push 권한 (GITHUB_TOKEN + `permissions: packages: write`만)
  - EPHEMERAL fs cleanup hook 동작 가설 검증 (옵션 C — CI build verify step에 통합)
  - 9 workflow dead code 정리의 정확성 (잔존 우회 step 누락 없는지)
- decisions to challenge:
  - 사용자가 4-agent 리뷰 우회 결정 (이 review가 단일 안전망)
  - admin-skip 머지로 운영 시간차 위험 mitigation
  - mega PR (single-concern 카논 위반의 사용자 명시 override)

- [ ] **Step 2: review 결과 검토 + 사용자 결정**

review가 변경 요청 → fix or fold-in 결정. 변경 없음 → 다음 task.

- [ ] **Step 3: review fix가 있으면 추가 commit + push**

```bash
git add <fix files>
git commit -m "fix(phase-23): code review fold-in <항목>"
git push
```

---

## Task 13: PR 생성 + admin-skip 머지 게이트

- [ ] **Step 1: PR 생성**

```bash
gh pr create \
  --title "feat(phase-23): Custom Runner Image (multi-stage + 9 workflow 정리)" \
  --body "$(cat <<'EOF'
## Summary
- Custom Runner Image (`ghcr.io/sabyunrepo/mmp-runner`) multi-stage Dockerfile (builder=ubuntu:22.04 + final=myoung34 base)
- `ACTIONS_RUNNER_HOOK_JOB_STARTED` cleanup hook script (EPHEMERAL fs 잔존 정공)
- GHCR build CI (`.github/workflows/build-runner-image.yml`, Public visibility, GITHUB_TOKEN)
- docker-compose image + pull_policy 변경
- 9 workflow dead code 정리 (sudo go test, ownership step, jq install, setup-node symlink, manual sudo docker build)
- Trivy image cleanup 1줄 (Sec-MED-3 #2 fold-in)
- gitleaks artifact upload 복원 (Sec-MED-2 #3 fold-in, verify는 다음 CI run)

## Test plan
- [x] cleanup hook bash unit test PASS (Wave 1 Task 1)
- [x] Dockerfile multi-stage build syntax check PASS (Wave 1 Task 2 또는 PR CI 위임)
- [x] PR build-runner-image.yml CI verify PASS (cleanup hook fire assertion 통과)
- [ ] 머지 후 GHCR push 성공 확인 (Wave 5 Task 14)
- [ ] 사용자 host 재배포 후 4 runner idle (Wave 5 Task 15)
- [ ] 첫 실 CI run cleanup hook fire + tar 충돌 0건 (Wave 5 Task 16)
- [ ] gitleaks artifact upload 동작 확인 (Wave 5 Task 16, fail 시 hotfix + #3 follow-up)
- [ ] PR-5 (#172) 자동 unblock + 머지 (Wave 5 Task 17)

## Refs
- Spec: `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md`
- Plan: `docs/plans/2026-04-29-phase-23-custom-runner-image/checklist.md`
- 부모: Phase 22 W1.5 plan (carry-over Sec-MED-2/3, DEBT-2/3/4 자연 해소)
- 핸드오프: `memory/sessions/2026-04-29-phase-23-custom-image-pivot.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: PR build-runner-image.yml CI verify 통과 확인**

```bash
gh pr checks
# Expected: build-runner-image.yml job SUCCESS (cleanup hook fire assertion 통과)
```

verify fail 시 → hook script 또는 Dockerfile fix → push → 재시도. **이 verify가 옵션 C 카논의 핵심 안전망**.

- [ ] **Step 3: 사용자 결정 — admin-skip 머지 시점**

`active CI 0건 확인` 후:
```bash
# active CI run 조회
gh run list --status in_progress --limit 5
# 0건이면 머지
gh pr merge <PR#> --admin --squash --delete-branch
```

머지 직후 즉시 사용자 host SSH 재배포 (Wave 5 진입). 머지 → 재배포 사이 새 CI run 발생 시 9 workflow 정리된 step이 옛 base image runner로 fail 가능 — admin-skip 정책으로 통과.
