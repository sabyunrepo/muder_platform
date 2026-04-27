# Spike: OMC overlap analysis (2026-04-27, PR-2 진입 전)

## 분석 출처
- 실제 OMC marketplace: `/Users/sabyun/.claude/plugins/marketplaces/omc/` (v4.11.6 기준)
- 설치된 플러그인: `/Users/sabyun/.claude/plugins/oh-my-claudecode/`
- 캐시 + bridge 빌드: `/Users/sabyun/.claude/plugins/cache/omc/oh-my-claudecode/4.11.6/bridge/team-bridge.cjs`
- compound-mmp 현재 카논: `/Users/sabyun/goinfre/muder_platform/.claude/post-task-pipeline.json`, `/Users/sabyun/goinfre/muder_platform/.claude/plugins/compound-mmp/refs/wrap-up-checklist.md`
- 분석 시간: 2026-04-27 약 1h, read-only

## A) OMC team mode 중복도

OMC team mode (`/oh-my-claudecode:team`, `skills/team/SKILL.md`) 는 `team-plan -> team-prd -> team-exec -> team-verify -> team-fix (loop)` 5-stage 파이프라인이다. ralplan/autopilot 진입점도 동일 team을 호출한다 (`skills/ralplan/SKILL.md` step 8, `skills/autopilot/SKILL.md` Phase 4).

