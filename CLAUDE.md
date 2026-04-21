# Murder Mystery Platform (MMP v3) — 프로젝트 규칙

## 하네스: MMP v3 전체 개발

**목표:** Go+React 풀스택 + 모듈 시스템 + 테스트 + 보안 리뷰를 6인 전문가 팀으로 조율한다.

**트리거:** Go/React 코드 변경, 모듈 추가, 테스트 보강, 보안 검토 요청 시 `mmp-harness` 스킬을 사용하라. 단순 조회/질문은 직접 응답 가능.

**구성:** `.claude/agents/` (docs-navigator, go-backend-engineer, react-frontend-engineer, module-architect, test-engineer, security-reviewer) + `.claude/skills/` (mmp-harness 오케스트레이터, mmp-qmd-first, mmp-200-line-rule, mmp-module-factory, mmp-test-strategy, mmp-security-rfc9457).

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-15 | 초기 구성 | 전체 | harness 플러그인 기반 전프로젝트 범용 팀 구축 |
| 2026-04-15 | mmp-pilot M0-M2 | `/plan-go`, mmp-pilot 스킬, run-*.sh, m3-cutover.sh, m4-plan.md | plan-autopilot↔하네스 통합 (M3 대기, M4 계획만 문서화). 상세: `.claude/designs/mmp-pilot/` |
| 2026-04-18 | PR-2a PlayerAware 게이트 의무화 | `§ 모듈 시스템`, `.claude/skills/mmp-module-factory/SKILL.md` | F-sec-2 대응: 모든 `engine.Module` 은 `PlayerAwareModule.BuildStateFor` 구현 또는 `engine.PublicStateMarker` 임베드 opt-out 중 하나 필수. registry boot panic + `MMP_PLAYERAWARE_STRICT` 롤백 스위치. PR #97 (phase-19 PR-2a). |
| 2026-04-18 | Phase 19.1 PR-A — PlayerAware 게이트 rollback env 제거 | `§ 모듈 시스템`, `.claude/skills/mmp-module-factory/SKILL.md`, `apps/server/internal/engine/registry.go`, `factory.go`, `types.go`, `phase_engine.go`, `gate_test.go` | 33/33 gate 충족 후 `MMP_PLAYERAWARE_STRICT` escape hatch 제거. `PhaseEngine.BuildState()` godoc 으로 internal/persistence-only 경계 강화. PR #(TBD) (phase-19.1 PR-A). |
| 2026-04-21 | MD 파일 한도 200→500 완화 (CLAUDE.md만 200) | `§ 파일/함수 크기 제한`, `.claude/skills/mmp-200-line-rule/SKILL.md`, `memory/feedback_file_size_limit.md` | 200줄 일괄 강제가 plan/PR 스펙·design 문서를 과도하게 잘라 refs 분할 노이즈 누적. CLAUDE.md만 자동 로딩 토큰 비용 때문에 200 유지, 그 외 MD는 500 + 초과 시 `refs/<topic>.md` 분리 패턴 유지. PR #(TBD) (phase-19-residual md-rule-relax-500). |

## 프로젝트 개요
다중 테마 실시간 멀티플레이어 머더미스터리 게임 플랫폼 v3 리빌드.
새 레포에서 처음부터 작성. 기존 v2 코드 마이그레이션 아님.

## 기술 스택
- **Backend**: Go 1.25 + gorilla/websocket + sqlc + pgx + asynq + go-redis
- **Frontend**: React 19 + Vite (SPA) + Zustand + **Tailwind CSS 4 (직접 사용)** + lucide-react (아이콘 전용)
- **Mobile**: Expo (React Native)
- **DB**: PostgreSQL + Redis
- **Voice**: LiveKit
- **Infra**: Docker (scratch) + K8s + Cloudflare Pages + GitHub Actions

> **⚠️ 글로벌 CLAUDE.md 프론트엔드 섹션 무효**: `~/.claude/CLAUDE.md`의 "프론트엔드 아키텍처 (Seed Design 3단계 필수)" 규칙(@jittda/ui, @seed-design/react 사용)은 **이 프로젝트에 적용되지 않는다**. 그 규칙은 다른 프로젝트(jittda-frontend-hub 등) 전용. MMP v3는 Tailwind 4를 직접 사용하고 디자인 시스템 라이브러리 의존 없음.

