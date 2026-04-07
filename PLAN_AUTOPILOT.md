# Plan Autopilot — 사용 가이드

이 프로젝트는 **plan-autopilot 스킬**로 phase 기반 개발을 관리합니다.
현재 활성 플랜: **Phase 8.0 — Engine Integration Layer** (2026-04-08 시작)

상세 문서: [docs/plan-autopilot-guide/](docs/plan-autopilot-guide/)

---

## 🚀 다음 세션 시작 시 (가장 먼저 할 일)

### 1. 세션 시작하면 자동으로
SessionStart hook이 실행되어 다음이 자동 주입됩니다:
- 현재 active plan 정보 (`.claude/active-plan.json` 기반)
- STATUS 마커 (wave, PR, 현재 task, blocker)
- Scope 파일 목록
- 다음 권장 action

→ **바로 작업 상태를 파악 가능.** 추가 조회 불필요.

### 2. 컨텍스트 더 필요하면
```
/plan-resume
```
design.md + plan.md + checklist.md + progress memory + git log을 한 번에 읽어 완전한 context 복원. `/clear` 직후에 특히 유용.

### 3. 현재 진행 상태 시각화
```
/plan-tasks     # Wave/PR 트리 + 진행률 %
/plan-status    # 빠른 snapshot + git 상태
```

### 4. 작업 재개
```
/plan-autopilot
```
Wave 기반 자동 실행 시작. Hook + sub-agent + 4 parallel reviewers가 전부 자동으로 돌아감.

---

## 🔧 새 프로젝트에 설치하는 법

### 전제 조건
- Claude Code v2.1.32+
- `jq`, `git`, `gh` (옵션)
- `~/.claude/skills/plan-autopilot/` 존재

### 설치 4단계 (~2분)

```bash
mkdir -p .claude/commands

# 1. 슬래시 커맨드 복사 (8개)
cp ~/.claude/skills/plan-autopilot/commands/*.md .claude/commands/

# 2. Hook 설정 (scripts는 절대 경로로 참조 → 복사 불필요)
cp ~/.claude/skills/plan-autopilot/templates/settings.template.json .claude/settings.json

# 3. 파이프라인 설정
cp ~/.claude/skills/plan-autopilot/templates/post-task-pipeline.template.json .claude/post-task-pipeline.json

# 4. CLAUDE.md에 워크플로우 섹션 추가
cat ~/.claude/skills/plan-autopilot/templates/CLAUDE-md-section.template.md >> CLAUDE.md
```

### 첫 플랜 시작
```
/plan-new "새 phase 이름"
```
→ brainstorming (Opus) + writing-plans + 템플릿 기반 docs 생성 → 초기 commit.

그 다음:
```
/plan-start docs/plans/YYYY-MM-DD-<slug>
/plan-autopilot
```

상세: [docs/plan-autopilot-guide/installation.md](docs/plan-autopilot-guide/installation.md)

---

## 📋 슬래시 커맨드 레퍼런스

| 커맨드 | 용도 |
|--------|------|
| `/plan-new <topic>` | 새 phase 저작 (brainstorming + plan-writing) |
| `/plan-start <dir>` | 플랜 활성화 |
| `/plan-autopilot` | Wave 자동 실행 루프 |
| `/plan-stop` | 실행 중단 + state 저장 |
| `/plan-status` | 빠른 상태 확인 |
| `/plan-tasks` | 진행률 트리 시각화 |
| `/plan-resume` | /clear 후 전체 context 복원 |
| `/plan-finish` | phase 종료 시 archive |

상세: [docs/plan-autopilot-guide/commands.md](docs/plan-autopilot-guide/commands.md)

---

## 🧠 Model 전략 (자동)

