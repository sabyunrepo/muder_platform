# Learning Quality Gate (OMC `learner` skill 차용)

`compound-mmp:learning-extractor` agent의 핵심 판단 기준. OMC `~/.claude/plugins/marketplaces/omc/skills/learner/SKILL.md`의 3-question gate를 그대로 차용.

## 3 Questions

각 학습 후보가 다음 3가지 질문을 모두 PASS해야 `memory/MISTAKES.md`에 등재할 가치가 있다:

### Q1. 5분 안에 Google·공식 docs로 답할 수 있는가?
- **YES** → 일반 지식. 등재 X (단순 reminder 가치만).
- **NO** → Q2로.

예: "Go map은 nil이면 read는 zero value 반환" — Q1 YES, 일반 지식.
예: "MMP v3 PlayerAware 게이트가 boot panic으로 강제됨" — Q1 NO, repo-specific 카논.

### Q2. 이 codebase·프로젝트에 한정된 학습인가?
- **YES** → MMP v3 컨텍스트에서만 의미 있는 패턴. Q3로.
- **NO** → 다른 plugin/repo에도 적용되는 일반 지식. 등재 X (또는 외부 노트 `~/.claude/til/`로).

예: "Sonnet 4.5보다 4.6 사용해야 함" — Q2 NO (Anthropic 모든 사용자에 해당). 외부 노트.
예: "MMP v3는 33개 모듈 모두 PlayerAware 의무" — Q2 YES.

### Q3. 실제 디버그·시행착오 노력으로 얻은 것인가?
- **YES** → 등재 가치 입증. `memory/MISTAKES.md` 등재 후보.
- **NO** → 가설·이론·예상. 등재 보류 (`memory/QUESTIONS.md`로).

예: "PR-2c handleCombine deadlock — 4-agent 리뷰 스킵 후 hotfix #108 발견" — Q3 YES.
예: "이렇게 하면 race condition 생길지도 모름" — Q3 NO. QUESTIONS로.

## 분류 매트릭스

| Q1 | Q2 | Q3 | 분류 |
|----|----|----|------|
| YES | * | * | 등재 X (일반 지식) |
| NO | NO | * | 외부 노트 또는 등재 X |
| NO | YES | NO | `memory/QUESTIONS.md` (가설) |
| NO | YES | YES | `memory/MISTAKES.md` (검증된 카논) |

## 적용 예시 (PR-2c #107)

- Q1: "deadlock이 lock-in-lock 패턴에서 발생" — Google 가능. **YES**.
- 그러나 정확한 적용 컨텍스트 ("MMP combination 모듈의 handleCombine이 m.mu 보유 중 bus.Publish 호출 → ABBA")는 Q1 NO + Q2 YES + Q3 YES.
- 결과: 일반 lesson은 등재 X, MMP-specific 사고는 MISTAKES.md 등재.

## 출처

- OMC `~/.claude/plugins/marketplaces/omc/skills/learner/SKILL.md`
- 이 ref는 OMC 정책을 MMP MISTAKES/QUESTIONS 카논 경로로 매핑한 것. OMC 자체는 `.omc/skills/<name>.md`에 저장하지만 MMP는 `memory/` canonical에 통일.

## 운영 메모

- `learning-extractor` agent의 prompt가 이 ref를 인용. 별도 강제 hook 없음 — agent 자체 판단.
- duplicate-checker가 사후 검증 (Phase 2). 동일·유사 entry 발견 시 등재 차단.
- 등재 후 6개월에 한 번 retrospective review로 noise entry 정리 권장 (PR-10 dogfooding 1주에서 운영 패턴 확정).
