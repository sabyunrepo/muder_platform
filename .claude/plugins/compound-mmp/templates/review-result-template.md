# Review Result Template

`/compound-review`가 `docs/plans/<phase>/refs/reviews/<pr-id>.md`에 생성하는 종합 결과 포맷.

## 출력 예시

```markdown
---
pr_id: "PR-7"
pr_title: "compound-review + 4-agent bridge"
phase: "compound-mmp Wave 3"
review_date: 2026-04-28
agents: [security-reviewer, code-reviewer, critic, test-engineer]
models: [opus, sonnet, opus, sonnet]
---

# Review: PR-7 compound-review + 4-agent bridge

## 종합

- **HIGH 0건** / MEDIUM N건 / LOW N건
- **권고**: admin-merge 안전 진행 (HIGH 0). carry-over MEDIUM/LOW는 다음 PR piggyback.

## P0–P3 라우팅 결과 (refs/post-task-pipeline-bridge.md)

| 심각도 | count | 라우팅 | 처리 |
|--------|-------|--------|------|
| P0 (CRITICAL) | 0 | manual | — |
| P1 (HIGH) | 0 | manual | — |
| P2 (MEDIUM) | N | gated_auto | 다음 PR 이월 |
| P3 (LOW) | N | advisory | 정보성 |

## 영역별 결과

### Security (oh-my-claudecode:security-reviewer, opus)

- **PASS / HIGH N건 / MEDIUM N건**
- 핵심 발견:
  - (HIGH) [요약] — 위치, 영향, 권고
  - (MEDIUM) ...

### Performance (oh-my-claudecode:code-reviewer, sonnet)

- **PASS** / 발견 사항 분류
- ...

### Architecture (oh-my-claudecode:critic, opus)

- **PASS** / drift 분류
- ...

### Test Coverage (oh-my-claudecode:test-engineer, sonnet)

- **PASS** / coverage delta
- ...

## 권고 액션

- (a) **즉시 수정**: HIGH N건 → `/compound-work PR-7`로 별도 명시 호출
- (b) **다음 PR 이월**: MEDIUM N건 → carry-over 등재 (`memory/QUESTIONS.md` Q-XXX)
- (c) **무시**: LOW N건 — 사유 1줄
```

## 작성 규칙

1. **frontmatter** — `pr_id`, `pr_title`, `phase`, `review_date`, `agents`, `models` 5필드 필수.
2. **종합 섹션** — HIGH count 우선 가시화. MED/LOW는 합산만.
3. **영역별 섹션** — agent 응답을 메인 컨텍스트가 ≤200단어로 압축 요약. raw dump 금지 (advisor 패턴, opus-delegation.md).
4. **권고 액션** — (a)/(b)/(c) 3선택지로 사용자 결정 명확화. 자동 진행 X.

## 안티 패턴

- ❌ 4 agent 응답 raw dump — 메인 컨텍스트가 압축 요약해야 함
- ❌ HIGH 0건인데 "권고: 즉시 수정" — 라우팅 카논 위반
- ❌ pr_title을 frontmatter에 raw 보간 (특수문자) — YAML 안전 인용 (`pr_title: "..."`)
- ❌ critic을 architect로 표기 — 카논 정정 (`refs/post-task-pipeline-bridge.md` § 정정)
