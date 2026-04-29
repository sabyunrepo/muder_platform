# Wave 0 — Worktree 분기

> 부모: [checklist.md](../checklist.md) | 다음: [Wave 1](wave-1-image-build.md)

## Task 0: 분기 + spec/plan untracked 인계

**Files:**
- Untracked: `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md`
- Untracked: `docs/plans/2026-04-29-phase-23-custom-runner-image/checklist.md`
- Untracked: `docs/plans/2026-04-29-phase-23-custom-runner-image/refs/wave-{0..5}-*.md`

- [ ] **Step 1: superpowers:using-git-worktrees 호출**

```
branch: chore/phase-23-custom-runner-image
base: main
location: ../muder_platform.wt/phase-23-custom-runner-image
```

untracked 파일은 worktree에서 access 가능 (git worktree 특성 — index와 working tree 분리, untracked는 working tree 공유).

- [ ] **Step 2: worktree로 이동 + 상태 확인**

```bash
cd ../muder_platform.wt/phase-23-custom-runner-image
git status --short
# Expected:
#   ?? docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md
#   ?? docs/plans/2026-04-29-phase-23-custom-runner-image/
```

> spec/plan 첫 commit은 Wave 4 Task 11에서 wave 1-3의 task별 commit과 함께 진행. 본 task에서는 stage 없음.
