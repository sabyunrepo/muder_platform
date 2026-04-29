# Murder Mystery Platform (MMP v3)

다중 테마 실시간 멀티플레이어 머더미스터리 게임 플랫폼. Go 백엔드 + React SPA + Postgres/Redis.

> **글로벌 override**: `~/.claude/CLAUDE.md`의 "Seed Design 3단계" 규칙은 이 프로젝트에 **적용되지 않음** (Tailwind 4 직접 사용).

## 카논 위치 (1룰 1 master)

- 코딩 작업 수행 규율 (구현 전 사고 → 단순함 → 외과적 변경 → 목표 검증) → `memory/feedback_coding_discipline.md`
- 파일/함수 크기 한도 → `memory/feedback_file_size_limit.md`
- Git 워크플로우 (main 보호 + PR 필수) → `memory/feedback_branch_pr_workflow.md`
- QMD 사용 (docs/plans, memory 경로) → `.claude/refs/qmd-rules.md`
- graphify (의존성·아키텍처) → `.claude/refs/graphify.md`
- Opus ↔ Sonnet 위임 → `.claude/refs/opus-delegation.md`
- 모듈 시스템 (PlayerAware 게이트) → `memory/project_module_system.md`
- Go 코드 룰 → `apps/server/CLAUDE.md`
- React 코드 룰 → `apps/web/CLAUDE.md`

## 메타 룰 (이 파일에만)

- `@import` 금지 — sub CLAUDE.md를 `@`로 import 시 nested lazy-load 효과 0
- MEMORY canonical = repo `memory/` (user home 경로는 archival)
- 진행 중 plan은 `docs/plans/<phase>/checklist.md` 직접 read + git branch로 추적 (workflow 자동화 폐기 2026-04-27)
