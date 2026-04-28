---
pr_id: "PR-7"
pr_title: "compound-mmp: /compound-review + 4-agent parallel review bridge"
pr_url: "https://github.com/sabyunrepo/muder_platform/pull/158"
phase: "compound-mmp Wave 3"
review_date: 2026-04-28
agents: [security-reviewer, code-reviewer, critic, test-engineer]
agent_mapping:
  security: "general-purpose (opus) ← OMC `oh-my-claudecode:security-reviewer` 미가시 fallback"
  perf:     "general-purpose (sonnet) ← OMC `oh-my-claudecode:code-reviewer` fallback"
  arch:     "superpowers:code-reviewer (opus) ← OMC `oh-my-claudecode:critic` fallback"
  test:     "general-purpose (sonnet) ← OMC `oh-my-claudecode:test-engineer` fallback"
spawn_pattern: "single message, 4 Agent tool calls, run_in_background=true"
---

# Review: PR-7 compound-mmp /compound-review + 4-agent parallel review bridge

## 종합

- **HIGH 4건** / MEDIUM 7건 / LOW 8건
- **권고**: HIGH 4건 본 PR에서 즉시 수정 권고 (MEDIUM/LOW carry-over). PR-2c #107 사고 교훈 — HIGH는 admin-merge 전에 처리.

## P0–P3 라우팅 (refs/post-task-pipeline-bridge.md)

| 심각도 | count | 라우팅 | 처리 권고 |
|--------|-------|--------|----------|
| P0 (CRITICAL) | 0 | — | — |
| P1 (HIGH) | 4 | manual | **본 PR에서 fix 후 push (자동 fix-loop 금지, 사용자 결정 후 진행)** |
| P2 (MEDIUM) | 7 | gated_auto | Wave 3 다음 PR (PR-8 piggyback) 또는 PR-10 hygiene |
| P3 (LOW) | 8 | advisory | carry-over QUESTIONS 등재 |

## HIGH 4건 (P1)

### HIGH-A1: 슬래시 본문에 4 Task 하드코딩 (`commands/compound-review.md:54-58`)
- helper는 `select(.parallel_group=="review")`로 동적 추출하지만 슬래시 본문은 4 agent name을 prose로 enum.
- pipeline.json에 5번째 review 추가 시 silent break (helper length=5 vs 본문 4).
- **권고**: 본문을 imperative "iterate over `helper.payload[]`"로 교체.

### HIGH-A2: OMC 의존성 미선언/미검증 (`post-task-pipeline.json` + 슬래시 본문)
- `oh-my-claudecode:*` agent는 user-home `~/.claude/plugins/`에 있고 본 repo는 모름.
- 자가 리뷰에서 메인이 `general-purpose` + `superpowers:code-reviewer`로 fallback 매핑한 것이 증거.
- preflight 또는 `plugin.json` dependency 선언, 또는 본문에 fallback 매핑 명시 필요.
- **권고**: 슬래시 본문에 "OMC 가용 여부 확인 → 미설치 시 `general-purpose` + 적절한 model로 fallback" 명시.

### HIGH-A3: dispatch-router 트리거 phrase 검증 부재
- 슬래시 본문 L97-98 ("머지 전 확인", "병합 전 체크")가 `dispatch-router.sh:71` 정규식과 정확히 매칭되는지 미검증.
- doc-vs-behavior drift 위험.
- **권고**: `test-dispatch.sh`에 본문이 명시한 모든 phrase fixture 추가.

### HIGH-T1: case 21 false negative on CI (`hooks/test-compound-review-dry-run.sh:118-119`)
- `jq -e 'all(.[]; .prompt | contains("sabyun") | not)'` — 로컬 username 하드코딩.
- CI(`runner`)에서 injection 실행되어도 통과 (false PASS).
- case 20이 literal preservation을 이미 검증하므로 case 21은 redundant + misleading.
- **권고**: case 21 제거 또는 `[a-z_][a-z0-9_-]{2,}` 패턴으로 일반화.

## MEDIUM 7건 (P2 — carry-over)

