# Session Recall Template (메인 컨텍스트가 SessionStart에 inject)

다음 세션 시작 시 SessionStart hook이 `memory/sessions/` 디렉토리에서 가장 최근 파일 1개를 read하고 다음 형식으로 컨텍스트에 주입한다.

## 주입 형식 (≤30 lines)

```
[compound-mmp handoff] 마지막 세션: <YYYY-MM-DD> · <topic>
- Phase: <phase>
- 결정: <decided 첫 2개 항목>
- 미완료: <remaining 첫 2개 항목>
- 다음 5초: <next_session_priorities 첫 1개>
- 자세한 내용: memory/sessions/<YYYY-MM-DD>-<topic>.md
```

## 트리거

`hooks/session-start-context.sh` (PR-6에서 구현). 출력:

```bash
ls -t memory/sessions/*.md 2>/dev/null | head -1
```

으로 최신 파일 read 후 frontmatter parse → 위 형식으로 stdout JSON 반환.

## 사용자 override

세션 시작 시 사용자가 "이전 컨텍스트 무시"라고 발화하면, 메인 컨텍스트는 inject된 내용을 무시. dispatch-router의 override 우선순위 (refs/auto-dispatch.md §Override 우선순위 참조)와 동일 패턴.

## 안티 패턴

- ❌ 30 lines 초과 — SessionStart hook은 토큰 가벼워야 함
- ❌ raw frontmatter dump — 사람이 읽기 어렵고 토큰 낭비
- ❌ 여러 세션 파일 동시 inject — 가장 최근 1개만
- ❌ frontmatter에 sensitive 데이터 (예: secret, 사용자 개인정보) — 다음 세션에 무한 leak

## 검증

PR-10 dogfooding 1주 동안 inject 정상도 측정 (사용자 발화에 "어제 뭐 했지?" 빈도 — 0건이면 inject 효과 입증).
