# compound-mmp

MMP v3 전용 Claude Code 플러그인. **Plan → Work → Review → Compound** 4단계 라이프사이클을 phase/wave/PR 워크플로우에 끼워 넣는 얇은 조정 레이어.

> 외부 분석 보고서(Compound Engineering / Superpowers / Session-Wrap)에서 검증된 패턴 3가지를 MMP v3 인프라(QMD MCP, graphify, OMC 4-agent, post-task-pipeline)에 맞춰 통합.

## 철학

- **Compound** — Plan-Work-Review-Compound 순환으로 매 phase마다 지식이 영구 자산화된다 (`memory/sessions/`, `MEMORY.md` append, `MISTAKES.md`/`QUESTIONS.md`)
- **Session-Wrap** — 세션 종료 시 5 agent(병렬 4 + 순차 1)가 분석을 수행해 다음 세션 핸드오프 노트를 자동 생성
- **Superpowers (변형)** — TDD soft ask + subagent 2-stage review. 새 SQLite 인덱스 X — QMD `mmp-memory` 컬렉션 재활용

## 5개 슬래시 커맨드

| 명령 | 단계 | 핵심 동작 |
|------|------|----------|
| `/compound-plan <topic>` | Plan | QMD vector_search 회상 → brainstorming → checklist 초안 |
| `/compound-work [pr-id]` | Work | worktree + TDD 가드 + OMC executor 위임 |
| `/compound-review [pr-id]` | Review | post-task-pipeline.json 4-agent 병렬 + P0–P3 라우팅 |
| `/compound-wrap [--session\|--wave\|--phase]` | Compound | 7단계 wrap 시퀀스 |
| `/compound-cycle` | (overview) | 현재 단계 dry-run 대시보드 |

## 자동 디스패처 (슬래시 X여도 작동)

`hooks/dispatch-router.sh`이 `UserPromptSubmit`에서 사용자 프롬프트를 분석해 `plan/work/review/wrap/cycle` 자동 추천. 스킬 description에도 트리거 단어를 명시화해 이중 안전장치.

자세한 동작은 `refs/auto-dispatch.md` 참고.

## 안전 정책

핵심 6개 enforcement 위치. 전체 12개 anti-pattern 목록은 `refs/anti-patterns.md` 참조.

| 정책 | enforcement 위치 (PR-N) |
|------|------------------------|
| 파일 크기 한도 (Go 500/TS·TSX 400/MD 500/`CLAUDE.md` 200) | `hooks/pre-edit-size-check.sh` (PR-5) |
| Sonnet 4.5 차단 | `hooks/pre-task-model-guard.sh` (PR-6) |
| TDD soft ask | `hooks/pre-edit-size-check.sh` 통합 (PR-5) — 자세한 정책은 `refs/tdd-enforcement.md`, `skills/tdd-mmp-go\|react/SKILL.md` |
| OMC namespace 격리 | refs/lifecycle-stages.md (호출 매핑) |
| `~/.claude/claude.md` OMC marker 영역 보호 | `refs/anti-patterns.md` #8 |
| plan-autopilot 자동 진행 부활 금지 | `refs/anti-patterns.md` #1, post-task-pipeline.json v2 |

## 레퍼런스

- 7단계 wrap 시퀀스: `refs/wrap-up-checklist.md` (skill은 PR-3)
- 4-agent 호출 카논: `.claude/post-task-pipeline.json` (repo root, after_pr)
- Sim Case A 카논: `refs/sim-case-a.md`
- 외부 분석 결과: plan 문서 (로컬 전용 — `<!-- external: ~/.claude/plans/vivid-snuggling-pascal.md, 공유 불가 -->` Appendix A)
