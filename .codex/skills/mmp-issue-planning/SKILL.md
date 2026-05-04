---
name: mmp-issue-planning
description: Use when creating, rewriting, prioritizing, or executing MMP GitHub issues, especially when issue bodies need parallel work design, subagent assignment, file ownership, PR grouping, or brainstorming gates.
---

# MMP Issue Planning

## 근거

이 워크플로는 현재 Codex 공식 문서의 원칙을 MMP 방식으로 좁혀 적용한다.

- Subagents: https://developers.openai.com/codex/subagents
- Subagent concepts: https://developers.openai.com/codex/concepts/subagents
- Skills: https://developers.openai.com/codex/skills
- AGENTS.md: https://developers.openai.com/codex/guides/agents-md
- Worktrees: https://developers.openai.com/codex/app/worktrees

핵심 원칙:
- subagent는 사용자가 병렬/위임/subagent 작업을 명시한 경우에만 사용한다.
- 병렬화는 탐색, 테스트, triage, 로그 분석, 요약 같은 read-heavy 작업부터 적용한다.
- write-heavy 병렬 작업은 같은 파일/계약을 동시에 수정하면 충돌이 커지므로 파일 소유권을 먼저 나눈다.
- skill은 반복 워크플로를 담고, AGENTS.md는 항상 알아야 하는 durable project rule만 담는다.

## When

- GitHub Issue를 새로 만들거나 기존 Issue를 재작성할 때.
- 다음 세션에서 바로 실행할 수 있게 작업 범위, 병렬 작업, 검증 조건을 정리해야 할 때.
- 사용자가 병렬작업, subagent, PR 묶음, 이슈 재설계, 브레인스토밍 필요 여부를 물을 때.

## Do

1. Issue 편집이나 repo 파일 변경은 feature/chore branch에서 진행한다.
2. 각 Issue에는 가능한 한 아래 섹션을 포함한다.
   - `## 목표`
   - `## 배경`
   - `## 작업 범위`
   - `## 병렬 작업 설계`
   - `## 제외`
   - `## 완료 조건`
   - `## 검증 계획`
   - `## PR 묶음 제안`
   - `## 브레인스토밍 필요 여부`
   - `## 순서/의존성`
3. `## 병렬 작업 설계`에는 아래 하위 섹션을 둔다.
   - `### 병렬 가능 작업`: 실제 사용할 agent lane을 적는다.
   - `### 파일/모듈 소유권`: 각 lane이 읽거나 수정할 수 있는 디렉터리/파일을 적는다.
   - `### 병렬 금지/주의 영역`: shared contract, migration, PR label/merge, 같은 파일 수정 위험을 적는다.
   - `### 취합 방식`: 각 subagent는 `발견 / 수행 / 판단 / 미해결`로 보고하고, 메인 Codex가 중복 제거와 최종 통합을 맡는다고 적는다.
4. 가능한 경우 실제 MMP agent 이름을 명시한다.
   - `mmp-parallel-coordinator`
   - `mmp-frontend-editor-reviewer`
   - `mmp-backend-engine-reviewer`
   - `mmp-test-coverage-reviewer`
5. API DTO, frontend adapter/ViewModel mapping, migration 결정, PR 생성, label, merge는 메인 Codex 소유로 둔다.
6. MVP와 후순위를 분리한다. 범위가 커지면 후속 Issue를 만든다.
7. 에디터 이슈는 Uzu docs를 참고할 수 있지만, MMP runtime/gameplay 규칙이 최종 기준이다.

## Done

- Issue 본문만 읽어도 병렬 audit, 순차 통합, 검증 범위가 보인다.
- 병렬 가능한 lane과 충돌 금지 영역이 둘 다 적혀 있다.
- 완료 조건에 테스트 또는 테스트 대체 근거가 있다.
- PR 묶음과 브레인스토밍 필요 여부가 명확하다.

## Avoid

- 모든 Issue를 억지로 병렬화하지 않는다. 의존성이 강하면 sequential로 표시한다.
- 여러 agent에게 같은 파일/모듈 write ownership을 주지 않는다.
- 제작자 UI 요구사항에 내부 ID, raw JSON, engine key, debug state 노출을 넣지 않는다.
- 이슈 작성만으로 구현 검증이 끝났다고 주장하지 않는다.
