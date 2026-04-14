# Active Plan Workflow (plan-autopilot) — 상세

이 프로젝트는 `plan-autopilot` 스킬로 phase 기반 개발을 관리합니다.
- 스킬: `~/.claude/skills/plan-autopilot/SKILL.md`
- 활성 plan 포인터: `.claude/active-plan.json` (없으면 hook no-op)

## 현재 활성 plan
**Phase 10.0 완료 — QA Bugfix Sprint** (커밋 dfbc340)
- 다음 Phase 미결정 — `/plan-new <topic>`으로 새 phase 시작
- 이전 설계: `docs/plans/2026-04-05-rebuild/checklist.md`

## 자동 hooks (사용자 개입 0)
- SessionStart: STATUS + next task 주입 (~30줄)
- UserPromptSubmit: 1줄 STATUS 주입 (~25 토큰)
- PreToolUse (Edit/Write): **scope 내 파일은 design/checklist 읽기 전 BLOCK**
- PostToolUse: checklist 갱신 reminder

## Phase 경계 (드물게, phase당 2번)
- `/plan-start <dir>` — 새 plan 활성화
- `/plan-finish` — 완료 archive

## 실행 명령어
- `/plan-new <topic>` — brainstorming + writing-plans + 템플릿 저작
- `/plan-autopilot` — wave 기반 자동 실행
- `/plan-status`, `/plan-tasks` — 진행 상태
- `/plan-resume` — `/clear` 후 컨텍스트 복원
- `/plan-stop` — 실행 중단 (state 저장)

## 필수 규칙
- **모든 .md 파일 <200줄** (초과 시 `refs/` 분할 + index 패턴)
- **STATUS 마커 형식 유지** (hook 파싱)
- **Wave 병렬 PR은 `isolation: "worktree"`**
- **Review는 4 병렬 agent** (security/perf/arch/test-coverage)
- **Fix-loop 최대 3회** → 초과 시 user 개입
- **Wave 머지 전 user 확인 1회**
- **Feature flag default off** 로 in-flight wiring 보호
