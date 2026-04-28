# Session Handoff Note Template

`/compound-wrap`이 `memory/sessions/<YYYY-MM-DD>-<topic>.md`에 생성하는 템플릿.

OMC team handoff(`marketplaces/omc/skills/team/SKILL.md`)와 **markdown bullet 포맷**으로 cross-mode 호환. YAML frontmatter는 metadata만, 본문은 markdown 5필드.

## 출력 예시

```markdown
---
topic: "한 줄 요약"
phase: "Phase 19 Residual W3"
prs_touched: [PR-N, PR-M]
session_date: 2026-04-28
---

# Session Handoff: <topic>

## Decided
- 결정 사항 1
- 결정 사항 2

## Rejected
- 거부된 옵션 1 (이유)
- 거부된 옵션 2 (이유)

## Risks
- 잠재 위험 1
- 잠재 위험 2

## Files
- 수정 파일 1
- 수정 파일 2

## Remaining
- 미완료 항목 1 (Done: <조건>)
- 미완료 항목 2 (Done: <조건>)

## Next Session Priorities
- P0/P1 항목 1
- P0/P1 항목 2

---

(Haiku 또는 메인 모델 요약 ≤300단어)

## What we did
<2~3문장>

## What blocked us (있으면)
<1~2문장>

## Next session 첫 5초
- 가장 먼저 read할 파일: `<경로>`
- 미해결 사용자 결정: <있으면, 없으면 "없음">
```

## OMC team handoff 호환

OMC `team` 스킬의 handoff 5섹션 (`Decided / Rejected / Risks / Files / Remaining`)을 그대로 markdown bullet으로 사용. OMC team이 `.omc/handoffs/<stage>.md`에서 동일 섹션 헤더를 read하므로 cross-mode 호환 가능.

차이점 (의도된 분기):
- **저장 위치**: OMC `.omc/handoffs/`, MMP `memory/sessions/`. 위치 다르므로 동시 생성 시 충돌 X
- **YAML frontmatter**: MMP만 추가. OMC team은 markdown만. 단 frontmatter는 optional이라 OMC parser가 무시해도 본문 5섹션 read 가능

## 빈 항목 처리

5섹션 중 해당 항목이 없으면 `- 없음` 1줄 작성. 빈 섹션 또는 헤더 누락은 cross-mode 호환을 깨뜨릴 수 있음.

## Path traversal 방어

`<topic>` 자리에 들어가는 사용자 발화는 `topic_safe=$(printf '%s' "$topic" | tr -cd 'a-zA-Z0-9가-힣_-' | cut -c1-40)` 으로 정규화. 빈 결과 시 `session` 기본값.

## 사용 위치

- `skills/wrap-up-mmp/SKILL.md` Step 5-2가 이 템플릿으로 파일 생성
- `templates/session-recall-template.md`이 이 파일에서 inject 형식 추출 (PR-6 hook 활성화 시점)
