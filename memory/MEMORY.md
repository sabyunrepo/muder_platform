## 프로젝트 정보
- [MMP v3 프로젝트 개요](project_overview.md) — Go+React 머더미스터리 v3, 기술 스택과 아키텍처
- [Phase 체크리스트 (전체 일람)](project_phases.md) — Phase 0~17.0 완료 인덱스
- [완료 Phase Archive](#완료-phase-archive) — Phase 7.7~20 progress·plan 파일 일람 (본 파일 하단)

## 활성 Phase
- [Phase 19 Residual](project_phase19_residual_progress.md) — **진행 중** W0~W3 완료, **W4만 잔존** (PR-9 WS Auth Protocol + PR-10 Runtime Payload Validation, L+L 규모). 다음 작업

## Backlog
- [Phase 21 backlog](project_phase21_backlog.md) — Phase 19 audit log orphan action 7건. 에디터 리팩터 잔존 3건: E-3/E-5(Phase 24 후보, brainstorm 필수) + E-9(인프라 file-size-guard glob 정정, S). E-7/E-8/E-10/E-11/E-12는 Resolved 2026-05-01 (PR #189/#191). Phase 23 인프라 follow-ups 5건은 Closed 2026-05-01 (KT Cloud KS arc-runner-set 진화로 superseded)

## 도메인 카논
- [소셜 시스템](project_social_system.md) — SocialHub, Redis Presence, WS 핸들러, 차단 필터링
- [에러 처리 체계](project_error_system.md) — AppError, ErrorBoundary 3계층, Sentry, OTel
- [모듈 시스템](project_module_system.md) — 33개 모듈, BaseModule+ConfigSchema+PhaseReactor+Factory+PlayerAware 게이트
- [코딩 규칙](project_coding_rules.md) — Go/React 계층구조, DI, 상태관리, 테스트
- [에디터 개방 + 심사 + 이미지 업로드](project_editor_open_access.md) — 전유저 에디터, 게시 심사, 크롭 업로드
- [mmp-pilot 통합 시스템](project_mmp_pilot.md) — plan-* + mmp 하네스 통합, /plan-go 단일 진입점, M3 cutover 완료

## 도구 & 인프라
- [Docker/Nginx 인프라](project_infra_docker.md) — Nginx 리버스 프록시, dev/prod Compose, Makefile
- [로컬 인증](project_local_auth.md) — E2E 계정 e2e@test.com/e2etest1234, OAuth 병행
- [E2E 테스트](project_e2e_testing.md) — Playwright 12건, pnpm test:e2e
- [설계 문서 위치](reference_design_docs.md) — docs/plans/2026-04-05-rebuild/ 설계 문서 맵
- [QMD 로컬 문서 검색](reference_qmd_setup.md) — MCP 서버, 컬렉션, Hook 강제
- [graphify 지식 그래프](reference_graphify_setup.md) — 6700n/15398e/531c, Token 17.1x 감소
- [graphify refresh 정책](project_graphify_refresh_policy.md) — Phase 종료 시점만 fresh rebuild + PR
- [compound-mmp 플러그인](reference_compound_mmp_plugin.md) — 4단계 라이프사이클 (Plan/Work/Review/Compound)
- [plan-go ↔ plan-autopilot 연결](reference_plan_go_setup.md) — symlink + plan-tasks.sh 패치 노트

## 작업 방식
- [Opus 헤드쿼터 모드](feedback_opus_headquarter.md) — Opus는 판단/지시, 실제 작업은 Sonnet/Haiku 위임
- [코딩 작업 수행 규율](feedback_coding_discipline.md) — 구현 전 사고 → 단순함 → 외과적 변경 → 목표 검증 4원칙
- [사용자 설명 형식](feedback_explanation_style.md) — 원인/결과/권장 3섹션, 비개발자 친화 어휘
- [작업 루틴 강제](feedback_work_routine.md) — 시작 시 QMD 컨텍스트 로드, 완료 시 재인덱싱
- [main 직접 push 금지 · branch + PR 필수](feedback_branch_pr_workflow.md) — branch protection + 15 status check
- [아키텍처·의존성 질문은 graphify 먼저](feedback_graphify_first.md) — `--update` 증분만 사용
- [4-agent 리뷰는 admin-merge 전](feedback_4agent_review_before_admin_merge.md) — security/perf/arch/test 4 병렬
- [서브에이전트 Sonnet 4.6 기본](feedback_sonnet_46_default.md) — 보안·아키텍처는 opus-4-7
- [메모리 canonical = repo/memory/](feedback_memory_canonical_repo.md) — user home은 archival
- [사용자 mode 결정 후 매 task 재확인 X](feedback_mode_decision_gate.md) — admin-skip / 4-agent 우회 mode 결정 후 게이트 X
- [plan-resume도 QMD 우선](feedback_qmd_plan_resume.md) — 스킬 지시보다 프로젝트 규칙 우선
- [plan-resume QMD 효율화](feedback_plan_resume_qmd.md) — 컨텍스트 토큰 절약 how-to

## 코드 리뷰 패턴 & 프로세스
- [코드 리뷰 패턴 통합](feedback_code_review_patterns.md) — Go/React/DB/보안/PWA/오디오 전 Phase 통합
- [applyOptimistic 호출 시점 (flush, not schedule)](feedback_optimistic_apply_timing.md) — debounce+optimistic 합성 훅의 시점 카논 (Phase 21 E-1)
- [optimistic rollback snapshot identity](feedback_optimistic_rollback_snapshot.md) — 두 layer 패턴 사용 시 pendingSnapshotRef로 진짜 pre-edit 캡처
- [git diff --diff-filter는 AMR](feedback_pr_diff_filter_rename.md) — PR diff 검사 CI에서 rename(R) 우회 차단
- [마이그레이션 워크플로우](feedback_migration_workflow.md) — 6전문가 토론 → 승인 → 구현 → 리뷰 → QA
- [plan-autopilot 운영 함정](feedback_plan_autopilot_gotchas.md) — status 필드 schema, 워크트리 cleanup
- [CI 인프라 부채](feedback_ci_infra_debt.md) — golangci-lint↔Go1.25, ESLint9 config 미흡
- [CI admin-skip 정책 (만료 — 2026-04-29)](project_ci_admin_skip_expired_2026-04-29.md) — 정상 squash 모드 복귀
- [WS 토큰 쿼리 파라미터](feedback_ws_token_query.md) — `?token=` 쿼리 인증
- [파일/함수 크기 티어](feedback_file_size_limit.md) — Go 500/80, TS·TSX 400/60·150, MD 500(CLAUDE.md만 200)
- [QMD MCP 메모리 누수 운영](feedback_qmd_memory_leak.md) — 컬렉션 최소화, 장시간 세션 주기 재시작

## Phase 23 인프라 카논 (Custom Runner Image)
- [Custom Runner Image chicken-egg 회피](feedback_runner_bootstrap.md) — `build-runner-image.yml` `runs-on: ubuntu-latest`
- [self-hosted runner용 multi-stage Dockerfile](feedback_multi_stage_dockerfile_runner.md) — builder + final 분리
- [Custom Runner Image GHCR 첫 push 절차](feedback_ghcr_self_hosted_bootstrap.md) — GITHUB_TOKEN + Public visibility

## 최근 세션 회고
- [2026-05-01 Phase 21 E-1/E-6 — useDebouncedMutation 훅 + file-size CI guard](sessions/2026-05-01-phase-21-e1-e6-debounce-hook.md) — 4 PR 머지 (#178/#183/#184/#185), 4-agent 3 round + CodeRabbit 2 round, E-7~E-12 follow-up 등록
- [2026-04-19 토큰 최적화](project_session_2026-04-19_optimization.md) — 3 PR (#116/#117/#118), 세션당 ~8~25K 절감

## 완료 Phase Archive
종합 인덱스: [project_phases.md](project_phases.md). 개별 progress·plan 파일은 그대로 보존 (QMD `mmp-memory` 검색 또는 직접 read).

- **Phase 7.7~10**: [followups](project_phase77_followups.md) · [8.0 plan](project_phase80_plan.md) [progress](project_phase80_progress.md) · [9.0](project_phase90_progress.md) · [10.0](project_phase100_progress.md)
- **Phase 11~17**: [11.0](project_phase110_plan.md) · [12.0](project_phase120_progress.md) · [13.0](project_phase130_plan.md) · [14.0](project_phase140_plan.md) · [15.0 plan](project_phase150_plan.md) [progress](project_phase150_progress.md) · [16.0](project_phase160_progress.md) · [17.0](project_phase170_plan.md) · [17.5](project_phase175_progress.md)
- **Phase 18.x**: [18.0 plan](project_phase180_plan.md) [progress](project_phase180_progress.md) · [18.1](project_phase181_progress.md) · [18.3](project_phase183_progress.md) · [18.4](project_phase184_progress.md) · [18.5](project_phase185_progress.md) · [18.6 plan](project_phase186_plan.md) [progress](project_phase186_progress.md) · [18.7](project_phase187_progress.md) · [18.8 plan](project_phase188_plan.md) [progress](project_phase188_progress.md)
- **Phase 19~20**: [19 audit](project_phase19_audit_progress.md) [implementation](project_phase19_implementation_progress.md) · [19.1](project_phase19_1_progress.md) · [20 plan](project_phase20_plan.md) [progress](project_phase20_progress.md)
- **Phase 22~23 (인프라)**: [Phase 22 W1.5 debt-cleanup](sessions/archive/2026-04-28-debt-cleanup-runner-network.md) (PR #167/168/169/170 머지, PR #172 outdated close 2026-04-30) · [Phase 23 Custom Runner Image](sessions/archive/2026-04-29-phase-23-custom-runner-image-merge.md) (mega PR #174 + hotfix #175 머지, follow-ups → Phase 21 backlog 이월). main이 PR #179/#180으로 KT Cloud KS arc-runner-set 으로 진화 (Phase 23 자체는 superseded 아님 — 별도 ARC 라인)

## 옛 세션 핸드오프
`sessions/archive/` (14 파일) — compound-mmp Wave 1~4, ci-infra-recovery, phase-22 W1·W1.5, PR fold-in (#168/#170), phase-23 pivot·머지. 필요 시 직접 read.