## 관련 프로젝트 (참조)
- **MMP v2 (머더미스터리 호텔)**: `/Users/sabyun/goinfre/merdermistery_hotel/` (base 브랜치). 에디터·대기방·로비 UX 이식 원본. QMD 컬렉션 `mmp-v2-docs`로 인덱싱(98 파일).
- v3는 **v2 코드를 마이그레이션하지 않음** — UX·플로우만 v3 기술 스택(React 19 + Tailwind 4 + Zustand)으로 재구현.

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
- **🔴 PlayerAware (의무, PR-2a 이후)**: 모든 `engine.Module` 은 `PlayerAwareModule.BuildStateFor` 구현 **또는** `engine.PublicStateMarker` 임베드로 `PublicStateModule` 명시적 opt-out 중 하나를 충족해야 함. registry boot 시점 panic 으로 강제 (F-sec-2 게이트). rollback env 는 33/33 gate 충족 후 Phase 19.1 PR-A 에서 제거됨 — 이제 gate 는 항상 활성. 상세 템플릿: `.claude/skills/mmp-module-factory/SKILL.md`

### 🔴 파일/함수 크기 제한 (유형별 티어)

| 유형 | 파일 하드 리밋 | 함수/컴포넌트 권장 |
|------|--------------|----------------|
| `.go` | **500줄** | 80줄 (table-driven 데이터 제외) |
| `.ts` / `.tsx` | **400줄** | 일반 60줄, JSX 컴포넌트 150줄 |
| `.md` | **500줄** (단 `CLAUDE.md`만 **200줄**) | - |

- **구현 전**: 한도 초과 예상 시 미리 분할 설계 (서브컴포넌트 추출 / 도메인별 API 파일 + 배럴 re-export / handler 분리 / service 인터페이스 쪼개기)
- **MD 분할 원칙**: 한도 초과(CLAUDE.md 200, 그 외 .md 500) 시 강제 요약하지 말고 상위는 **index + 링크**로 유지, 상세 내용은 `refs/<topic>.md`로 분리해 참조. 내용 보존 ≻ 줄 수 준수.
  - 예: `design.md`(index, ~300줄) → `refs/architecture.md`, `refs/data-model.md`, `refs/security.md`
  - 예: 긴 PR 스펙은 `refs/prs/pr-NN.md`로 분리 + 상위에서 링크
- **CLAUDE.md만 200줄 유지 이유**: 모든 세션에서 자동 로딩되므로 토큰 비용 직결. 그 외 MD는 LLM 로드가 선택적이라 분할 임계 완화 가능.
- **예외 허용**: 자동 생성 코드(sqlc/gen)는 예외. 테스트 table-driven 데이터는 카운트에서 제외. MD는 index 역할일 경우 한도 초과 OK(단 refs 분할 선검토).
- **서브에이전트**: 프롬프트에 파일/함수 한도 명시 필수
- **검증**: PR 리뷰 시 변경 파일 `wc -l` + 큰 함수 스캔