| 단계 매핑 | OMC team | compound-mmp | 중복도 |
|----------|---------|--------------|--------|
| 의도 회상·brainstorming | team-plan(`explore`+`planner`) — codebase 검색 위주 | `/compound-plan` + `qmd-recall` (mmp-memory vector_search) | 30% — OMC는 docs/plans 회상 X |
| 요구 게이트 | team-prd(`analyst` Open Questions) | (compound-mmp 미적용 — 사용자가 수동 phase 정의) | 0% (직교) |
| 실행 + worktree | team-exec(executor + git-worktree.ts) | `/compound-work` + superpowers:using-git-worktrees | 70% — worktree·subagent dispatch 거의 동일 |
| 4-agent 병렬 리뷰 | team-verify(`verifier`+`security-reviewer`+`code-reviewer`) — 3 agent | `/compound-review` post-task-pipeline.json (4 entry: security/perf/arch/test) | 60% — 매핑 가능하나 perf/test-coverage 지정·prompt 다름 |
| 실패 후 자동 fix | team-fix(executor 루프) | **명시적으로 폐기** (`anti-patterns.md` #1, post-task-pipeline.json `manual_review_required.policy = halt_and_notify`) | -100% (반대 정책) |
| Wrap / 학습 영구화 | (없음 — `release` skill만 release용) | `/compound-wrap` 7단계 + `memory/sessions/`, MISTAKES/QUESTIONS | 5% (직교) |
| P0–P3 라우팅 + Effort/Impact | (없음 — task-graph만) | followup-suggester agent | 0% (직교) |
| 자동 디스패처 (UserPromptSubmit) | OMC `keyword-detector.mjs` 가 `ralph/autopilot/team` magic keyword 검출 → ralplan gate | dispatch-router.sh가 `plan/work/review/wrap/cycle` 추천 | 50% — 메커니즘 동일, 키워드와 라우팅 대상이 다름 |
| TDD soft ask + size hook | (없음) | pre-edit-size-check.sh (PR-5) | 0% (직교) |

**최종 중복도**: ~35% (Work·Review 단계는 60–70% 겹침. Plan(QMD recall)·Wrap(7단계)·자동 fix 폐기 정책·P0–P3 라우팅·size/TDD hook은 직교)

**결론**: compound-mmp 정당성 **정당 (단, Work/Review 레이어는 OMC team을 wrap)**.
- team-fix 자동 루프는 PR-2c #107 사고 이후 폐기 정책이 카논 → OMC team을 그대로 호출하면 안티패턴 #1 위반. compound-mmp가 `manual_review_required.policy = halt_and_notify`로 가드하는 얇은 wrapper 가치는 명확.
- Plan/Wrap/dispatch-router/size hook은 OMC에 등가물 없음.
- `/compound-work` 내부에서는 OMC `team-exec` 또는 `executor` agent를 직접 호출(=wrapper)하는 방식이 깔끔. team-verify는 사용 X (post-task-pipeline.json 카논이 이미 4-agent 직접 정의).

## B) wrap agent 대체 매트릭스

| compound-mmp agent | OMC 후보 | verdict | 이유 |
|--------------------|---------|---------|------|
| **doc-curator** (MEMORY.md/CLAUDE.md/refs 갱신 후보) | `oh-my-claudecode:writer` (haiku, Read/Write/Edit/Bash) 또는 `document-specialist` (sonnet, read-only chub) | **HYBRID** | writer는 write 권한이 있어 안티패턴 #12 위반 (분석 전용 원칙). document-specialist는 read-only지만 Write/Edit `disallowedTools` 명시 → 권한 적합. 단, prompt 본문이 "외부 docs 우선·project-specific 보조"라 MMP의 `memory/` canonical + QMD vector_search 워크플로우는 prompt 주입으로 보강 필요. → OMC `document-specialist` 호출 + Step 1 git scan + canonical 경로 강제 prompt context 주입. 신규 agent .md 정의는 불필요. |
| **automation-scout** (skill/command/hook 신규 자동화 기회) | `oh-my-claudecode:analyst` (opus, Open Questions 출력) 또는 `architect` | **KEEP_NEW** | analyst는 "요구 gap 분석", architect는 "코드 아키텍처". "자동화 기회 탐지" (.claude/skills, hooks, commands 빈틈)는 두 agent 어디에도 매핑 안 됨. 추가로 sonnet-4-6 모델 + Read/Glob/Grep만 필요 → OMC에 동일 spec 없음. 신규 정당. |
| **learning-extractor** (TIL·실수·발견) | `oh-my-claudecode:learner` (skill, level 7) | **HYBRID** | learner는 **agent가 아니라 skill** (`skills/learner/SKILL.md`). "Quality Gate: 5분 안에 Google 가능?/이 codebase 한정?/실제 디버그 노력?" 3-question gate는 그대로 재사용 가치 큼. 다만 storage 위치가 `.omc/skills/<name>.md` (project) 또는 `~/.claude/skills/omc-learned/` → MMP 카논 `memory/MISTAKES.md`·`memory/sessions/` 와 충돌. → 신규 `compound-mmp:learning-extractor` agent를 정의하되 prompt 안에 OMC learner의 Quality Gate를 인용. |
| **followup-suggester** (P0–P3 + Effort/Impact 매트릭스) | `oh-my-claudecode:critic` (Pre-Mortem, Devil's Advocate) 또는 `analyst` | **KEEP_NEW** | critic은 "이 plan이 실패할 시나리오", analyst는 "현재 plan의 gap". P0–P3 우선순위 + Effort(S/M/L) × Impact(low/med/high) 매트릭스 출력은 둘 다 출력 형식이 다름. critic 호출 + post-processing prompt 가능하나 매번 prompt 인라인이 길어짐 → 전용 agent .md 1개 유지가 cleaner. |
| **duplicate-checker** (QMD vector_search 중복 검증) | (없음) | **KEEP_NEW** | OMC 어떤 agent도 `mcp__plugin_qmd_qmd__vector_search`를 사용 안 함. document-specialist는 chub/Context7 백엔드 전용. haiku-4-5 + Read만 필요 → 가벼운 신규 정의가 정당. wiki skill에 `wiki_query`가 있지만 `.omc/wiki/` 저장소 한정. |

**최종 결정**: 신규 agent 5개 → **3개**로 축소.
- doc-curator → OMC `document-specialist` 호출 (compound-mmp wrap-up skill에서 prompt 주입)
- learning-extractor, followup-suggester, duplicate-checker → 신규 `compound-mmp:*` agent 정의 유지
- automation-scout → 신규 정의 유지 (직접 매핑 OMC 없음)

(critic MAJOR #4 부분 수용 — 5개 중 1개 OMC 대체)

## C) OMC 기존 wrap 기능

| 기능 | OMC 제공 | 어디 | compound-mmp에 통합 가능? |
|------|---------|-----|-------------------------|
| 종료 시점 자동 분석 (`SessionEnd`) | yes | `hooks/hooks.json` `SessionEnd` 두 hook + `Stop` 3 hook (`session-end.mjs`, `wiki-session-end.mjs`, `context-guard-stop.mjs`, `persistent-mode.cjs`, `code-simplifier.mjs`) | 부분 — OMC는 wiki 자동 lint·persistent-mode 위주. compound-mmp 7단계 (P0–P3 + duplicate check) 와 동작이 달라 SessionEnd hook 추가는 OMC와 충돌 가능 → `/compound-wrap` 명시 호출 권장 (현재 카논 유지) |
| MISTAKES.md / QUESTIONS.md 학습 영구화 | partial | `learner` skill (`.omc/skills/<name>.md`), `remember` skill (project memory), `wiki_ingest` (`.omc/wiki/`), `writer-memory` (`.writer-memory/memory.json`) | OMC는 카테고리 다른 4개 storage. MMP는 `memory/MISTAKES.md`/`QUESTIONS.md` 단일 → 새 `compound-mmp:learning-extractor` 가 OMC learner Quality Gate 차용 + MMP 경로로 출력 (B 항목 결정과 일치) |
| 핸드오프 노트 자동 생성 | partial | `team` skill의 `.omc/handoffs/<stage>.md` (10–20 lines 결정·rejected·risks·files·remaining 5필드) | **유사 카논 도입 권장** — `wrap-up-checklist.md` Step 5의 frontmatter (topic/phase/prs_touched/key_decisions/next_session_priorities) 와 거의 동형. 형식 통일 검토 (PR-3 작업) |
| 4-agent 리뷰 pipeline | partial | `team-verify` 단계 (`verifier` 필수, `security-reviewer` 옵션, `code-reviewer` 옵션) — 최대 3 agent | **No 1:1 매핑** — compound-mmp post-task-pipeline.json 은 4 카테고리(security/perf/arch/test) 명시 + parallel_group 카논. team-verify로 대체 시 perf·test-coverage 누락. 현재 카논 유지 권장 |
| Pre-mortem / Devil's Advocate | yes | `critic` agent + `ralplan --deliberate` (3 시나리오 + expanded test plan) | followup-suggester 와 일부 겹침. ralplan 자체를 `/compound-plan` 안에서 옵션 호출하는 쪽이 효율적 (PR-8 후보 변경 검토) |
| Wiki 자동 lint·orphan 검출 | yes | `wiki_lint`, `wiki-pre-compact.mjs`, `wiki-session-end.mjs` | 직교 — MMP는 QMD가 동일 역할. 활성화 시 충돌 가능 → 비활성 권장 |
| Project Session Manager (worktree + tmux) | yes | `psm` skill (`omc teleport #123`) | `/compound-work` 가 superpowers:using-git-worktrees 사용 → psm 도입은 over-engineering. 현재 유지 |

## 권장 사항 (PR-2 설계 변경)

1. **wrap agent 5개 → 3개로 축소.** `compound-mmp:doc-curator` 정의 삭제. `/compound-wrap` Step 2에서 `oh-my-claudecode:document-specialist` 를 호출하되 prompt에 (a) Step 1 git scan 결과, (b) `memory/` canonical 경로, (c) MMP CLAUDE.md/refs 카논 매트릭스 위치, (d) "Write 권한 없음. 후보만 출력" 명시 주입. 이 변경은 critic MAJOR #4 부분 수용이며 plugin agent 유지비 1개 감소.
2. **learning-extractor prompt에 OMC `skills/learner/SKILL.md` Quality Gate 인용.** 5분 Google 가능 / codebase 한정 / 디버그 노력 3-question gate 그대로 차용. 동일 정의 중복 작성 X — `refs/learning-quality-gate.md` 1줄로 인용만.
3. **handoff frontmatter 5필드 (Decided/Rejected/Risks/Files/Remaining) 와 wrap-up Step 5 frontmatter 통합 검토.** 현재 wrap-up은 4필드 (topic/phase/prs_touched/key_decisions/next_session_priorities). OMC 형식이 더 풍부함 → PR-3에서 5필드로 확장하면 OMC team과 cross-mode 호환 (직접 호출 X여도 형식 통일이 미래 통합 리스크 감소).
4. **`/compound-plan` 옵션으로 OMC `ralplan --deliberate` 호출 검토 (PR-8 변경).** 사용자가 high-risk phase 시 `--ralplan` 플래그 → ralplan consensus 진입 후 결과를 `/compound-plan` 후속 단계로 흡수. followup-suggester 의 일부 책임 (pre-mortem) 이 ralplan에 위임됨.
5. **자동 fix-loop 절대 금지 carve-out 보강.** OMC team mode를 `/compound-work` 가 wrap 시 `team-fix` stage 진입 차단 (max_fix_loops=0 강제 또는 ralplan 진입을 통한 우회 금지). `anti-patterns.md` #1 에 이 carve-out 명시 추가.
