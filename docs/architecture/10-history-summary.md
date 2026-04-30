---
file: 10-history-summary.md
purpose: 종료된 Phase·폐기 결정 1~3줄 요약. AI가 과거 결정을 빠르게 조회 + 환각 방지
audience: design-AI
last_verified: 2026-04-30
sources_of_truth:
  - memory/MEMORY.md (인덱스)
  - docs/plans/<date>-<topic>/
related: [08-roadmap.md, 09-issues-debt.md]
---

# 10. History Summary

> AI 주의: 본 문서는 "이미 끝난 것" 또는 "폐기된 것"의 요약이다. 본문 복원/재참조가 필요하면 `memory/<entry>` 또는 `docs/plans/<date>-<topic>/`로 이동.
> "현재 코드에 없는 것"을 "있다"고 잘못 추론하지 말 것.

## 완료 Phase 타임라인 {#phase-timeline}

| Phase | 기간 | 핵심 산출 | 출처 |
|---|---|---|---|
| 0~7.7 | ~2026-04-12 | 초기 인프라·도메인 모델·소셜·v2→v3 마이그레이션 | memory/project_phases.md |
| 8.0 (archived) | 2026-04-12 | Engine Integration Layer — W1까지 진행 후 Phase 9.0으로 대체 | memory/project_phase80_progress.md |
| 9.0 | 2026-04-12 | 16 PR / 7 Wave / 31 모듈 / 4장르 e2e 통과 | memory/project_phase90_progress.md |
| 10.0 | 2026-04-12 | QA Bugfix Sprint (5 PR / 15 task / commit dfbc340) | memory/project_phase100_progress.md |
| 11.0 | 2026-04-13 | 메타포 테스트 — 단서 아이템 + 메타포 템플릿 + E2E (5 PR / 4 Wave) | memory/project_phase110_plan.md |
| 12.0 | 2026-04-13 | 메타포 풀 경험 게임 모듈 4개 (5 PR / 42 tests) | memory/project_phase120_progress.md |
| 13.0 | 2026-04-13 | 게임 설계 에디터 — 서브탭 + ConfigSchema + 맵 + 타임라인 + 배치 (7 PR / 4 Wave) | memory/project_phase130_plan.md |
| 14.0 | 2026-04-14 | 에디터 UX 개선 (5 PR / 3 Wave / 224 tests) | memory/project_phase140_plan.md |
| 15.0 | 2026-04-14 | React Flow 캔버스 + 분기/엔딩 + 조건빌더 (8 PR / 4 Wave / 303 tests) | memory/project_phase150_progress.md |
| 16.0 | 2026-04-14 | 에디터 UX 버그픽스 (4 PR + 핫픽스 3) | memory/project_phase160_progress.md |
| 17.0 | 2026-04-14 | v2 이식 + 흐름 완성 (7 PR / 4 Wave / 353 tests) | memory/project_phase170_plan.md |
| 17.5 | 2026-04-15 | 단서 관계 그래프 DAG (4 PR / 3 Wave / 16 tests + 8 review fix) | memory/project_phase175_progress.md |
| 18.0 | 2026-04-15 | 게임 런타임 통합 — feature flag `game_runtime_v2` (10 PR / 6 Wave / 50 task) | memory/project_phase180_progress.md |
| 18.1 | 2026-04-15 | 게임 런타임 Hotfix (5 PR / 3 Wave / B-1~B-4 + H-1~H-4 해결) | memory/project_phase181_progress.md |
| 18.3 | 2026-04-15 | 보안 하드닝 + CI 정비 (4 PR / 2 Wave / M-7/M-a/M-e + L-2~L-8 + CI-1/2/3) | memory/project_phase183_progress.md |
| 18.4 | 2026-04-15 | 에디터 UX Bugfix 9건 (7 PR + 3 hotfix / 4 Wave / 423 tests + 9 E2E) | memory/project_phase184_progress.md |
| 18.5 | 2026-04-16 | 에디터 리팩터 — ValidateTheme 추출, routes_editor.go 분할, flowApi MSW | memory/project_phase185_progress.md |
| 18.6 | 2026-04-16 | E2E Recovery — ws-client build + ThemeCard schema drift (3 PR #49~#51) | memory/project_phase186_progress.md |
| 18.7 | 2026-04-16 | CI/Test Automation Hardening — drift gate + cache + SHA pin + Codecov + govulncheck + gitleaks + trivy + osv + CodeQL + SBOM + provenance + E2E shard + firefox + Renovate (Hotfix #53 + 7 PR #54~62) | memory/project_phase187_progress.md |
| 18.8 (stash) | 2026-04-17 | E2E Skip Recovery — 5/5 PR merged. W3 PR-5 3일 green 관측 후 stash | memory/project_phase188_plan.md |
| 19 (Audit) | 2026-04-17 | Platform Deep Audit — 9영역 + 8 cross-cutting + 9 PR backlog + 4 decisions resolved (Finding 89 / PR #69) | memory/project_phase19_audit_progress.md |
| 19 (Impl) | 2026-04-18 | P0 7/7. PR-2c #107 + hotfix #108. combination per-player redaction + handleCombine deadlock fix + uuid.Nil guard + Collected sort.Strings | memory/project_phase19_implementation_progress.md |
| 19.1 | 2026-04-18 | Audit Review Follow-ups W1 — strict env / coverage lint AST / PeerLeakAssert helper (PR #111~#113) | memory/project_phase19_1_progress.md |
| 20 | 2026-04-17 | 단서·장소 에디터 정식 승격 — 통합 `clue_edge_groups` + AUTO/CRAFT + CurrentRound + 라운드 필터 (6 PR #71~#77 + archive #78). 스테이징 QA 7/7 통과 | memory/project_phase20_progress.md |
| 19 Residual | 2026-04-21~ | 감사 backlog 잔여 9 PR + 2 hotfix (W0~W4). PR #119 plan 머지. **진행 중** (08-roadmap.md 참조) | memory/project_phase19_residual_progress.md |
| 22 W1 | 2026-04-28 | runner containerization — 5 runner pool 가동 (sabyun@100.90.38.7). PR #165 + #166 | memory/sessions/2026-04-28-phase-22-w1-complete.md |
| 22 W1.5 | 2026-04-28~ | DEBT cleanup — PR #167 (DEBT-1/2/3) + PR #168 (Runner Cache) + PR #169 (Stop hook). **진행 중** (08-roadmap.md 참조) | memory/sessions/2026-04-28-debt-cleanup-runner-network.md |
| 23 | 2026-04-29 | Custom Runner Image — chicken-egg 발견 + 머지 (commit 035f004 KT registry → ghcr.io / 4ad8c27 KT Cloud KS values + smoke / 01d2808 image-resident toolchain) | memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md |

## 폐기된 결정 / 제거된 컴포넌트 {#deprecated}

| 항목 | 폐기 시점 | 사유 | 대체 |
|---|---|---|---|
| **MMP v2 (Node.js + Socket.IO + Prisma + Next.js)** | v3 시작 시점 | 성능·단순성·배포 효율 | Go + React SPA + sqlc + pgx (이 레포) |
| **Next.js / SSR** | v3 설계 단계 | SSR 불필요, CDN 정적 배포 충분 | React + Vite SPA |
| **고정 FSM 게임 진행** | Phase 9.0 이전 | 시나리오 분기 표현력 부족 | 동적 페이즈 스크립트 러너 (3 Strategy: Script/Hybrid/Event) |
| **싱글턴 모듈** | v3 설계 단계 | v2에서 세션 간 상태 누수 버그 | Factory 패턴 (세션별 인스턴스) |
| **Phase 8.0 Engine Integration** | 2026-04-12 | 설계 한계로 W1까지만 진행 후 폐기 | Phase 9.0 (현재 GameProgressionEngine) |
| **`@jittda/ui` / `@seed-design/react` (Seed Design 3단계)** | v3 설계 단계 | 글로벌 CLAUDE.md 룰이지만 이 프로젝트만 예외 | Tailwind 4 직접 사용 + lucide-react |
| **`workflow-automation` 진행 중 plan 자동화** | 2026-04-27 | 안정성 부족 | `docs/plans/<phase>/checklist.md` 직접 read + git branch 추적 |
| **plan-autopilot + mmp 하네스 분리 운영** | 2026-04-15 (commit cdd498e) | 중복·혼란 | `mmp-pilot` 통합 (`/plan-go` 단일 진입점, M0~M3 cutover) |
| **MEMORY canonical = user home** | 2026-04-21 (Phase 19 Residual W0 PR-0) | 협업·이식성 | repo `memory/` 가 canonical (user home은 archival) |
| **fixed eslint config (`.eslintrc.*`)** | 2026-04-15 (Phase 18.3 PR-1) | ESLint 9 호환 | `apps/web/eslint.config.js` flat config |
| **Phase 18.7 이전 graphify Hook 자동 watch/post-commit 커밋** | 2026-04-18 (graphify refresh 정책 D) | 노이즈 + main 충돌 | Phase 종료 시점만 fresh rebuild + PR. 일상은 로컬 전용 |
| **MD 파일 한도 200줄** | 2026-04-21 (Phase 19 Residual kickoff) | plan/PR 스펙 분할 노이즈 | 500줄 (CLAUDE.md만 200) |
| **KT registry runner image 소스** | 2026-04-29 (Phase 23) | 가용성·CI 신뢰성 | ghcr.io |

## 혼동 주의 — 같은 이름 다른 모듈 {#name-collisions}

> AI가 "Location"이라는 단어를 보면 둘 중 어느 모듈인지 반드시 확인할 것.

| 모듈 | 카테고리 | 책임 | 출처 |
|---|---|---|---|
| `LocationClueModule` (#24) | exploration | 공용 단서 풀 — 장소에 던져두면 누구든 픽업 | memory/project_module_system.md |
| `LocationModule` (#30) | crime_scene (Phase 11+ 승격) | per-player 이동·검사 — 플레이어별 가시성 분리 | memory/project_module_system.md |

## CI/머지 정책 변경사 {#policy-changes}

| 시점 | 변경 |
|---|---|
| 2026-04-17 (`d1262a7` 사건 이후) | main 직접 push 금지. branch protection + 15 status check. bypass 금지 |
| 2026-04-18 | `admin-skip` 정책 도입. CI 인프라 부채로 main red 상태에서 PR 머지 차단 → admin-skip 임시 우회 |
| 2026-04-18 (PR-2c #107 사고) | 4-agent 코드 리뷰는 admin-merge 전에 수행 (HIGH 잔존 머지 금지). PR-2c가 review 생략 후 hotfix #108 발생 |
| 2026-04-19 | 서브에이전트 spawn 시 `claude-sonnet-4-6` 명시. 4.5 금지. 보안·아키텍처는 opus-4-7 |
| 2026-04-21 (Phase 19 Residual) | MEMORY canonical = repo `memory/`. user home 경로는 archival |
| 2026-04-28 | admin-skip 만료 시도 → reverse. 부채 정리 phase 종료까지 유지 (09-issues-debt.md 참조) |
