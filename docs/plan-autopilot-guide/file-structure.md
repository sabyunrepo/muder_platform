# 파일 구조 상세

> 부모: [../../PLAN_AUTOPILOT.md](../../PLAN_AUTOPILOT.md)

## 스킬 (`~/.claude/skills/plan-autopilot/`)

프로젝트와 독립적인 user-level 스킬. 모든 프로젝트에서 재사용.

```
~/.claude/skills/plan-autopilot/
├── SKILL.md (132줄)                   # 스킬 정의 + frontmatter
├── README.md (155줄)                  # 상세 사용법
├── refs/                              # 카테고리별 상세 (각 <200줄)
│   ├── authoring.md                   # /plan-new 워크플로우
│   ├── execution.md                   # /plan-autopilot 실행 로직
│   ├── commands.md                    # 커맨드 카탈로그
│   ├── templates.md                   # 템플릿 설명
│   ├── hooks.md                       # Hook 설정/디버깅
│   ├── pipeline-config.md             # 파이프라인 스키마
│   └── model-strategy.md              # Opus/Sonnet 선택 + 스킬 매핑
├── scripts/                           # bash 헬퍼
│   ├── plan-status.sh                 # STATUS 추출 (compact/verbose)
│   ├── plan-tasks.sh                  # 진행률 트리 시각화
│   ├── plan-guard.sh                  # PreToolUse 차단
│   ├── plan-remind.sh                 # PostToolUse 리마인더
│   ├── plan-track-reads.sh            # Read 로거
│   ├── run-pipeline.sh                # 파이프라인 stage 실행
│   ├── autopilot-loop.sh              # 상태 관리 helper
│   └── plan-wave.sh                   # Wave manifest + validation
├── templates/                         # 파일 템플릿
│   ├── active-plan.template.json      # 플랜 pointer 스켈레톤
│   ├── post-task-pipeline.template.json  # 파이프라인 기본값
│   ├── settings.template.json         # 4 hook 설정
│   ├── design.index.template.md       # design.md index
│   ├── plan.index.template.md         # plan.md index
│   ├── checklist.index.template.md    # checklist + STATUS 마커
│   ├── STATUS-marker.template.md      # STATUS 스니펫
│   └── CLAUDE-md-section.template.md  # CLAUDE.md 섹션
└── commands/                          # 슬래시 커맨드 정의
    ├── plan-new.md
    ├── plan-start.md
    ├── plan-finish.md
    ├── plan-status.md
    ├── plan-tasks.md
    ├── plan-autopilot.md
    ├── plan-stop.md
    └── plan-resume.md
```

**총 파일 수**: ~36개
**모든 .md 파일 <200줄** (Claude Code 스킬 best practice)
**Scripts는 절대 경로로 참조** (프로젝트 복사 불필요)

## 프로젝트 (`<project>/.claude/`)

프로젝트별 설정. 버전 관리 대상 (단, `autopilot-state.json` 제외).

```
<project-root>/.claude/
├── active-plan.json               # 현재 활성 plan pointer
├── post-task-pipeline.json        # 파이프라인 설정 (커스터마이즈)
├── settings.json                  # 4 hooks
├── commands/                      # 슬래시 커맨드 복사본
│   ├── plan-new.md
│   ├── plan-start.md
│   ├── plan-finish.md
│   ├── plan-status.md
│   ├── plan-tasks.md
│   ├── plan-autopilot.md
│   ├── plan-stop.md
│   └── plan-resume.md
├── archived_plans/                # 완료된 plan 보관 (히스토리)
│   └── <plan-id>.json
└── autopilot-state.json           # (생성됨) 실행 중 상태 — .gitignore
```

**설치 방법**: 슬래시 커맨드 복사 + settings.json + post-task-pipeline.json. 스크립트는 복사하지 않음 (절대 경로 참조).

## 현재 Phase 문서 (예: Phase 8.0)

