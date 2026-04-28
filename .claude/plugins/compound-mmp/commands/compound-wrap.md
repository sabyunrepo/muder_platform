---
description: 세션·Wave·Phase 종료 시 7단계 wrap-up 시퀀스 실행. 균형형 자동화 — QUESTIONS/handoff/MEMORY entry 자동, MISTAKES/checklist STATUS 승인.
allowed-tools: Bash, Read, Glob, Grep, Write, Edit, Task, mcp__plugin_qmd_qmd__vector_search, mcp__plugin_qmd_qmd__search
argument-hint: "[--session|--wave|--phase] (기본 --session)"
---

# /compound-wrap

세션·Wave·Phase 종료 시 자동 분석 + 학습 영구화 + 다음 세션 핸드오프.

## 인자

- `--session` (기본) — 가장 가벼운 모드. graphify decision = skip
- `--wave` — Wave 종료. graphify `--update` 안내만 (자동 실행 X)
- `--phase` — Phase 종료. graphify fresh rebuild 자동 실행 (`make graphify-refresh`)

## 실행 절차

`skills/wrap-up-mmp/SKILL.md`의 7단계 시퀀스를 따른다. 카논 위치: `refs/wrap-up-checklist.md`.

핵심:
1. Pre-scan (git status + diff stat + log)
2. Phase 1 — 4 agent 병렬 (한 메시지에서 4 Task tool 동시 spawn)
3. Phase 2 — duplicate-checker 순차 (QMD 검증)
4. 결과 통합 + 사용자 표시
5. **자동 실행** — QUESTIONS append + sessions/handoff 생성 + MEMORY entry append
6. **승인 실행** — MISTAKES append + checklist STATUS 갱신
7. graphify decision (`--phase`만 자동 rebuild)

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