### 버전 관리
- Semantic Versioning, Conventional Commits (feat/fix/perf/docs/test/chore/ci)
- 브랜치: main + feat/*, fix/*, docs/*, chore/*, test/*, ci/*, perf/* (상세는 § Git 워크플로우)

## 🔴 Git 워크플로우 (main 브랜치 보호)

> **main 직접 push 금지.** 이 레포는 GitHub branch protection으로 PR 필수 + required status checks 필수가 걸려있다. bypass 권한이 있어도 사용하지 않는다. (현재 required 목록은 `gh api repos/<owner>/<repo>/branches/main/protection` 로 확인)

### 필수 규칙
1. **모든 변경은 feature 브랜치 + PR** — 문서·계획·설정 파일이라도 예외 없음. Phase 19 감사 shadow plan, CLAUDE.md 규칙 업데이트, memory/ 편집 전부 포함.
2. **`git push origin main` 금지** — 사용자가 명시적으로 "bypass 해라"라고 지시할 때만 예외.
3. **실수로 main에 직접 커밋했다면** — 즉시 사용자에게 보고하고 `git revert` + PR 재작업 여부를 확인. 임의 push 금지.
4. **PR 생성 전에 사용자 확인** — 브랜치 이름·커밋 범위를 먼저 보여주고 승인 받은 뒤 `gh pr create`.

### 브랜치 네이밍 (Conventional Commit prefix + 슬러그)
- `feat/<scope>-<slug>` · `fix/<scope>-<slug>` · `docs/<scope>-<slug>`
- `chore/<scope>-<slug>` · `test/<scope>-<slug>` · `ci/<scope>-<slug>` · `perf/<scope>-<slug>`
- scope 예: `phase-19`, `phase-18.8`, `rooms`, `editor`, `ws`, `ci-workflow`

### 워크플로우
```bash
# 1. 작업 시작 전 브랜치 생성
git checkout -b <type>/<scope>-<slug>

# 2. 커밋 (Conventional Commits, 한글 허용, 기존 스타일)
git add <선택 파일>
git commit -m "<type>(<scope>): <한글 요약>"

# 3. 푸시
git push -u origin <type>/<scope>-<slug>

# 4. PR 생성 (사용자 승인 후)
gh pr create --title "<type>(<scope>): <요약>" --body "$(cat <<'EOF'
## Summary
- ...

## Test plan
- [ ] ...
EOF
)"

# 5. 모든 required status checks 통과 확인 후 사용자에게 머지 요청
gh pr checks <N>  # 대기
# 사용자 승인 시: gh pr merge <N> --squash (또는 사용자 지정 방식)
```

### 제외 대상 (커밋 스코프)

**git이 추적하지만 런타임 변경은 커밋 금지** (plan-autopilot / mmp-pilot artifact):
- `.claude/active-plan.json` — 현재 active plan 포인터
- `.claude/run-lock.json` — 실행 lock
- `.claude/runs/**` — run artifact

**`.gitignore`에 이미 포함됨** (참고, 실수로 `-f` 추가 금지):
- `.claude/worktrees/`, `.worktrees/` — worktree 메타데이터·디렉터리
- `.claude/autopilot-state.json` — autopilot 상태
- `.pr-body.tmp` — PR 본문 임시

### 오염된 기록 (참고용)
- `d1262a7` (2026-04-17, chore(phase-19): shadow plan 초안) — 이 규칙 수립 전 main 직접 push (bypass 경고 발생). revert 여부는 사용자 결정.

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
- `mmp-plans` (290 docs) — 설계 문서, PR 스펙, 체크리스트, 아키텍처
- `mmp-memory` (64 docs, **canonical = repo `memory/`**) — 프로젝트 메모리, 피드백, 코딩 규칙. 2026-04-21 Phase 19 Residual PR-0에서 user home → repo 이전 (이전 user home 경로는 archival 스냅샷).
- `mmp-specs` (9 docs) — 브레인스토밍 결과, 엔진 재설계 스펙
- `mmp-v2-docs` (98 docs) — MMP v2 머더미스터리 호텔 UX 이식 원본 (base 브랜치)

> **🔴 쓰기 규칙**: 신규 memory 파일은 `memory/<name>.md` (repo 상대)로만 작성. user home `~/.claude/projects/.../memory/`는 auto-memory 시스템 기본값이지만 이 프로젝트에서는 **읽지 않음, 쓰지 않음** — drift 누적 방지. 상세: `memory/feedback_memory_canonical_repo.md`.

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

## Active Plan Workflow (mmp-pilot / /plan-go)

이 프로젝트는 `mmp-pilot` 스킬 + `/plan-go` 단일 진입점으로 phase 기반 개발을 관리합니다.
- 스킬: `.claude/skills/mmp-pilot/SKILL.md`
- 커맨드: `/plan-go` (plan-autopilot 대체, M3 cutover 2026-04-15 완료)
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
- `/plan-go` — wave 기반 자동 실행 + 단일 task + 재개 (mmp-pilot 통합)
- `/plan-status`, `/plan-tasks` — 진행 상태
- `/plan-resume` — `/clear` 후 컨텍스트 복원
- `/plan-stop` — 실행 중단 (state 저장)

### 필수 규칙
- **파일 크기 티어** (Go 500 / TS·TSX 400 / MD 200 — 초과 시 분할 필수)
- **STATUS 마커 형식 유지** (hook 파싱)
- **Wave 병렬 PR은 `isolation: "worktree"`**
- **Review는 4 병렬 agent** (security/perf/arch/test-coverage)
- **Fix-loop 최대 3회** → 초과 시 user 개입
- **Wave 머지 전 user 확인 1회**
- **Feature flag default off** 로 in-flight wiring 보호

## 🔴 graphify 필수 사용 규칙

> `graphify-out/graph.json` 존재 시 아키텍처·의존성·구조 질문은 **graphify 먼저**.
> 상세 정책·인덱스 상태·Makefile target·repo 갱신 규약: [`.claude/refs/graphify.md`](.claude/refs/graphify.md)

### 🔴 강제 규칙 (요약)
1. **"X는 어디서 쓰이나 / 의존성은"** → `Read graphify-out/GRAPH_REPORT.md` 또는 `/graphify query|explain` 먼저
2. **"A에서 B까지 흐름"** → `/graphify path "A" "B"` (홉별 relation + confidence)
3. **코드 수정 후** → `graphify update .` 필수 (AST-only, LLM 비용 0)
4. **Grep/Glob 허용 케이스**: 파일명·정확한 심볼 탐색, graphify로 대상 특정 후 line-level 확인
5. **전체 재인덱싱 (`graphify .`)은 Phase 종료 시점만** — 일상은 증분 `--update`. 결과물 repo 커밋 금지 (Phase 경계만 PR)

## 🔴 Opus ↔ Sonnet 위임 규칙 (advisor 패턴)

> Anthropic advisor tool 패턴의 Claude Code 응용 — Opus는 판단·지시·종합, Sonnet은 실제 실행.

### 모델 기준 (2026-04-19 이후)
- **메인**: `claude-opus-4-7` (Opus 4.7 1M context)
- **서브에이전트 기본**: `claude-sonnet-4-6` — **Sonnet 4.5 사용 금지** (4.6 출시 이후 구버전)
- **간단 검색·요약**: `claude-haiku-4-5-20251001`
- **복잡 판단 재위임**: `claude-opus-4-7` (security / architecture / 설계)

### 위임 대상
- **탐색·검색** (sonnet): `Explore`, `oh-my-claudecode:explore` — 대량 파일 grep/find
- **MD 작성** (sonnet): `oh-my-claudecode:writer`, `oh-my-claudecode:executor` — README·refs·progress
- **테스트·빌드 실행** (sonnet): `general-purpose`, `oh-my-claudecode:qa-tester` — verbose 출력은 서브에서 소화
- **단일 도메인 구현** (sonnet): `go-backend-engineer`, `react-frontend-engineer` 프로젝트 전문 agent
- **보안·아키텍처 판단** (opus): `security-reviewer`, `oh-my-claudecode:critic`, `oh-my-claudecode:security-reviewer`

### 위임 시 필수
- 프롬프트에 **"결과만 ≤200 단어로 보고"** 명시 (raw 로그 메인 유입 차단)
- Agent tool `model` 파라미터로 `claude-sonnet-4-6` 명시 (기본 inherit 대신)
- 병렬 가능한 독립 task는 `Task tool` 다중 호출 한 메시지에 묶기
- 파일 크기·함수 한도 프롬프트에 재명시 (서브는 CLAUDE.md 자동 로드 안 될 수 있음)

### Opus 직접 수행 유지
보안 판단, 아키텍처 결정, PR 생성 승인, user-facing 답변, 여러 서브에이전트 결과 종합.

**참고**: advisor tool(Anthropic API beta)은 Claude Code CLI에서 직접 사용 불가 — 위 패턴이 기능적 등가.
