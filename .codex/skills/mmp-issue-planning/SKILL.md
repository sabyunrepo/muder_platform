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
   - `## Coverage Plan`
   - `## 검증 계획`
   - `## PR 묶음 제안`
   - `## 브레인스토밍 필요 여부`
   - `## 순서/의존성`
   - 필요 시 `## Deferred / Follow-up`
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
6. 코드 작성/수정 이슈의 `## Coverage Plan`에는 변경 예상 파일/모듈별 테스트 책임을 적는다.
   - Backend handler/service: 성공 경로, validation, not found, ownership, conflict, delete-blocked 같은 실패 경로를 unit/integration test로 매핑한다.
   - Frontend adapter/hook/component: 저장 payload, dirty state, error UI, empty/loading state, direct URL/tab state를 Vitest/E2E로 매핑한다.
   - E2E 제외 시에는 왜 E2E가 부적합한지와 대체 테스트를 적는다.
   - Codecov patch coverage 70%를 PR 끝에서 처음 확인하는 흐름을 피하기 위해, issue 단계에서 미리 테스트 파일 후보를 지정한다.
7. MVP와 후순위를 분리한다. 범위가 커지거나 구현 중 제외하는 항목이 생기면 `## Deferred / Follow-up`에 남긴다.
   - 같은 이슈 안에서 이어서 처리할 작은 항목이면 체크리스트로 둔다.
   - 독립 PR이 필요하거나 다른 owner/검증 범위를 갖는 항목이면 새 GitHub Issue를 만든다.
   - PR 본문에는 완료 범위는 `Closes #번호`, 후속/부분 범위는 `Refs #번호`로 연결한다.
8. `## PR 묶음 제안`은 CI 비용까지 고려한다.
   - 같은 이슈/같은 CI scope/같은 review surface의 repo-local workflow 변경은 하나의 PR로 묶는 것을 우선한다.
   - shared contract, migration, large UI route, backend API처럼 실패 blast radius가 큰 변경은 별도 PR로 분리한다.
   - “작게 쪼개기”는 기본값이 아니라 충돌·리뷰 위험을 줄일 때만 선택한다. CI를 여러 번 태우는 초소형 PR은 피한다.
9. 에디터 이슈는 Uzu docs를 참고할 수 있지만, MMP runtime/gameplay 규칙이 최종 기준이다.

## Done

- Issue 본문만 읽어도 병렬 audit, 순차 통합, 검증 범위가 보인다.
- 병렬 가능한 lane과 충돌 금지 영역이 둘 다 적혀 있다.
- 완료 조건에 테스트 또는 테스트 대체 근거가 있다.
- Coverage Plan에 변경 파일별 테스트 매핑이 있다.
- Deferred / Follow-up 판단이 추적 가능하거나, 후속 없음이 명확하다.
- PR 묶음은 충돌 위험과 CI 비용을 함께 고려했고, 브레인스토밍 필요 여부가 명확하다.

## Avoid

- 모든 Issue를 억지로 병렬화하지 않는다. 의존성이 강하면 sequential로 표시한다.
- 여러 agent에게 같은 파일/모듈 write ownership을 주지 않는다.
- 제작자 UI 요구사항에 내부 ID, raw JSON, engine key, debug state 노출을 넣지 않는다.
- 이슈 작성만으로 구현 검증이 끝났다고 주장하지 않는다.
- “후속”이라고만 쓰고 실행 가능한 Issue나 체크리스트로 추적하지 않는 상태를 남기지 않는다.
