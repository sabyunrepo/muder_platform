---
name: plan-autopilot 운영 함정
description: plan-autopilot 스킬 사용 시 자주 만나는 schema/워크플로우 실수와 회피법
type: feedback
---

## 1. PR status 필드는 `"completed"`만 인식

`.claude/active-plan.json`의 `prs.PR-N.status`는 `plan-wave.sh check-deps`가 `"completed"`로 정확히 매칭. `"done"` / `"merged"` / `"closed"` 등 직관적 단어는 전부 dep 체크 실패.

**Why**: `~/.claude/skills/plan-autopilot/scripts/plan-wave.sh:122` → `if [ "$STATUS" != "completed" ]`. 2026-04-08 PR-0 closeout에서 `"done"`으로 작성했다가 W1 dep 체크가 실패해 hotfix PR(#15)로 수정했음.

**How to apply**: PR 머지 후 state 갱신 시 항상 `"completed"`. 다른 단어 절대 금지. PR 정의 생성 시 초기 상태는 `"pending"`, 작업 중은 `"in_progress"`.

---

## 2. 워크트리가 잡고 있는 브랜치는 `gh pr merge --delete-branch` 실패

병렬 wave에서 sub-agent에 `isolation: "worktree"`로 작업시키면 워크트리가 해당 브랜치를 점유. 이 상태에서 `gh pr merge --delete-branch`를 호출하면 머지는 성공하지만 로컬 브랜치 삭제가 다음 메시지로 실패:
```
failed to delete local branch <branch>: cannot delete branch '<branch>' used by worktree at '<path>'
```

**Why**: gh CLI는 머지 직후 로컬 cleanup 시도. git은 워크트리가 checkout 중인 브랜치 삭제를 거부 (정상 동작).

**How to apply**: 머지 직전에 `git worktree remove --force <worktree-path>` → `gh pr merge ... --delete-branch` 순서로 호출. 또는 머지 후 워크트리 정리하고 `git branch -D` 별도 실행.

---

## 3. PR-0가 여러 PR로 나뉘어 머지된 경우 state 파일 stale

설계 PR-0를 한 번에 머지하지 않고 나중에 hotfix follow-up PR을 추가 머지하면 active-plan.json의 PR-0 entry가 첫 머지 이후 stale 상태. 새 세션에서 자동 동기화 안 됨.

**How to apply**: PR-0 같은 인프라 PR은 follow-up 머지 시마다 `merged_via_pr` 배열에 PR 번호 추가하고, 모든 작업이 끝났을 때만 `status: "completed"`로 전환. 중간 상태는 `"in_progress"` 유지.

---

## 4. wave gate 직전 dry-run 머지 검증이 효과적

병렬 wave (W1/W4)는 sub-agent가 각자 worktree에서 작업하므로 통합 충돌이 머지 시점에야 드러남. 실제 머지 전에 임시 브랜치(`test/wN-merge-dry-run`)에서 PR들을 순차 머지 후 `go build + go test -race` 통과 확인.

**Why**: 2026-04-08 W1에서 dry-run으로 PR-1+PR-2 통합 검증 → 실제 머지 시 문제 0. 비용 30초 미만, 발견 가치는 큼.

**How to apply**: 모든 병렬 wave에서 wave gate 직전 dry-run 머지 단계 추가. 통과 후 dry-run 브랜치 삭제 → 실제 PR 순차 머지.