| Stage | 모델 | 이유 |
|-------|------|------|
| Brainstorming (`/plan-new`) | **Opus** | 복잡한 설계 판단 |
| 구현 (일반 PR) | Sonnet | Mechanical |
| 구현 (복잡 PR: actor/snapshot) | **Opus** | Concurrency 신중 |
| Security review | **Opus** | Critical |
| Architecture review | **Opus** | 설계 정합성 |
| Performance review | Sonnet | Pattern-based |
| Test coverage review | Sonnet | Pattern-based |
| Fix-loop | Sonnet | Mechanical |

Override: `.claude/post-task-pipeline.json` 의 `pr_model_overrides` 편집.

**비용 절감**: all-Opus 대비 ~50%, 품질 유지.

---

## 🔒 Hook 동작 (자동)

| Hook | 언제 | 효과 |
|------|------|------|
| SessionStart | 세션 시작 / `/clear` 직후 | STATUS + next task 주입 |
| UserPromptSubmit | 매 메시지 | 1줄 STATUS 주입 (~25 토큰) |
| PreToolUse (Edit/Write) | scope 파일 편집 직전 | design/checklist 읽기 전 **BLOCK** |
| PostToolUse (Edit/Write) | 편집 직후 | Checklist 갱신 reminder |
| PostToolUse (Read) | 매 Read | 읽은 파일 로그 (guard 용) |

활성 plan 있을 때만 발동. `/plan-finish` 후 자동 비활성.

상세: [docs/plan-autopilot-guide/hooks.md](docs/plan-autopilot-guide/hooks.md)

---

## 🎯 Phase 8.0 요약 (현재 작업)

**목적**: MMP v3 game engine integration 실서비스급 완성. 12 모듈 wired.

**Wave 구조**:
```
W0: PR-0 docs/infra  (완료)
W1: PR-1 ∥ PR-2        (병렬 ×2)
W2: PR-3
W3: PR-4 (패턴 레퍼런스)
W4: PR-5 ∥ PR-6 ∥ PR-7 ∥ PR-8  (병렬 ×4)
W5: PR-9 (observability)
```

**속도**: 순차 9T → 병렬 5T (~44% 단축)

**상세**: [docs/plans/2026-04-08-engine-integration/design.md](docs/plans/2026-04-08-engine-integration/design.md)

---

## 🚨 필수 규칙

1. **모든 .md 파일 <200줄** — 초과 시 `refs/` 분할 + index 패턴
2. **STATUS 마커 형식 유지** — hook 파싱용
3. **병렬 wave는 `isolation: "worktree"`** 필수
4. **Review = 4 parallel agents** 한 메시지에 배치
5. **Fix-loop max 3**, 초과 시 user 개입
6. **Wave merge 전 user 확인 1회**
7. **Feature flag default off**
8. **PreToolUse guard 우회 금지**

---

## 🆘 트러블슈팅

```bash
# Hook 수동 테스트
~/.claude/skills/plan-autopilot/scripts/plan-status.sh --compact
~/.claude/skills/plan-autopilot/scripts/plan-tasks.sh

# 읽기 로그 리셋 (PreToolUse guard 해제)
rm /tmp/claude-plan-read.log

# Active plan 유효성
jq . .claude/active-plan.json

# Autopilot state 확인
cat .claude/autopilot-state.json 2>/dev/null || echo "no paused state"
```

상세: [docs/plan-autopilot-guide/troubleshooting.md](docs/plan-autopilot-guide/troubleshooting.md)

---

## 📞 참조

- 스킬 정의: `~/.claude/skills/plan-autopilot/SKILL.md`
- 스킬 상세: `~/.claude/skills/plan-autopilot/README.md`
- 파일 구조: [docs/plan-autopilot-guide/file-structure.md](docs/plan-autopilot-guide/file-structure.md)
- 현재 Phase 디자인: [docs/plans/2026-04-08-engine-integration/design.md](docs/plans/2026-04-08-engine-integration/design.md)

**마지막 업데이트**: 2026-04-08 (Phase 8.0 PR-0)
