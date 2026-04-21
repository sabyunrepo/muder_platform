---
name: main 직접 push 금지 · feature branch + PR 필수
description: MMP v3 레포는 branch protection이 걸려있어 모든 변경은 feature branch + PR을 거쳐야 한다. bypass 사용 금지. 문서·계획·설정 포함 예외 없음.
type: feedback
---
# main 직접 push 금지 · feature branch + PR 필수

**규칙**: MMP v3 레포(`sabyunrepo/muder_platform`)의 모든 변경은 **feature 브랜치 + PR**을 거쳐야 한다. `git push origin main` 직접 실행 금지. 사용자가 명시적으로 "bypass 해라"라고 지시할 때만 예외.

**Why:** 2026-04-17 Phase 19 shadow plan(커밋 `d1262a7`)을 main에 직접 push했을 때 GitHub가 `Bypassed rule violations: Changes must be made through a pull request. 15 of 15 required status checks are expected` 경고를 반환했다. Claude 계정이 bypass 권한을 가져 push 자체는 통과했지만 사용자가 "다음부터는 별도 브랜치 + PR"로 진행하라고 명시 지시했다. 문서·계획·설정 변경이라도 예외 없다(Phase 19 감사 자료, CLAUDE.md 규칙 업데이트, memory 편집 포함).

**How to apply:**
1. 작업 시작 전 `git checkout -b <type>/<scope>-<slug>` (type: feat/fix/docs/chore/test/ci/perf, Conventional Commits prefix)
2. 커밋은 `<type>(<scope>): <한글 요약>` + Co-Authored-By 풋터 유지
3. `git push -u origin <branch>` 로 푸시
4. PR 생성 **전에 사용자에게 브랜치·커밋 범위 확인 요청**
5. 승인 후 `gh pr create` — body는 `## Summary` + `## Test plan`
6. status check 15/15 통과 확인 → 사용자 승인 → `gh pr merge --squash` (또는 지정 방식)
7. 실수로 main에 직접 커밋했다면 즉시 보고 + revert + PR 재작업 여부 확인. 임의 수습 금지.

**스테이징 제외 고정 목록** (runtime artifact, 절대 커밋하지 말 것):
- `.claude/active-plan.json`, `.claude/run-lock.json`
- `.claude/runs/**`, `.claude/plans/**`

**프로젝트 CLAUDE.md**에도 같은 규칙을 "🔴 Git 워크플로우" 섹션으로 포함했다(2026-04-17).
