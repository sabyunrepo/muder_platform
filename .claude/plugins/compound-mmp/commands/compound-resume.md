---
description: 다음 세션 진입 시 가장 최근 핸드오프 노트 + plan 본문 + compound-mmp 카논 cheat-sheet를 일괄 read하여 5초 안에 작업 재개. SessionStart hook 자동 inject 대신 사용자 명시 호출 패턴 (낭비 회피).
allowed-tools: Bash, Read, Glob
argument-hint: "(인자 없음)"
---

# /compound-resume

세션 도중 또는 시작 직후 사용자가 명시 호출. 핸드오프·plan·카논을 한 번에 read해 작업 재개 컨텍스트 확보. **자동 SessionStart inject 대신 명시 호출** — 매 세션 토큰 낭비 방지 (사용자 결정 2026-04-28).

## 동작

1. **가장 최근 핸드오프 노트** read:
   ```bash
   ls -t memory/sessions/*.md 2>/dev/null | head -1
   ```
   파일 발견 시 전체 read. 부재 시 "이전 세션 핸드오프 없음" 표시.

2. **활성 plan 본문** read (있을 때):
   - `~/.claude/plans/<*.md>` (user home)
   - 또는 `docs/plans/<latest-phase>/checklist.md` (repo)
   가장 최근 mtime 파일 1개.

3. **compound-mmp 카논 cheat-sheet** 표시:
   - 4단계 라이프사이클: `refs/lifecycle-stages.md`
   - 7단계 wrap: `refs/wrap-up-checklist.md` + `skills/wrap-up-mmp/SKILL.md`
   - 12 anti-patterns: `refs/anti-patterns.md`
   - TDD soft ask 정책: `refs/tdd-enforcement.md`
   - 5단계 dispatch 분류: `refs/auto-dispatch.md`
   - 4-agent post-task-pipeline 매핑: `refs/post-task-pipeline-bridge.md` + `.claude/post-task-pipeline.json`
   - Sim Case A 카논: `refs/sim-case-a.md`

4. **다음 5초** 출력:
   - 핸드오프의 `## Next Session Priorities` 첫 1개
   - 미해결 사용자 결정 (있으면)
   - 가장 위험한 미커밋 변경 (있으면 — `git status --short` 결과)

## 사용 예

```
사용자: /compound-resume
메인: [핸드오프 read] [plan read] [카논 cheat-sheet 표시] [다음 5초]
사용자: enabledPlugins hotfix부터 진행
```

## 자동 디스패처 활성화 트리거

`dispatch-router.sh`의 cycle 분류와 일부 겹친다. 우선순위:
- 사용자가 `/compound-resume` 명시 → 그대로 실행
- 사용자가 "지금 어디", "다음 단계", "현황" 발화 → dispatch=cycle, `/compound-cycle` 안내 (`/compound-resume`은 read 위주, `/compound-cycle`은 dry-run dashboard)

## 안티 패턴

- ❌ 자동 SessionStart hook 부활 — 사용자 결정 2026-04-28 (필요할 때만 명시 호출, 낭비 회피)
- ❌ 모든 핸드오프 파일을 한꺼번에 read — 가장 최근 1개만 (토큰 비용 ↑)
- ❌ raw frontmatter dump — 메인 컨텍스트가 사람 읽기 좋게 정리해서 표시
- ❌ 명시 호출 X일 때 임의 cheat-sheet 표시 — `/compound-resume` 호출 한정

## 카논 ref

- `refs/auto-dispatch.md` (cycle 분류와 차이)
- `templates/session-recall-template.md` (출력 형식 — slash command 모드)
- `skills/wrap-up-mmp/SKILL.md` Step 5-2 (handoff 생성 master)
