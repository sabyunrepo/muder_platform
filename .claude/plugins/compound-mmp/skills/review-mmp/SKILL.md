---
name: review-mmp
description: |
  PR 생성 *직전* (gh pr create 이전, 로컬 diff 기준) 4-agent 병렬 리뷰의 진입 게이트. compound-mmp 4단계 라이프사이클의 Review 단계 (Plan→Work→Review→Compound).
  자동 활성화 트리거: `/compound-review` 명시 호출, "리뷰", "검토", "PR 전 확인", "병합 전 체크", "4-agent" 등 한글/영문 키워드.
  PR-2c #107 사고 (4-agent 스킵 → handleCombine deadlock 누락) 이후 강제 정책의 SKILL 진입점. 카논 위치: refs/post-task-pipeline-bridge.md, commands/compound-review.md.
allowed-tools: Bash, Read, Glob, Grep, Task
---

# review-mmp — 4-agent 병렬 리뷰 진입 게이트

`/compound-review` 슬래시 커맨드의 패턴 SKILL. `wrap-up-mmp` SKILL 패턴 대칭 — 슬래시 커맨드는 실행 시퀀스, SKILL은 호출 정책·anti-pattern·fallback 매핑을 담당.

> **카논 single source**: `refs/post-task-pipeline-bridge.md` (4-agent 매핑 + 호출 타이밍) + `commands/compound-review.md` (실행 시퀀스) + `.claude/post-task-pipeline.json` (`before_pr` prompt template) + `refs/mandatory-slots-canon.md` (review 단계는 슬롯 없음 명시 — drift 방지).
>
> **2026-05-01 타이밍 변경**: `after_pr` → `before_pr`. PR 생성 직후 호출에서 `gh pr create` 직전 호출로 이동. CI 1회만 돌게 push 전에 fix-loop 완료. PR-2c 안전망 효과는 동일.

## 4-agent 매핑 (post-task-pipeline.json `before_pr.review-*`)

| 영역 | OMC agent | 모델 | 역할 |
|------|-----------|------|------|
| security | `oh-my-claudecode:security-reviewer` | opus | OWASP Top 10, 인증/인가, secret 누설 |
| performance | `oh-my-claudecode:code-reviewer` | sonnet | 알고리즘·메모리·동시성·DB 쿼리 |
| architecture | `oh-my-claudecode:critic` | opus | SOLID, 설계 drift, ADVERSARIAL pre-mortem |
| test | `oh-my-claudecode:test-engineer` | sonnet | 커버리지·edge case·table-driven 강제 |

> **agent name 카논**: `critic` (NOT `architect`) — `compound-review.md` L87 정정 + `refs/post-task-pipeline-bridge.md` § 정정. 본 표가 단일 source.

## OMC fallback 매핑 (user-home plugin 미설치 환경)

본 repo는 `oh-my-claudecode:*`를 user-home(`~/.claude/plugins/`)에 둔다. 신규 클론·CI 환경에서 OMC 미가시 시 fallback:

| OMC agent | fallback subagent_type | 모델 |
|-----------|----------------------|------|
| `oh-my-claudecode:security-reviewer` | `general-purpose` | opus |
| `oh-my-claudecode:code-reviewer` | `general-purpose` | sonnet |
| `oh-my-claudecode:critic` | `superpowers:code-reviewer` | opus |
| `oh-my-claudecode:test-engineer` | `general-purpose` | sonnet |

## 진입 조건 (when to invoke)

- **PR 생성 직전** (정상 진행) — 로컬 commit 완료 + `gh pr create` 직전. 4-agent round-1 spawn (로컬 diff 기준) → HIGH 발견 시 같은 브랜치에서 fix → round-2 검증 → HIGH 0 도달 시 `git push -u` + `gh pr create` → CI 1회 → admin-merge.
- **PR-2c 같은 reactive 검증** — sim-case-a 재현 (`refs/sim-case-a.md`)
- **사용자 명시 호출** — `/compound-review PR-N`

## 호출 시퀀스 (메인 컨텍스트, command와 중복 없이 정책만)

### round-1: 4-agent 동시 spawn (single message)

`commands/compound-review.md` § 4 imperative iterate에 따라 helper.payload[]를 한 메시지의 **N Task tool 동시 호출**로 spawn. `run_in_background=true` 권장 — 4 결과 비동기 수신.

### HIGH 게이트 (CRITICAL)

- HIGH 0건 → `git push -u` + `gh pr create` 진행
- HIGH ≥1건 → **사용자 결정 대기** (자동 fix-loop 절대 금지, anti-pattern)
- 사용자가 "즉시 수정" 결정 → 메인이 같은 브랜치에서 직접 수정 → round-2 (영향 영역 agent만) 재spawn → 재검증
- 사용자가 "PR 생성 후 별도 PR 이월" 결정 → carry-over append → `git push -u` + `gh pr create` → admin-merge

### round-2: 영향 영역만 재검증

round-1 HIGH 영역의 agent만 재spawn. 예: HIGH-A1/A2/A3는 arch 영역 → critic만 재spawn. 4 agent 전부 재호출은 토큰 낭비.

## Anti-pattern

- ❌ HIGH 발견 시 자동 fix-loop — PR-2c #107 사고 패턴 재현 (refs/anti-patterns.md)
- ❌ 4 agent 순차 spawn (single message에서 4 Task 동시 spawn 카논)
- ❌ round-2에서 4 agent 전부 재호출 (영향 영역만)
- ❌ `architect` 이름 사용 (카논은 `critic`)
- ❌ admin-merge 후 review skip — Auto mode + CI admin-skip 정책에서도 review 선행 (memory/feedback_4agent_review_before_admin_merge.md)
- ❌ `gh pr create` 후 review (구 카논, CI 2회 비효율) — push 전에 round-1 + fix 완료가 카논. 이미 PR 만든 뒤 reactive 검증은 `sim-case-a` 같은 회귀 시뮬에 한정.
- ❌ Sonnet 4.5 모델 사용 — `pre-task-model-guard.sh` PreToolUse hook이 차단

## carry-over 정책

round-1+round-2에서 식별된 MED/LOW는 **다음 PR piggyback** 또는 **별도 hygiene PR**로 분산. 본 SKILL은 결정 X — 메인 컨텍스트가 followup-suggester(`/compound-wrap` Step 2-3) 권고를 따라 분배.

## 검증

- `test-compound-review-dry-run.sh` 27 case (PR-7 fixture) — JSON contract + 4-agent 매핑 + injection 거부
- `sim-case-a.md` PR-2c 재현 — HIGH ≥1 검출 시 4-agent 정상 작동 확인
- ci-hooks workflow ubuntu+macOS — bash 3.2/5.x 양쪽 fixture pass
