---
file: 00-INDEX.md
purpose: 12개 architecture 문서 라우팅 진입점 — 어떤 질문/상황 → 어느 파일을 먼저 읽을지
audience: design-AI
last_verified: 2026-04-30
sources_of_truth:
  - 01~11 docs/architecture/*.md (자체 라우팅)
related: [01-system-overview.md, 09-issues-debt.md]
---

# 00. INDEX — AI 라우팅 진입점

> **AI 사용법**: 사용자 요청을 받으면, 본 문서의 라우팅 표(`#routing-table`)에서 가장 가까운 행을 찾아 해당 파일부터 read한다. 한 파일로 부족하면 `related` 필드를 따라 확장한다.

## 12 파일 1줄 요약 {#file-summary}

| # | 파일 | 1줄 요약 |
|---|---|---|
| 00 | `00-INDEX.md` | (이 문서) 라우팅 진입점 + 12 파일 안내 |
| 01 | `01-system-overview.md` | 1페이지 시스템 요약 + 컨텍스트 다이어그램 + 게임 1판 시퀀스 |
| 02 | `02-backend.md` | Go 1.25 백엔드 — 3계층 / 13 도메인 / engine / 33 모듈 / WS 코드 위치 |
| 03 | `03-frontend.md` | React SPA — 라우트 / Zustand 3-layer / API 클라 / 에러 처리 |
| 04 | `04-data.md` | PostgreSQL 26 migrations + sqlc 도메인 + Redis 키 + S3 |
| 05 | `05-realtime.md` | WS 채널 분리 + envelope catalog 4종 + PhaseAction + 모듈 등록 절차 |
| 06 | `06-infra-cicd.md` | Docker compose dev/prod + Nginx + ARC + admin-skip 정책 + 4-agent 리뷰 |
| 07 | `07-tech-stack.md` | 버전 표 (Go 1.25 / React 19 / Tailwind 4 …) + 최소 환경 + 첫 실행 절차 |
| 08 | `08-roadmap.md` | 진행 중 phase (19 Residual / 22 W1.5) + 직후 후보 (21, 24) |
| 09 | `09-issues-debt.md` | **🔥 가장 중요** — DEBT/ISSUE/RISK/TODO 표 (P0~P3, ID 영구) |
| 10 | `10-history-summary.md` | 종료 phase 1~3줄 요약 + 폐기 결정 + 정책 변경사 |
| 11 | `11-glossary.md` | 도메인 어휘 + 시스템 약어 + 패턴 + 폐기/혼동 주의 |

## 라우팅 표 — 질문 → 파일 {#routing-table}

> AI 신규 진입 시 1순위 read는 항상 `01-system-overview.md`. 아래 표는 그 다음 read를 결정한다.

### 신규 합류 / 컨텍스트 부족 {#routing-onboarding}

| 상황 | Read 순서 |
|---|---|
| 처음 들어왔다 / 전체 그림 모름 | 01 → 09 → 08 → 11 |
| 도메인 어휘 모름 (단서/메타포/모듈) | 11 → 02 §modules |
| "이 프로젝트가 v2와 뭐가 다른가" | 10 §deprecated → 01 §decisions |
| "이 코드 어디서부터 봐야 해" | 01 §entry-points → 02 §layout 또는 03 §layout |

### 신규 기능 추가 {#routing-new-feature}

| 추가하려는 것 | Read 순서 |
|---|---|
| 새 게임 모듈 | 02 §modules → 05 §add-module → 11 §patterns (PlayerAware) |
| 새 WS 메시지 타입 | 05 §envelopes → 05 §add-ws-feature → 02 §ws |
| 새 페이지/라우트 | 03 §pages → 03 §services → 03 §stores |
| 새 도메인 (백엔드) | 02 §domains → 02 §layers → 04 §migrations → 04 §sqlc |
| 새 DB 테이블 | 04 §migrations → 04 §sqlc → `memory/feedback_migration_workflow.md` (6전문가) |
| 새 PhaseAction | 05 §phase-actions → 02 §engine |
| 새 에러 코드 | 02 §middleware (AppError) → 03 §errors (error-messages.ts 동기화) |
| 새 CI workflow | 06 §ci → 06 §arc → 09 §ISSUE-w15-pr5 (runs-on 정책) |
| 새 Redis 키 | 04 §redis (prefix 컨벤션) |

### 문제 해결 / 디버깅 {#routing-debug}

| 상황 | Read 순서 |
|---|---|
| 뭐가 시급한지 알고 싶다 | **09 §p0** → 08 §in-progress |
| CI red / 머지 막힘 | 09 §closed-recent → 06 §admin-skip → 09 §p0 |
| WS 메시지 안 옴 | 05 §channels → 05 §reconnect → 09 §ISSUE-19r-w4 |
| per-player 정보 누설 의심 | 02 §playeraware → 05 §playeraware → 09 §RISK 영역 |
| 모듈이 boot panic | 02 §playeraware (게이트 미충족) |
| `localhost:5432` 연결 실패 | 07 §stores (dev: 25432), 06 §compose §dev |
| migration drift | 04 §migrations + CI drift gate |
| DB 외래키 변경 필요 | 04 §constraints → `memory/feedback_migration_workflow.md` |

### 운영 / 배포 / 정책 {#routing-ops}

| 상황 | Read 순서 |
|---|---|
| PR 머지 절차 | 06 §admin-skip → 06 §4-agent-review → `memory/feedback_branch_pr_workflow.md` |
| admin-skip 만료 조건 | 06 §admin-skip → 09 §p0 (DEBT-4/5) |
| ARC runner 작업 | 06 §arc → 09 §ISSUE-w15-* |
| prod 배포 정책 | 06 §env-diff → 09 §RISK-prod-deploy → 08 §next-candidates (Phase 24) |
| graphify refresh | 06 §graphify → `memory/project_graphify_refresh_policy.md` |
| 다음 phase 진입 | 08 §decision-tree |
| phase 종료 처리 | 08 §decision-tree (`compound-mmp:wrap-up-mmp`) |

### 정합성 검증 {#routing-consistency}

| 상황 | Read 순서 |
|---|---|
| Go ↔ TS 타입 동기화 | 02 §type-sync → 05 §add-ws-feature |
| ConfigSchema (Zod ↔ Go) | 02 §modules → 05 §add-module |
| 코딩 스타일 / 파일 한도 | 02 §size, 03 §size, 07 §file-size-tier |
| 테스트 커버리지 | 02 §testing, 03 §testing, 07 §coverage, 09 §DEBT-coverage-* |

## 작성·갱신 정책 {#policy}

### 갱신 시점
- **Phase 종료 시**: 09 §closed-recent + 10 §phase-timeline 추가, 08 §in-progress 갱신
- **새 PR 머지 시 (구조 변경)**: 02~06 해당 §, 07 §migrations(필요 시)
- **새 정책 결정 시**: 10 §policy-changes + 11 §patterns(필요 시)
- **새 부채 발견 시**: 09 §p0 또는 §p1 추가 (ID 영구)

### 갱신 권장 빈도
- 09 (issues-debt): **PR마다** (가장 자주)
- 08 (roadmap): **Wave 단위**
- 02~06 (영역): **구조 변경 PR 단위**
- 01, 11 (요약/용어): **분기 단위 또는 도메인 변동 시**
- 10 (history): **phase 종료 시 append-only**
- 00 (INDEX): **새 파일 추가 시 또는 라우팅 표 갱신 시**

### 진실 우선순위 (검증 충돌 시)
1. **graphify** (`graphify-out/GRAPH_REPORT.md`, `graph.json`) — 단, `.needs_update` 마크 또는 7일 경과 시 stale
2. **QMD** (`mmp-memory`, `mmp-plans` 컬렉션) — `mcp__plugin_qmd_qmd__vector_search`
3. **코드 직접 read** — 위 둘이 부족할 때만

본 문서들 자체는 그 위 출처들의 **요약**이다. 충돌 시 원본 우선.

### "UNVERIFIED" 표기
- 본 문서들에 `UNVERIFIED:` 접두가 붙은 항목은 작성 시점 확인 미완료.
- 신규 phase 진입 시 해당 항목을 graphify 또는 직접 read로 확정 + 본 문서 갱신.

## 본 문서가 다루지 않는 것 {#out-of-scope}

> 직접 원본을 보라.

| 영역 | 원본 위치 |
|---|---|
| 함수 시그니처·라인 단위 디테일 | 코드 직접 read 또는 graphify `path` 쿼리 |
| 진행 중 PR 본문·리뷰 코멘트 | `gh pr view <num>` |
| 사용자 피드백 큐 | `memory/feedback_*.md` 개별 |
| 에디터 UX 디테일 (Phase 11~17) | `memory/project_phase1*_progress.md` |
| 외부 정책 (Cloudflare/KT Cloud KS) | 해당 콘솔 직접 |

## 빠른 참조 — 가장 자주 필요한 위치 {#quick-ref}

- 모듈 추가 절차 → 05 §add-module
- WS 메시지 추가 절차 → 05 §add-ws-feature
- migration 추가 → 04 §migrations + `memory/feedback_migration_workflow.md`
- admin-skip 만료 진입 조건 → 06 §admin-skip + 09 §p0
- 코딩 룰 (계층/DI/에러) → 02 §layers + 03 §state + 02 §middleware
- 부채 우선순위 → 09 §p0/p1/p2/p3
