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