### Architecture
- **MED-A1** automation-scout.md L54의 "architect" lingering token (critic 카논 정정 누락)
- **MED-A2** Step 5 "결과 종합"이 비-imperative — `skills/review-mmp/SKILL.md` 도입 또는 imperative 추가 (compound-wrap 패턴 대칭)
- **MED-A3** 헬퍼 hard-coded `${SCRIPT_DIR}/../../../post-task-pipeline.json` 3 deep coupling — 디렉토리 이동 시 silent break
- **MED-A4** 헬퍼가 length==4 self-validate 안 함 — fixture에만 contract 존재

### Performance
- **MED-P1** SCRIPT_DIR `${BASH_SOURCE[0]%/*}` 교체로 2 fork 절감 (~60ms/call, ~1.4s/CI matrix)
- **MED-P2** `printf | grep -qE` → `[[ =~ ]]` 교체로 1 fork 절감 (~30ms/call)

### Test
- **MED-T1** {pr_title}/{design} 토큰 치환 미검증 — gsub 라인 삭제되어도 24/24 모두 PASS

## LOW 8건 (P3 — advisory)

- LOW-A1 anti-pattern 목록이 compound-wrap.md보다 짧음, refs/anti-patterns.md 번호 미참조
- LOW-A2 `gh pr view` 실패 silent — debug log 권고
- LOW-S1 DESIGN_PATH absolute path (e.g. /etc/passwd) 통과 (현재 path string만 embed해서 무해, 미래 read-content 변경 시 위험)
- LOW-S2 `commands/compound-review.md:23-25` cwd-coupled glob (`ls -td docs/plans/*/`)
- LOW-S3 ARG_PR_NUM 파생식 미명시 (`${PR_ID#PR-}`)
- LOW-Pf1 `command -v jq` 4번째 fork — 순서 재배치로 cheap exit
- LOW-Pf2 fixture eval per-predicate fork — 비실용적 절감 (<0.5s)
- LOW-T2 PR-007 leading-zero 정책 미문서화
- LOW-T3 `length == 4` 하드코딩 변경 시 silent CI break — 인라인 주석 추가

## 영역별 verdict

| Agent | Verdict | 핵심 |
|-------|---------|------|
| Security | **PASS** | `jq --arg` 정상, 화이트리스트 정상, anti-pattern 명시. LOW 3건만. "토큰 치환은 진정으로 안전 (24/24 + 수동 probe)". |
| Performance | **PASS WITH CAVEATS** | helper fork 5 vs sister 1 — MED 2건 fix로 3 fork. helper는 hot-path 아님 (interactive only). |
| Architecture | **PASS WITH CAVEATS** | HIGH 3건 (하드코딩 / OMC 미선언 / dispatch drift). "Will this design survive 3 more PRs? **No, not without HIGH fixes.**" |
| Test | **PASS WITH CAVEATS** | regression-catch confidence ~85%. HIGH-T1 (CI false negative) + MED 2건. |

## 권고 액션

- (a) **본 PR에서 HIGH 4건 fix** — slash 본문 imperative 변환 (HIGH-A1) + OMC fallback 명시 (HIGH-A2) + dispatch fixture 추가 (HIGH-A3) + case 21 제거 (HIGH-T1). MED-P1/P2도 함께 (저비용 고가치). 추가 commit + 4-agent 재검증.
- (b) **HIGH-A1+T1만 fix하고 머지** — A2/A3는 별도 follow-up PR (OMC 가용성은 실제 사용 시점에 발현하므로 본 PR 머지 자체는 안전).
- (c) **현 상태로 admin-merge** — HIGH 4건을 carry-over로 등재하고 PR-8/PR-10에 piggyback. (PR-2c #107 사고 패턴 재현 위험)

## 다음 단계 제안

(a) 권고. 이유:
1. HIGH-A2 (OMC fallback)는 본 PR이 슬래시 명령의 "사용 카논"을 수립하는 시점이므로 미루면 PR-8/9/10이 잘못된 패턴을 베끼게 된다.
2. HIGH-A1+T1은 1 commit (~10분) 소요. MED-P1/P2 piggyback 시 ~15분.
3. 4-agent 재검증은 background 4 spawn (~3분 wait).
4. CI admin-skip 만료(2026-05-01, D-3) 전에 정식 green 도달 가능.
