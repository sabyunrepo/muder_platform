## 프로젝트 정보
- [MMP v3 프로젝트 개요](project_overview.md) — Go+React 머더미스터리 v3, 기술 스택과 아키텍처
- [Phase 체크리스트](project_phases.md) — Phase 0~17.0 완료
- [Phase 11.0 메타포 테스트](project_phase110_plan.md) — **완료** 단서 아이템 + 메타포 템플릿 + E2E (5 PR, 4 Wave, 2026-04-13)
- [Phase 12.0 완료](project_phase120_progress.md) — 메타포 풀 경험 게임 모듈 4개 (5 PR, 42 tests, 2026-04-13)
- [Phase 13.0 플랜](project_phase130_plan.md) — 게임 설계 에디터 (7 PR, 4 Wave, 서브탭+ConfigSchema+맵+타임라인+배치)
- [Phase 14.0 완료](project_phase140_plan.md) — **완료** 에디터 UX 개선 (5 PR, 3 Wave, 224 tests, 2026-04-14)
- [Phase 15.0 완료](project_phase150_progress.md) — **완료** React Flow 캔버스 + 분기/엔딩 + 조건빌더 (8 PR, 4 Wave, 303 tests, 2026-04-14)
- [Phase 16.0 완료](project_phase160_progress.md) — **완료** 에디터 UX 버그픽스 (4 PR + 핫픽스 3건, 이미지캐시/모달/모듈토글/흐름템플릿, 2026-04-14)
- [Phase 17.0 완료](project_phase170_plan.md) — **완료** v2 이식 + 흐름 완성 (7 PR, 4 Wave, 353 tests, 2026-04-14)
- [Phase 17.5 완료](project_phase175_progress.md) — **완료** 단서 관계 그래프 DAG (4 PR, 3 Wave, 16 tests + 8 리뷰 fix, 2026-04-15)
- [Phase 18.0 완료](project_phase180_progress.md) — **완료** 게임 런타임 통합 (10 PR, 6 Wave, 50 tasks, feature flag `game_runtime_v2`, 2026-04-15)
- [Phase 18.1 완료](project_phase181_progress.md) — **완료** 게임 런타임 Hotfix (5 PR, 3 Wave, 41 tasks, B-1~B-4+H-1~H-4 해결, 2026-04-15)
- [Phase 18.3 완료](project_phase183_progress.md) — **완료** 보안 하드닝 + CI 정비 (4 PR, 2 Wave, M-7/M-a/M-e+L-2~L-8+CI-1/2/3 해결, 2026-04-15)
- [Phase 18.4 완료](project_phase184_progress.md) — **완료** 에디터 UX Bugfix 9건 (7 PR + 3 hotfix, 4 Wave, 423 tests + 9 E2E, 2026-04-15)
- [Phase 18.5 완료](project_phase185_progress.md) — **완료** 에디터 리팩터 + 테스트 보강 (ValidateTheme 추출, routes_editor.go 분할, flowApi MSW, 2 커밋 `1bc1f23`+`627df05`, 2026-04-16)
- [Phase 18.6 완료](project_phase186_progress.md) — **완료** E2E Recovery (ws-client build + ThemeCard schema drift, 3 PR #49/#50/#51, E2E 4 pass/11 skip/0 fail, H7 Phase 18.7 이관, 2026-04-16)
- [Phase 18.7 완료](project_phase187_progress.md) — **완료** CI/Test Automation Hardening (Hotfix #53 + 7 PR #54-62, 4 Wave, migration drift gate/cache/SHA pin/Codecov/govulncheck/gitleaks/trivy/osv/CodeQL/SBOM/provenance/E2E shard+firefox/Renovate, 2026-04-16)
- [Phase 18.8 플랜](project_phase188_plan.md) — **관측 stash** E2E Skip Recovery (5/5 PR merged, W3 PR-5 3일 green 관측 중, active-plan `.claude/active-plan.phase-18.8.json.bak`로 stash, 2026-04-17)
- [Phase 19 Platform Deep Audit](project_phase19_audit_progress.md) — **완료** 9영역 심층 감사 + 8 cross-cutting + 9 PR backlog + 4 decisions resolved (Finding 89, PR #69, QMD v2 hotel 추가, 2026-04-17)
- [Phase 19 Implementation](project_phase19_implementation_progress.md) — **완료** P0 7/7 (100%). PR-2c #107(0b31271) + hotfix #108(59a39c4, 2026-04-18). combination real per-player redaction(D-MO-1) + handleCombine deadlock fix + uuid.Nil guard + Collected sort.Strings. 4-agent 사후 리뷰 HIGH/MEDIUM 해소. Follow-up은 Phase 19.1로 승격
- [Phase 19.1 Audit Review Follow-ups](project_phase19_1_progress.md) — **완료** W1 3 PR 머지 (PR-A #111 strict env 제거+BuildState godoc / PR-B #112 coverage lint AST 재작성 · 4 우회 패턴 차단 / PR-C #113 PeerLeakAssert helper 패키지 + 3+players table + Restore/engine dispatch 통합 테스트). 리뷰 MEDIUM 2+LOW 1 해소. 2026-04-18
- [Phase 20 플랜](project_phase20_plan.md) — 단서·장소 에디터 정식 승격 (6 PR, 4 Wave, 2026-04-17 시작)
- [Phase 20 완료](project_phase20_progress.md) — **완료 + 스테이징 QA** 단서·장소 에디터 정식 승격 (6 PR #71~#77 + archive #78, 4 Wave, 2026-04-17). 통합 clue_edge_groups 스키마 + AUTO/CRAFT + CurrentRound + 라운드 필터 + 프론트 승격. 스테이징 DB 00020~00025 적용 + 라운드 왕복 QA 7/7 통과 (CHECK 제약 9건 활성 확인)
- [Phase 19 Residual 활성화](project_phase19_residual_progress.md) — **진행 중** 감사 backlog 잔여 9 PR + 2 hotfix (W0 PR-0 ↔ W4 PR-10). Plan PR #119 머지(`19446a2`, 2026-04-21). active-plan.json 활성화 완료. W0 PR-0 MEMORY Canonical Migration부터 착수.
- [에디터 개방 + 심사 + 이미지 업로드](project_editor_open_access.md) — 전유저 에디터, 게시 심사, 크롭 업로드 (2026-04-13)
- [Phase 10.0 완료](project_phase100_progress.md) — QA Bugfix Sprint (5 PRs, 15 tasks, 커밋 dfbc340)
- [Phase 9.0 완료](project_phase90_progress.md) — 전체 완료 (16 PRs, 7 Waves, 31 모듈, 4장르 e2e)
- [Phase 8.0 계획 (archived)](project_phase80_plan.md) — Engine Integration Layer (Phase 9.0으로 대체됨)
- [Phase 8.0 진행 상황 (archived)](project_phase80_progress.md) — W1까지 완료 후 Phase 9.0으로 전환
- [Phase 7.7 후속 작업](project_phase77_followups.md) — Phase 8.0 종료 후 cleanup용 Medium 이슈 목록
- [소셜 시스템](project_social_system.md) — SocialHub, Redis Presence, WS 핸들러, 차단 필터링
- [에러 처리 체계](project_error_system.md) — AppError, ErrorBoundary 3계층, Sentry, OTel
- [모듈 시스템](project_module_system.md) — 33개 모듈 (spec 29 + crime_scene 3 + media 1), BaseModule+ConfigSchema+PhaseReactor+Factory+PlayerAware 게이트
- [코딩 규칙](project_coding_rules.md) — Go/React 계층구조, DI, 상태관리, 테스트
- [mmp-pilot 통합 시스템](project_mmp_pilot.md) — plan-autopilot+mmp하네스 병합, /plan-go 단일 진입점, 3-Layer, M0-M3 cutover 완료 (2026-04-15 commit cdd498e)

## 도구 & 인프라
- [Docker/Nginx 인프라](project_infra_docker.md) — Nginx 리버스 프록시, dev/prod Compose, Makefile
- [로컬 인증](project_local_auth.md) — E2E 계정 e2e@test.com/e2etest1234, OAuth 병행
- [E2E 테스트](project_e2e_testing.md) — Playwright 12건, pnpm test:e2e, 백엔드 없으면 로비 플로우 자동 스킵
- [설계 문서 위치](reference_design_docs.md) — docs/plans/2026-04-05-rebuild/ 설계 문서 맵
- [QMD 로컬 문서 검색](reference_qmd_setup.md) — MCP 서버, 3 컬렉션(plans/memory/specs), Hook 강제 구조
- [graphify 지식 그래프](reference_graphify_setup.md) — 6700n/15398e/531c, Token 17.1x 감소, god nodes, Hook 강제, `.needs_update` auto-touch (2026-04-18)
- [graphify refresh 정책 (D)](project_graphify_refresh_policy.md) — Phase 종료 시점만 fresh rebuild + PR, 일상 post-commit/watch/update는 로컬 전용·커밋 금지 (2026-04-18)
- [plan-go ↔ plan-autopilot 연결](reference_plan_go_setup.md) — symlink 필요, plan-tasks.sh grep 버그 패치 노트

## 작업 방식
- [Opus 헤드쿼터 모드](feedback_opus_headquarter.md) — Opus는 판단/지시/종합만, 실제 작업은 Sonnet/Haiku 위임
- [작업 루틴 강제](feedback_work_routine.md) — 시작 시 QMD 컨텍스트 로드, 완료 시 문서 업데이트+재인덱싱 필수
- [main 직접 push 금지 · feature branch + PR 필수](feedback_branch_pr_workflow.md) — branch protection + 15 status check, bypass 금지 (2026-04-17 `d1262a7` 사건 이후)
- [아키텍처·의존성 질문은 graphify 먼저](feedback_graphify_first.md) — QMD와 대칭 규칙, `/graphify query|explain|path` 우선, `--update` 증분만 사용 (2026-04-18)
- [4-agent 코드리뷰는 admin-merge 전에 수행](feedback_4agent_review_before_admin_merge.md) — Auto mode + CI admin-skip 에서도 security/perf/arch/test 4 병렬 리뷰 선행. PR-2c (#107) 리뷰 생략 후 HIGH deadlock 이슈가 hotfix #108 로 발견된 사례 (2026-04-18)
- [서브에이전트 Sonnet 4.6 기본](feedback_sonnet_46_default.md) — 서브에이전트 spawn 시 `claude-sonnet-4-6` 명시, 4.5 금지. 보안·아키텍처는 opus-4-7, 간단 검색은 haiku-4-5 (2026-04-19)
- [메모리 canonical = repo/memory/](feedback_memory_canonical_repo.md) — 신규 memory는 repo만 작성, user home은 archival. QMD `mmp-memory` 컬렉션 경로 repo 이전, `originSessionId` 프론트매터 금지 (2026-04-21 PR-0)
- [2026-04-19 세션 — 토큰 최적화](project_session_2026-04-19_optimization.md) — 3 PR (#116 module-spec 33, #117 hook slim + advisor, #118 /plan-* QMD + Sonnet 4.6). 세션당 ~8~25K 절감

## 코드 리뷰 패턴 & 프로세스
- [코드 리뷰 패턴 통합](feedback_code_review_patterns.md) — Go/React/DB/보안/PWA/오디오 전 Phase 통합 패턴
- [마이그레이션 워크플로우](feedback_migration_workflow.md) — 6전문가 토론 → 승인 → 구현 → 리뷰 → QA
- [plan-autopilot 운영 함정](feedback_plan_autopilot_gotchas.md) — status 필드 schema, 워크트리 cleanup 순서, dry-run 머지 등
- [CI 인프라 부채](feedback_ci_infra_debt.md) — golangci-lint↔Go1.25 + ESLint9 config 미흡 (main도 fail), Phase 8.5 cleanup 후보
- [CI admin-skip 정책 (2026-05-01까지)](project_ci_admin_skip_until_2026-05-01.md) — 모든 PR `gh pr merge --admin` 머지, 체크 red 무시 (2026-04-18 결정)
- [plan-resume QMD 효율화](feedback_plan_resume_qmd.md) — Read 대신 QMD로 필요 섹션만 로드, 컨텍스트 토큰 절약
- [plan-resume에서도 QMD 우선](feedback_qmd_plan_resume.md) — 스킬 지시와 무관하게 docs/plans, memory 경로는 QMD get 필수
- [WS 토큰 쿼리 파라미터](feedback_ws_token_query.md) — WebSocket은 ?token= 쿼리로 인증 (Authorization 헤더 아님)
- [파일/함수 크기 티어](feedback_file_size_limit.md) — Go 500/함수 80, TS·TSX 400/함수 60·컴포넌트 150, MD 500(CLAUDE.md만 200, 2026-04-21 변경)
- [QMD MCP 메모리 누수 운영](feedback_qmd_memory_leak.md) — 컬렉션 최소화 + 장시간 세션 주기 재시작, vantict 등 타프로젝트 분리
