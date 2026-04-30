# Murder Mystery Platform (MMP v3)

다중 테마 실시간 멀티플레이어 머더미스터리 게임 플랫폼. Go 백엔드 + React SPA + Postgres/Redis.

> 글로벌 override: `~/.claude/CLAUDE.md` 의 "Seed Design 3단계" 규칙은 이 프로젝트에 **적용되지 않음** (Tailwind 4 직접 사용).

# 카논 위치 (1룰 1 master)

> 각 룰은 단 하나의 master 파일에서만 정의. 다른 곳은 pointer.

## 이 파일이 master (메타 룰)

- `@import` 금지 — sub CLAUDE.md를 `@`로 import 시 nested lazy-load 효과 0
- MEMORY canonical = repo `memory/` (user home 경로는 archival)
- 진행 중 plan 추적 = `docs/plans/<phase>/checklist.md` 직접 read + git branch (workflow 자동화 폐기 2026-04-27)
- 충돌 시 우선순위: 이 파일 / 하위 `apps/*/CLAUDE.md` > 글로벌 `~/.claude/CLAUDE.md`

## 코드/워크플로우 카논 (`memory/`)

| 룰 | master |
|----|--------|
| 코딩 작업 규율 (구현 전 사고 · 단순함 · 외과적 변경 · 목표 검증) | `memory/feedback_coding_discipline.md` |
| 파일/함수 크기 티어 (Go 500 / TS·TSX 400 / MD 500 / CLAUDE.md 200) | `memory/feedback_file_size_limit.md` |
| Git 워크플로우 (main 보호 + PR 필수, 15 status check) | `memory/feedback_branch_pr_workflow.md` |
| 4-agent 리뷰 정책 (admin-merge 전 필수) | `memory/feedback_4agent_review_before_admin_merge.md` |
| 메모리 canonical 룰 (repo `memory/` 단일 source) | `memory/feedback_memory_canonical_repo.md` |
| Opus 헤드쿼터 / Sonnet/Haiku 위임 | `memory/feedback_opus_headquarter.md` (+ `feedback_sonnet_46_default.md`) |
| 사용자 설명 형식 (원인 / 결과 / 권장) | `memory/feedback_explanation_style.md` |
| 작업 루틴 강제 (시작 시 QMD 컨텍스트 로드) | `memory/feedback_work_routine.md` |
| graphify 우선 (아키텍처·의존성 질문) | `memory/feedback_graphify_first.md` |
| 코드 리뷰 패턴 (Go/React/DB/보안/PWA/오디오 통합) | `memory/feedback_code_review_patterns.md` |
| 마이그레이션 워크플로우 (6전문가 토론 → 승인 → 구현 → 리뷰 → QA) | `memory/feedback_migration_workflow.md` |
| WS 토큰 쿼리 파라미터 (`?token=`) | `memory/feedback_ws_token_query.md` |
| 모듈 시스템 (PlayerAware 게이트) | `memory/project_module_system.md` |
| 에러 처리 체계 (AppError + RFC 9457 + ErrorBoundary 3계층) | `memory/project_error_system.md` |
| 코딩 규칙 (Go/React 계층 · DI · 상태 · 테스트) | `memory/project_coding_rules.md` |
| graphify refresh 정책 (Phase 종료 시점만) | `memory/project_graphify_refresh_policy.md` |

> 전체 인덱스: `memory/MEMORY.md` — 활성 Phase, 도메인 카논, Phase Archive 일람.

## 도구 사용 카논 (`.claude/refs/`)

| 룰 | master |
|----|--------|
| QMD 사용 (docs/plans, memory 검색 — Grep 금지, QMD 우선) | `.claude/refs/qmd-rules.md` |
| graphify (의존성·아키텍처 분석) | `.claude/refs/graphify.md` |
| Opus ↔ Sonnet 위임 상세 | `.claude/refs/opus-delegation.md` |

## 하위 패키지 카논

- Go 백엔드 룰 → `apps/server/CLAUDE.md`
- React 프론트엔드 룰 → `apps/web/CLAUDE.md`
