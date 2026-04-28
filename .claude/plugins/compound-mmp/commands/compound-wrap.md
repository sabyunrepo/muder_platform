---
description: 세션·Wave·Phase 종료 시 7단계 wrap-up 시퀀스 실행. 균형형 자동화 — QUESTIONS/handoff/MEMORY entry 자동, MISTAKES/checklist STATUS 승인.
allowed-tools: Bash, Read, Glob, Grep, Write, Edit, Task, mcp__plugin_qmd_qmd__vector_search, mcp__plugin_qmd_qmd__search
argument-hint: "[--session|--wave|--phase] (기본 --session)"
---

# /compound-wrap

> **Single source of truth**: `skills/wrap-up-mmp/SKILL.md`. 이 command는 thin pointer — 7단계 본문은 skill을 따른다 (PR-5 카논화).

세션·Wave·Phase 종료 시 자동 분석 + 학습 영구화 + 다음 세션 핸드오프.

## 인자

- `--session` (기본) — graphify skip, 가장 가벼움
- `--wave` — Wave 머지 직후. graphify `--update` 안내만
- `--phase` — Phase 종료. graphify fresh rebuild 자동 실행

## 실행

`skills/wrap-up-mmp/SKILL.md`의 7단계 시퀀스(Pre-scan → 4 agent 병렬 → duplicate-checker → 통합 → 자동 실행 → 승인 실행 → graphify decision)를 그대로 실행. 세부 prompt 구성·정책·예외는 모두 SKILL이 master.

카논 ref: `refs/wrap-up-checklist.md` (단계별 자동/승인 매트릭스).

## 사용 예

```
/compound-wrap                      # 세션 종료 (기본)
/compound-wrap --wave               # W3 머지 후
/compound-wrap --phase              # Phase 19 Residual 종료
```

## 자동 디스패처 활성화 트리거 (PR-4 이후)

다음 사용자 발화에서 `dispatch-router.sh`가 `/compound-wrap` 추천:
- "wrap up", "마무리하자", "세션 끝", "정리해줘", "wrap-up", "내일 이어서"
- 시 그날의 변경 50줄 이상 + 미실행이면 `Stop` hook이 한 줄 리마인드

## 안티 패턴 (절대 금지)

- ❌ wrap agent에 Bash/Edit/Write 권한 부여 — `disallowedTools` 강제 (anti-patterns #12)
- ❌ MEMORY.md 카논 인덱스 자동 덮어쓰기 — entry append만 자동 (anti-patterns #9)
- ❌ MISTAKES.md 사용자 승인 없이 자동 append (Step 6은 승인 필수)
- ❌ `--session` 모드에서 graphify fresh rebuild — semantic node ~6% 손실 위험 (anti-patterns #4)
