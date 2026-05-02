---
name: 4-agent 코드리뷰는 PR 생성 직전 로컬 diff에서 수행 (admin-merge 전)
description: CI admin-skip 정책 + auto mode 에서도 gh pr create *직전*에 security/perf/arch/test 4 병렬 리뷰 파이프라인을 기본 수행. PR 생성 후 fix-loop가 push→CI→push→CI 2회 비효율을 만들었던 점을 해소.
type: feedback
---

Auto mode + CI admin-skip 운영 중이라도 `.claude/post-task-pipeline.json`
의 `before_pr` 블록 (security-reviewer · code-reviewer perf · critic arch ·
test-engineer) 4 병렬 리뷰를 **`gh pr create` 직전 로컬 diff
(`git diff <base>...HEAD`) 기준**으로 기본 실행할 것. 사용자가 "진행해"
로 빠르게 자동 실행을 요청하더라도 이 리뷰 단계는 건너뛰면 안 된다.

**Why:**
1. **PR-2c 사고 (2026-04-18)** — PR-2c (#107) 를 리뷰 없이 admin
   squash-merge 한 뒤 사후 4-agent 리뷰에서 `handlers.handleCombine` 이
   `m.mu.Lock` 홀드 중 `EventBus.Publish` 를 synchronous 호출하는 HIGH
   deadlock 잠재 이슈가 발견되어 hotfix PR #108 로 수습. 신속성이 리스크
   노출을 정당화하지 못한다.
2. **CI 비효율 해소 (2026-05-01 rename: after_pr → before_pr)** — 기존
   "PR 생성 직후 리뷰" 워크플로는 HIGH fix 시 다음 push 가 GitHub Actions
   CI 를 한 번 더 돌려 PR 당 CI 2회 + reviewer fix 커밋이 PR diff 에
   끼어드는 비효율이 있었다. 로컬 diff 에서 선행 리뷰 → fix → 단일 push
   → CI 1회 → admin-merge 로 단축. PR-2c 안전망 효과는 유지 (push 전에
   같은 4-agent 가 도므로).

**How to apply:**
- Size S/Low + 순수 문서 변경 PR 은 리뷰 생략 가능, 단 사용자에게 이유
  명시 후 기본 동의 받은 뒤 진행.
- Size M+ 또는 보안/동시성/인터페이스 변경 포함 PR 은 예외 없이 4-agent
  리뷰 선행 (parallel_group=review).
  PR-N` 호출. branch 가 origin 에 이미 있어도 무방하지만 `gh pr create`
  *전*에 4-agent 가 도는 게 핵심 — push→PR→review→fix→push 의 2회 CI 를
  push→review→fix→push→PR 의 1회 CI 로 압축.
- 리뷰 결과가 CRITICAL/HIGH 이면 같은 로컬 브랜치에서 fix-loop. MEDIUM 은
  같은 PR 에 묶거나 follow-up PR 로 명시 분리.
- 리뷰 건너뛰면 반드시 사용자 메시지로 "리뷰 없이 admin-merge 합니다"
  선언.

**Carve-out: 사용자 명시 4-agent 우회 + superpowers:code-review 대체**
- 사용자가 명시적으로 "4-agent 우회"를 결정한 경우 (`memory/feedback_mode_decision_gate.md` 카논상 mode 결정), `superpowers:requesting-code-review` 1회 호출이 단일 안전망으로 대체 가능.
- 우회 조건:
  1. 사용자 명시 발화 ("4-agent 우회", "superpowers code-review만" 등)
  2. PR scope에 보안 critical 변경 없음 (PR-2c 패턴 아님)
  3. `superpowers:requesting-code-review` 결과가 Critical 0 + 사용자 명시 acceptable
- 우회 사례 (Phase 23 PR #174, 2026-04-29):
  - mega PR scope (single-concern 카논 explicit override)
  - infrastructure 변경 (Dockerfile + workflow + compose, 보안 critical 아님)
  - superpowers:code-review APPROVED YES_WITH_FIXES (Critical 0, Important 1 fold-in)
  - admin-skip 머지 후 main에서 yaml syntax bug 발견 → hotfix #175 → 1 추가 PR cycle 비용. 4-agent였다면 검출됐을지는 미확정 (yaml syntax는 4-agent의 axes 외).
- **default는 4-agent 강제 유지** — 사용자 명시 없으면 우회 X.

**Reference**: `.claude/post-task-pipeline.json` `before_pr` 블록,
(슬래시 커맨드 실행 시퀀스).
