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
