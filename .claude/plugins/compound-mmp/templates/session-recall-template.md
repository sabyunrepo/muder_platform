# Session Recall Template (`/compound-resume` 명시 호출 시 메인 컨텍스트 출력 형식)

세션 도중 또는 시작 직후 사용자가 `/compound-resume` 호출 시, 메인 컨텍스트가 `memory/sessions/` 디렉토리에서 가장 최근 파일 1개를 read 후 다음 형식으로 정리해 출력한다.

> **사용자 결정 2026-04-28**: SessionStart hook 자동 inject 폐기. 매 세션 토큰 낭비 회피 위해 명시 호출 패턴만 유지.

## 출력 형식 (≤30 lines)

```
[compound-mmp resume] 마지막 세션: <YYYY-MM-DD> · <topic>
- Phase: <phase>
- 결정: <decided 첫 2개 항목>
- 미완료: <remaining 첫 2개 항목>
- 다음 5초: <next_session_priorities 첫 1개>
- 자세한 내용: memory/sessions/<YYYY-MM-DD>-<topic>.md

[plan] <~/.claude/plans/<latest>.md 또는 docs/plans/<latest>/checklist.md>

[카논 cheat-sheet]
- 4단계: refs/lifecycle-stages.md
- 7단계 wrap: refs/wrap-up-checklist.md
- anti-patterns: refs/anti-patterns.md
- 4-agent: refs/post-task-pipeline-bridge.md
```

## 트리거

`commands/compound-resume.md` (slash command). 사용자 명시 호출:
```
/compound-resume
```

dispatch-router의 cycle 분류와 별개 — `cycle`은 dry-run dashboard 출력, `resume`은 read 위주.

## 사용자 override

`/compound-resume` 호출 후 사용자가 "이전 컨텍스트 무시"라고 발화하면, 메인 컨텍스트는 read한 내용을 무시. dispatch-router의 override 우선순위 (refs/auto-dispatch.md §Override 우선순위 참조)와 동일 패턴.

## 안티 패턴

- ❌ 30 lines 초과 — 출력은 토큰 가벼워야 함 (사용자가 깊게 read 원하면 명시 추가 발화)
- ❌ raw frontmatter dump — 사람이 읽기 어렵고 토큰 낭비
- ❌ 여러 세션 파일 동시 read — 가장 최근 1개만
- ❌ frontmatter에 sensitive 데이터 (예: secret, 사용자 개인정보) — 다음 세션에 무한 leak
- ❌ 자동 SessionStart hook 부활 — 사용자 결정 2026-04-28 (anti-patterns.md 신규 후보)

## 검증

PR-10 dogfooding 1주 동안 `/compound-resume` 사용률 측정 (사용자 발화에 "어제 뭐 했지?" 빈도 — 0건이면 명시 호출 패턴 효과 입증).
