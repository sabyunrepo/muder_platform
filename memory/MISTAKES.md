# MMP v3 Recurring Mistakes Registry

재발 가능성이 있는 실수·낭비 패턴 적층. compound-mmp `/compound-wrap` Step 6-1 결과로 **사용자 승인 후** append (자동 append 금지, anti-patterns.md #9).

learning-extractor의 3-question quality gate(`refs/learning-quality-gate.md` Q1·Q2·Q3) 모두 PASS + duplicate-checker가 NEW로 분류한 항목만 등재. 해소 시 entry 삭제 또는 `~~strikethrough~~` + 해소 PR/commit 링크.

---

## 2026-04-28 — dispatch-router "audit this" 본문 제거 vs router 보강

**패턴**: 슬래시 본문에 trigger keyword를 적었는데 `dispatch-router.sh` 정규식이 매칭 안 할 때, **본문에서 keyword를 제거하는 것이 router를 보강하는 것보다 안전**.

**근본 원인**: `dispatch-router.sh`는 `additionalContext` 추천 전용 (anti-patterns.md #11, `permissionDecision: deny` 미사용). 본문 keyword가 router 비매칭이어도 단순 통과 — 사용자 의도 손실 없음. router 보강은 false positive 위험을 동반 (예: "audit log 추가해" 발화가 review로 오라우팅).

**재발 방지 강제점**:
- 슬래시 본문 변경 시 `test-dispatch.sh`에 본문 phrase fixture 추가하여 doc-vs-behavior align
- 본문에 적었지만 router에 추가하기 부담스러운 keyword는 **본문에서 제거**가 기본 옵션
- 제거 시 본문에 사유 1줄 명시 ("false positive 위험으로 의도적으로 제외" 등)

**관련 카논**: `refs/anti-patterns.md` #11 (dispatch는 추천 전용)
**발견**: PR #158 4-agent self-review (arch HIGH-A3, 2026-04-28)
**해소 commit**: `8717dce` (compound-review.md L127 본문 제거 + test-dispatch.sh +6 fixture)

---

## Round-N fix → Round-N+1 vuln 도입 사이클 (4-round 종결)

**증상**: 보안 fix가 새 vuln을 도입하는 패턴은 round-N→N+1 사이클로 무한 반복 risk. 단일 layer fix는 우회 표면을 좁힐 뿐 종결 X.

**사례** (PR-10 #163 `/compound-cycle` 4-round 검증, 2026-04-28):
- **Round-1** HIGH-A1: cross-phase handoff pollution (`ls -t memory/sessions/*.md`가 다른 phase 매칭 → false `next_gate=done`)
- **Round-1 fix**: phase-scoped grep — `grep -l "$PHASE_NAME" memory/sessions/*.md`
- **Round-2 신규 HIGH-S2**: regex injection — `PHASE_NAME='2026-04-28-.*'` 잠입 시 BRE metachar 해석으로 다른 phase 매칭 (PoC 실증)
- **Round-2 fix**: `grep -lF` (fixed-string) + PHASE_NAME 화이트리스트 `^[a-z0-9_.-]+$`
- **Round-3 신규 HIGH-S3**: leading-hyphen option injection — `PHASE_NAME=-eversion` 화이트리스트 통과 → `grep -lF -eversion`이 `-e version` 패턴 검색으로 fixed-string 우회 (PoC 실증)
- **Round-3 fix**: 양 layer 강화 — 화이트리스트 `^[a-z0-9][a-z0-9_.-]*$` (첫 글자 alpha/num 강제) + `grep -lF -- "$VAR"` (separator)
- **Round-4**: 패턴 종결 확인 (전수 우회 시도 차단 실측, glob 확장 결과는 leading-`-` 불가능)

**근본 원인**: shell 명령어에 user input 직접 전달 시 (a) 정규식 해석, (b) 옵션 흡수 두 진입점 동시 존재. 단일 layer fix는 다른 진입점 노출.

**재발 방지 강제점**:
- helper에 user input → shell 명령어 (grep/ls/find/sed) 인자 전달 시 **첫 시도부터** 양 layer 동시 적용:
  1. 입력 화이트리스트 정규식 — **첫 글자 alpha/num 강제** (`^[a-z0-9][a-z0-9_.-]*$`), leading `-`/`.`/`_` 차단
  2. 명령어 호출 시 **`--` separator** 사용 (`grep -lF -- "$VAR"`, `find -- ...`)
- 정규식과 fixed-string 검증 둘 다 `<<canon>>` 권장 — defense-in-depth 양 layer
- round-N fix가 신규 vuln 도입 시 **같은 PR 마감** 카논 (carry-over 부적합 — round 무한 반복 차단)
- helper 외 sister command (예: PR-9 PROJECT_SLUG)도 동일 패턴 sweep 필수

**관련 카논**: `commands/compound-{cycle,work}.md` § Anti-pattern + `refs/post-task-pipeline-bridge.md` § "토큰 sanitize 의무"
**발견**: PR #163 4-round self-review (round-2 security HIGH-S2, round-3 security HIGH-S3, 2026-04-28)
**해소 commit**: `f9daca8` (양 layer 강화) + 4-round 검증 트레일 `docs/plans/2026-04-28-compound-mmp-wave3/refs/reviews/PR-10.md`
