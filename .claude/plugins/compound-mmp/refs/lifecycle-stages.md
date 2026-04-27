# compound-mmp 4단계 라이프사이클 카논

```
Phase (예: Phase 19 Residual)
 │
 ├─ Plan ─ /compound-plan <topic>
 │   진입: 사용자가 새 phase 의도 표명 (자동 X)
 │   액션: superpowers:brainstorming + writing-plans 호출,
 │         qmd-recall 스킬로 mmp-plans 컬렉션에서 유사 phase 5건 자동 회상
 │   산출: docs/plans/<YYYY-MM-DD>-<topic>/checklist.md 초안만
 │   종료 게이트: 사용자 명시 "go" + checklist.md 머지
 │
 ├─ Work ─ /compound-work [pr-id]
 │   진입: feature 브랜치 + worktree (superpowers:using-git-worktrees)
 │   액션: tdd-mmp-go 또는 tdd-mmp-react 활성,
 │         oh-my-claudecode:executor (model 명시 sonnet-4-6) 위임
 │         pre-edit-size-check + pre-task-model-guard hook 활성
 │   산출: 구현 + 테스트 + 로컬 green
 │   종료 게이트: go test -race 또는 vitest 통과
 │
 ├─ Review ─ /compound-review [pr-id]
 │   진입: PR open 직전
 │   액션: .claude/post-task-pipeline.json after_pr 4 entry 병렬 spawn:
 │         - review-security: oh-my-claudecode:security-reviewer (opus)
 │         - review-perf: oh-my-claudecode:code-reviewer (sonnet)
 │         - review-arch: oh-my-claudecode:critic (opus)
 │         - review-test: oh-my-claudecode:test-engineer (sonnet)
 │   산출: docs/plans/<phase>/refs/reviews/<pr-id>.md (P0–P3 분류)
 │   종료 게이트: HIGH 0건 또는 사용자 승인 (자동 fix-loop 금지)
 │
 └─ Compound ─ /compound-wrap [--session|--wave|--phase]
     진입: 세션·wave·phase 종료
     액션: 7단계 wrap 시퀀스 (skills/wrap-up-mmp/SKILL.md)
     산출: memory/sessions/<date>-<topic>.md, MISTAKES/QUESTIONS append, 핸드오프
     종료 게이트: QMD 자동 재인덱싱
```

## 진입/종료 게이트 검증

| 단계 | 진입 조건 | 종료 조건 | 게이트 위반 시 |
|------|----------|----------|---------------|
| Plan | 사용자 명시 의도 | checklist.md 머지 | 자동 진행 X (plan-autopilot 폐기) |
| Work | branch + worktree 존재 | 로컬 테스트 green | 4-agent에서 잡힐 수 있음 |
| Review | post-task-pipeline.json 존재 (repo root) | HIGH 0건 또는 사용자 승인 | hotfix PR 1회 허용 |
| Compound | wrap 트리거 (수동 또는 dispatch) | QMD reindex 완료 | 다음 SessionStart에서 핸드오프 inject |

## OMC 호출 매핑 (재정의 X, 호출만)

| compound 단계 | OMC agent | 모델 |
|---------------|-----------|------|
| Work 구현 | `oh-my-claudecode:executor` | sonnet-4-6 |
| Review 보안 | `oh-my-claudecode:security-reviewer` | opus-4-7 |
| Review 성능 | `oh-my-claudecode:code-reviewer` | sonnet-4-6 |
| Review 아키텍처 | `oh-my-claudecode:critic` | opus-4-7 |
| Review 테스트 | `oh-my-claudecode:test-engineer` | sonnet-4-6 |
| Plan brainstorm | `superpowers:brainstorming` 스킬 | (스킬, 모델 무관) |
| Plan 작성 | `superpowers:writing-plans` 스킬 | (스킬) |
| Work 워크트리 | `superpowers:using-git-worktrees` 스킬 | (스킬) |

## compound-mmp 신규 agent (모두 wrap 전용, Read/Glob/Grep만)

| agent | 모델 | 역할 |
|-------|------|------|
| `compound-mmp:doc-curator` | sonnet-4-6 | MEMORY.md/CLAUDE.md/refs 갱신 후보 추출 |
| `compound-mmp:automation-scout` | sonnet-4-6 | 신규 자동화 기회 탐지 |
| `compound-mmp:learning-extractor` | sonnet-4-6 | TIL·실수·발견 추출 (MISTAKES 후보) |
| `compound-mmp:followup-suggester` | sonnet-4-6 | P0–P3 + Effort/Impact 매트릭스 |
| `compound-mmp:duplicate-checker` | haiku-4-5 | QMD vector_search 중복 검증 |
