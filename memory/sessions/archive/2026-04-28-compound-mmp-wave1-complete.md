---
topic: "compound-mmp Wave 1 완료 + Wave 2 진입 준비"
phase: "compound-mmp PR-1 ~ PR-4 (Wave 1 완료)"
prs_touched: [PR-1 #144, PR-2 #145, PR-3 #146, PR-4 #147, recovery #148]
session_date: 2026-04-28
---

# Session Handoff: compound-mmp Wave 1 완료

## Decided
- **compound-mmp 플러그인 설계 확정** — 4단계 라이프사이클 (Plan → Work → Review → Compound). 외부 5 plugin 분석(Compound Engineering / Superpowers / Session-Wrap / Corca / OMC) 후 통합. 사용자 결정: 4단계 풀 파이프라인, repo `.claude/plugins/compound-mmp/`, TDD soft ask, wrap 균형형 자동화.
- **OMC 호출만, 재정의 X** — `oh-my-claudecode:executor/code-reviewer/security-reviewer/critic/test-engineer` 호출. compound-mmp 자체 신규 agent 4개 (automation-scout/learning-extractor/followup-suggester/duplicate-checker) + OMC document-specialist 호출 = wrap Phase 1 5 agent.
- **Handoff 형식 = markdown bullet 5섹션** (Decided/Rejected/Risks/Files/Remaining) — OMC team `.omc/handoffs/<stage>.md` cross-mode 호환. YAML frontmatter는 metadata만.
- **자동 디스패처 (dispatch-router.sh)** — UserPromptSubmit hook에서 한글/영문 키워드 분류 → 5단계 추천 (wrap > review > plan > cycle > work). 41/41 PASS on bash 3.2 + 5.x.
- **OMC magic keyword skip** — autopilot/ralph/ulw/ralplan/deep-interview/ai-slop-cleaner 시작 또는 word-boundary 포함 prompt는 OMC keyword-detector 우선.
- **자동 fix-loop 폐기** — post-task-pipeline.json v2: `manual_review_required.policy = halt_and_notify`. plan-autopilot 잔재 모두 제거 (PR-1 fix).

## Rejected
- ~~5 wrap agent 모두 신규 정의~~ → 4 신규 + OMC document-specialist 호출로 축소 (spike critic MAJOR #4 부분 수용)
- ~~OMC team mode wrapper만 사용~~ → 35% 중복도 측정으로 별도 plugin 정당성 입증 (spike A 항목)
- ~~Handoff YAML frontmatter 5필드~~ → markdown bullet 헤더로 변경 (OMC parser 호환 진짜 달성)
- ~~자동 fix-loop (post-task-pipeline v1 fix_loop)~~ → manual_review_required로 의미 반전 (anti-patterns #1 강제)
- ~~bash 4+ `${var,,}` lowercase 확장~~ → tr 사용 (macOS bash 3.2 호환)
- ~~plan-autopilot 자동 진행 부활~~ → checklist.md 직접 read + 수동 STATUS (사용자 명시 폐기 결정)

## Risks
- **skill-injector 직렬 실행 (`~/.claude/settings.json`)** — compound-mmp dispatch와 같은 UserPromptSubmit slot에 등록됨. 둘 다 additionalContext 주입 → 메인 컨텍스트가 결정. 충돌 검증 미수행 (PR-5에서 카논화 예정)
- **selection bias** — dispatch test 41/41 PASS는 author-curated. 실 사용자 hit rate는 75-80% 추정 (critic 측정). PR-10 dogfooding 30+ 샘플 측정 후 PR description 정정 필요
- **50줄 임계값 (stop-wrap-reminder)** — 실측 데이터 없이 임의 결정. PR-10 retrospective 측정 후 ENV var (`COMPOUND_WRAP_MIN_LINES`) tunable 검토
- **graphify-refresh `--phase` 실패 처리 미정의** — SKILL.md Step 7. 실패 시 stderr 표시 + 사용자 수동 retry 안내 명시 필요 (PR-5)
- **Phase 19 Residual W4 timing 충돌** — PR-9/PR-10 직전인데 compound-mmp Wave 2 진입 시 hook 활성화로 영향 가능 (TaskList #14)
- **command(compound-wrap.md) vs skill(wrap-up-mmp/SKILL.md) master 불명확** — 7단계 정보 2 location 중복. command를 thin pointer로 축소 검토 (PR-5)

## Files

### 신규 (main에 통합 완료)
```
.claude/plugins/compound-mmp/
├── .claude-plugin/plugin.json
├── README.md
├── agents/{automation-scout,duplicate-checker,followup-suggester,learning-extractor}.md
├── commands/compound-wrap.md
├── skills/wrap-up-mmp/SKILL.md
├── hooks/{dispatch-router,run-hook,stop-wrap-reminder,test-dispatch}.sh + hooks.json
├── refs/{anti-patterns,auto-dispatch,learning-quality-gate,lifecycle-stages,
│        post-task-pipeline-bridge,sim-case-a,spike-omc-overlap,
│        tdd-enforcement,wrap-up-checklist}.md
└── templates/{handoff-note-template,session-recall-template}.md
```

### 수정 (main)
- `.claude/post-task-pipeline.json` (218줄, repo root canonical, v2 - plan-autopilot 잔재 제거)

### 신규 디렉토리 (이번 세션)
- `memory/sessions/` (이 핸드오프 파일 — wrap-up Step 5-2 자동 생성 패턴)

### 미작성 (Wave 2 이후)
- `memory/MISTAKES.md` (PR-3 wrap Step 6 첫 사용 시 자동 생성)
- `memory/QUESTIONS.md` (PR-3 wrap Step 5 첫 사용 시 자동 생성)

## Remaining

### Wave 2 PR-5 (size hook + TDD soft ask)
- **Done**: `.claude/plugins/compound-mmp/hooks/pre-edit-size-check.sh` exec, PreToolUse(Edit|Write) 등록, `.go` 500/`.tsx` 400/`.md` 500/`CLAUDE.md` 200 차단, TDD soft ask integration. bats 단위 테스트 + CI gate (`.github/workflows/ci-hooks.yml`).
- **TaskList #14 entry 통합**: PR-5 시작 시 W4 timing 충돌 (Phase 19 Residual PR-9/10) 점검 단계 명시.
- **후속 카논화** (Wave 1 후속): PR-2 spike 표기 5→3 vs 5→4 정정, PR-3 50줄 임계값 ENV var, PR-4 skill-injector 직렬 실행 카논화, PR description hit rate "fixture pass rate" 표기.

### Wave 2 PR-6 (model guard + SessionStart inject)
- **Done**: `pre-task-model-guard.sh` (Sonnet 4.5 차단), `session-start-context.sh` (5 컨텍스트 + memory/sessions/ 최신 1개 inject), `templates/session-recall-template.md` 활성.

### 후속 PR (Wave 3/4)
- PR-7: `/compound-review` + post-task-pipeline 4-agent 브릿지 + P0–P3 라우팅
- PR-8: `/compound-plan` + qmd-recall 스킬 (`mmp-plans` vector_search)
- PR-9: `/compound-work` + worktree + TDD 가드 + 2-stage subagent review
- PR-10: `/compound-cycle` + 시뮬레이션 검증 (Case A: PR-2c handleCombine deadlock 재현, B: 파일 크기, C: Sonnet 4.5)

## Next Session Priorities

1. **Wave 2 PR-5 진입 — `pre-edit-size-check.sh` + TDD soft ask** (W4 timing 점검 entry 통합)
2. PR-5 작성 → branch `feat/compound-mmp/PR-5-size-tdd` (main 직접 분기)
3. critic 재re-review 패턴 활용 (PR-1/3/4에서 검증된 머지 차단 5건 fix → critic 재re-review → admin-merge)
4. memory/sessions/ 디렉토리 누적 시작 — duplicate-checker QMD vector_search 실측 calibration

## What we did

Wave 1 (4 PR + 1 recovery PR) 완료. 외부 5 plugin (Compound/Superpowers/Session-Wrap/Corca/OMC) 클론 분석 후 MMP v3 전용 통합 플러그인 scaffold + 4개 wrap agent + 7단계 wrap-up 시퀀스 + 100% hit rate 자동 디스패처 구축.

핵심 카논 16개 ref 파일로 정리 (anti-patterns 12개, auto-dispatch 5단계 분류, lifecycle 4단계 게이트, post-task-pipeline 4-agent 매핑, learning-quality-gate Q1/Q2/Q3, spike-omc-overlap 35% 중복도 분석 등).

4-agent + critic 재re-review 패턴으로 8 CRITICAL/HIGH 결함 해소 (plan-autopilot 잔재 제거, OMC handoff markdown 호환, git diff 측정 버그, bash 3.2 비호환, OMC magic keyword false positive, 부정문 양성 재시도 등).

## What blocked us

- GitHub PR base가 closed branch면 admin-merge 후 main에 코드 미통합. PR-3/4가 PR-2 base였는데 PR-2 squash 후 base deleted. 새 PR (#148) 만들어 main에 직접 머지로 복구.
- 다음 세션도 PR을 chain (PR-N base = PR-N-1 branch) 만들지 말고 모두 main 분기 권장. 또는 sequential admin-merge → main pull → 다음 PR 생성 패턴.

## Next session 첫 5초

- **가장 먼저 read**: 이 핸드오프 노트 + `.claude/plugins/compound-mmp/refs/lifecycle-stages.md` (4단계 게이트) + `refs/wrap-up-checklist.md` (7단계 카논)
- **미해결 사용자 결정**: 없음 (Wave 2 PR-5 즉시 진입 가능)
- **TaskList**: #14 (W4 timing 점검) PR-5 진입 시 처리
- **ImportError 위험**: bash 3.2 호환 검증 — 새 hook 작성 시 `${var,,}` 등 4+ 전용 문법 금지

## 카논 인용 cheat-sheet (Wave 2 작성 시)

| 룰 | 위치 |
|----|------|
| 4단계 진입/종료 게이트 | `refs/lifecycle-stages.md` |
| 7단계 wrap 시퀀스 | `refs/wrap-up-checklist.md` + `skills/wrap-up-mmp/SKILL.md` |
| 12 anti-patterns | `refs/anti-patterns.md` |
| TDD soft ask 정책 | `refs/tdd-enforcement.md` |
| 5단계 dispatch 분류 | `refs/auto-dispatch.md` |
| 4-agent post-task-pipeline 매핑 | `refs/post-task-pipeline-bridge.md` + `.claude/post-task-pipeline.json` |
| Learning Q-gate | `refs/learning-quality-gate.md` |
| OMC overlap 35% spike | `refs/spike-omc-overlap.md` |
| Sim Case A 카논 | `refs/sim-case-a.md` |
| 모델 alias (opus/sonnet/haiku) | `refs/lifecycle-stages.md` § OMC 호출 매핑 |
| Plan 본문 | `/Users/sabyun/.claude/plans/vivid-snuggling-pascal.md` |
