# Murder Mystery Platform (MMP v3) — 프로젝트 규칙

## 프로젝트 개요
다중 테마 실시간 멀티플레이어 머더미스터리 게임 플랫폼 v3 리빌드.
새 레포에서 처음부터 작성. 기존 v2 코드 마이그레이션 아님.

## 기술 스택
- **Backend**: Go 1.25 + gorilla/websocket + sqlc + pgx + asynq + go-redis
- **Frontend**: React 19 + Vite (SPA) + Zustand + Tailwind CSS 4
- **Mobile**: Expo (React Native)
- **DB**: PostgreSQL + Redis
- **Voice**: LiveKit
- **Infra**: Docker (scratch) + K8s + Cloudflare Pages + GitHub Actions

## 설계 문서
`docs/plans/2026-04-05-rebuild/` — 설계 인덱스 + refs/ 상세
- design.md (인덱스), context.md (결정 근거), checklist.md (14 Phase)
- module-spec.md (29개 모듈 인덱스) → refs/modules/ (카테고리별 상세)
- refs/ (아키텍처, 게임엔진, 패턴, 보안, 오디오, 에디터)

## 코딩 규칙

### Go 백엔드
- 계층: Handler → Service(인터페이스) → Repository/Provider(구현)
- DI: 생성자 주입 (수동)
- 에러: AppError + RFC 9457 Problem Details + 에러 코드 레지스트리
- 로깅: zerolog (console.log 금지)
- 테스트: mockgen + testcontainers-go, 75%+ 커버리지

### React 프론트엔드
- 라우팅: React Router (lazy loading)
- 상태: Zustand 3레이어 (Connection / Domain / UI)
- 스타일: Tailwind CSS only, 다크 모드 기본 (slate/zinc + amber)
- 아이콘: lucide-react 전용
- 테스트: Vitest + Testing Library + MSW

### 모듈 시스템
- BaseModule + ConfigSchema(선언적 설정) + AutoContent(자동 콘텐츠)
- PhaseReactor(선택적): PhaseAction에 반응하는 모듈만 구현
- Factory 패턴: 세션별 독립 인스턴스 (싱글턴 금지)
- init() + blank import 등록

### 버전 관리
- Semantic Versioning, Conventional Commits (feat/fix/perf/docs/test/chore)
- 브랜치: main, feat/*, fix/*

## 🔴 QMD 필수 사용 규칙

> `docs/plans/`, `memory/`, `docs/superpowers/` 경로의 문서는 **반드시 QMD MCP 먼저** 사용.
> Grep/Read 직접 접근은 QMD로 대상 파일을 특정한 후에만 허용.

### QMD MCP 도구 (plugin:qmd:qmd)
| 도구 | 속도 | 용도 |
|------|------|------|
| `search` | ~30ms | 키워드 정확 매칭 (파일명, 함수명, PR ID) |
| `vector_search` | ~2s | 시맨틱 검색 (개념, 설계 의도) |
| `deep_search` | ~10s | 하이브리드 + 리랭킹 (최고 품질, 모호한 쿼리) |
| `get` | 즉시 | 경로/docid로 특정 문서 전문 조회 |
| `multi_get` | 즉시 | glob/리스트로 다중 문서 배치 조회 |

### 컬렉션
- `mmp-plans` (97 docs) — 설계 문서, PR 스펙, 체크리스트, 아키텍처
- `mmp-memory` (18 docs) — 프로젝트 메모리, 피드백, 코딩 규칙
- `mmp-specs` (9 docs) — 브레인스토밍 결과, 엔진 재설계 스펙

### 🔴 강제 규칙
1. **Grep on docs/plans/ 절대 금지** — Hook이 차단함. QMD search 사용
2. **설계 결정/PR 스펙 조회** → `qmd get "refs/prs/pr-a7.md"` 또는 `qmd search "PR-A7" -c mmp-plans`
3. **plan-resume 시** → active-plan.json + QMD get으로 현재 PR spec만 로드 (전문 Read 금지)
4. **시맨틱 질문** ("왜 이 결정을 했지?") → `qmd deep_search` 또는 `qmd vector_search`
5. **Read 허용 케이스**: QMD로 대상 특정 후 소스코드 파일(.go, .ts, .tsx) 읽기, 또는 정확한 경로+줄번호 확인

### 자동 최적화 Hooks
- **QMD Enforcer** (PreToolUse Grep|Read): docs/plans, memory 경로 → Grep 차단, Read 경고
- **ReadOnce** (PreToolUse Read): 동일 세션 내 같은 파일 재읽기 시 "변경 없음" 경고
- **Build Filter** (PostToolUse Bash): 테스트/빌드 출력 30줄+ → 에러만 요약
- **PreCompact** (PreCompact): 컨텍스트 압축 전 plan 상태 + git 상태 자동 보존

## Active Plan Workflow (plan-autopilot)

이 프로젝트는 `plan-autopilot` 스킬로 phase 기반 개발을 관리합니다.
- 스킬: `~/.claude/skills/plan-autopilot/SKILL.md`
- 활성 plan 포인터: `.claude/active-plan.json` (없으면 hook no-op)

### 현재 활성 plan
**Phase 8.0 — Engine Integration Layer** (2026-04-08 시작)
- design: `docs/plans/2026-04-08-engine-integration/design.md` (index) + `refs/`
- plan: 작성 예정
- 9 PRs, 5 waves (W1 병렬 ×2, W4 병렬 ×4)

### 자동 hooks (사용자 개입 0)
- SessionStart: STATUS + next task 주입 (~30줄)
- UserPromptSubmit: 1줄 STATUS 주입 (~25 토큰)
- PreToolUse (Edit/Write): **scope 내 파일은 design/checklist 읽기 전 BLOCK**
- PostToolUse: checklist 갱신 reminder

### Phase 경계 (드물게, phase당 2번)
- `/plan-start <dir>` — 새 plan 활성화
- `/plan-finish` — 완료 archive

### 실행
- `/plan-new <topic>` — brainstorming + writing-plans + 템플릿 저작
- `/plan-autopilot` — wave 기반 자동 실행
- `/plan-status`, `/plan-tasks` — 진행 상태
- `/plan-resume` — `/clear` 후 컨텍스트 복원
- `/plan-stop` — 실행 중단 (state 저장)

### 필수 규칙
- **모든 .md 파일 <200줄** (초과 시 `refs/` 분할 + index 패턴)
- **STATUS 마커 형식 유지** (hook 파싱)
- **Wave 병렬 PR은 `isolation: "worktree"`**
- **Review는 4 병렬 agent** (security/perf/arch/test-coverage)
- **Fix-loop 최대 3회** → 초과 시 user 개입
- **Wave 머지 전 user 확인 1회**
- **Feature flag default off** 로 in-flight wiring 보호