```
docs/plans/2026-04-08-engine-integration/
├── design.md (115줄)              # 설계 index
├── plan.md (~130줄)               # 실행 계획 index
├── checklist.md (~70줄)           # STATUS 마커 + wave 체크리스트
└── refs/                          # 상세 문서 (각 <200줄)
    ├── scope-and-decisions.md     # 7대 결정 상세
    ├── architecture.md            # 컴포넌트 + 다이어그램
    ├── data-flow.md               # 주요 흐름도
    ├── persistence.md             # Redis 스냅샷 + 복구
    ├── execution-model.md         # Wave DAG + 병렬 실행
    ├── observability-testing.md   # 메트릭 + 테스트 + 에러
    ├── pr-0-docs-infra.md         # PR별 task 상세
    ├── pr-1-skeleton.md
    ├── pr-2-hub-lifecycle.md
    ├── pr-3-base-handler.md
    ├── pr-4-reading-wired.md
    ├── pr-5-core-modules.md
    ├── pr-6-progression-modules.md
    ├── pr-7-snapshot-restore.md
    ├── pr-8-game-start-api.md
    └── pr-9-observability.md
```

**원칙**:
- 모든 파일 **<200줄**
- `design.md`, `plan.md`, `checklist.md` 는 index 역할 (전체 구조 요약 + refs/ 맵)
- 상세 내용은 `refs/<topic>.md` 또는 `refs/pr-N-*.md` 로 분할
- Index에서 refs/ 파일로 명시적 링크

## 메모리 (`~/.claude/projects/<proj-hash>/memory/`)

프로젝트별 persistent memory (세션 간 유지).

```
memory/
├── MEMORY.md                           # 인덱스 (~150 lines max, always loaded)
├── project_phase80_plan.md             # Phase 8.0 정적 결정사항
├── project_phase80_progress.md         # Phase 8.0 진행 상황 (동적, 갱신됨)
├── project_phases.md                   # 전체 phase 상태
├── project_phase77_followups.md        # Phase 7.7 후속 작업
└── ... (기타 프로젝트 메모리)
```

**plan-autopilot 관련**:
- `project_phase80_plan.md` — brainstorming 확정 사항, 변경 금지
- `project_phase80_progress.md` — wave/PR 진행 추적, 각 PR 머지 후 갱신
- MEMORY.md에 `project_phase80_*.md` 포인터 존재

## 런타임 파일 (버전 관리 제외)

```
/tmp/claude-plan-read.log           # PreToolUse guard 용 읽기 로그
<project>/.claude/autopilot-state.json  # 일시정지 상태 (/plan-stop 시)
<project>/.pr-body.tmp              # 임시 PR body
```

모두 `.gitignore` 에 추가 권장.

## 데이터 흐름 (파일 간 관계)

```
                ┌──────────────────────┐
                │ .claude/active-plan  │  ← 단일 진실 (Single Source of Truth)
                │     .json            │
                └──────────┬───────────┘
                           │ (읽음)
          ┌────────────────┼────────────────┐
          ↓                ↓                ↓
   Hooks (4개)      Slash Commands      Scripts
   (scripts)        (.claude/commands)   (plan-*.sh)
          │                │                │
          ↓                ↓                ↓
   STATUS injection   User-invoked     Support scripts
                           │
                           ↓
                  docs/plans/<phase>/
                  ├ design.md (index)
                  ├ plan.md (index)
                  ├ checklist.md (STATUS marker)
                  └ refs/
                           │
                           ↓
                  memory/project_phase*_*.md
                  (persistent across sessions)
```

## 파일 수정 권한 요약

| 파일 | 누가 수정 | 언제 |
|------|----------|------|
| `~/.claude/skills/plan-autopilot/**` | 스킬 개발자 | 업그레이드 시 |
| `.claude/commands/*.md` | `/plan-new`, 설치 스크립트 | 설치 + 스킬 업그레이드 |
| `.claude/settings.json` | 사용자 (수동) | 설치 1회 |
| `.claude/post-task-pipeline.json` | 사용자 (수동) | 프로젝트 커스터마이즈 |
| `.claude/active-plan.json` | `/plan-start`, autopilot | 플랜 전환, 진행 갱신 |
| `.claude/autopilot-state.json` | `/plan-stop` | 일시정지 시 |
| `docs/plans/<phase>/*.md` | `/plan-new`, 사용자, sub-agents | Phase 작업 중 |
| `memory/project_phase*.md` | 사용자, sub-agents | 각 PR 머지 후 |
