# Issue #293 — 결말 runtime 계약 체크리스트

## 목표

- [x] `flow_nodes(type=ending)` 삭제 시 `config_json.modules.ending_branch` 참조가 남지 않게 한다.
- [x] 삭제 API에서 creator 소유권을 확인해 다른 제작자의 flow node 삭제를 막는다.
- [x] `flow_edges`는 DB `ON DELETE CASCADE`에 맡기고, JSON 설정 참조는 service transaction에서 정리한다.
- [x] 현재 runtime의 `selectedEnding` 값은 ending flow node id 문자열이라는 계약을 문서화한다.

## 범위

- 포함: ending node 삭제 cleanup, ownership guard, focused Go test, runtime 계약 문서.
- 제외: 결과 화면 UX, 캐릭터 엔드카드, GM override, ending_branch 조건 UI 재설계.
- E2E 제외 사유: 이번 변경은 화면 표시가 아니라 backend 삭제/저장 계약과 runtime id 전달 계약을 고정하는 작업이다. 사용자 화면 검증은 #280/#330 결과 화면 구현 PR에서 진행하고, 이 PR은 Postgres integration test와 runtime unit test로 대체한다.

## 검증

- [x] `go test ./internal/domain/flow`
- [x] `git diff --check`
- [x] `go test ./internal/module/decision/ending_branch`
- [x] `go test ./internal/domain/editor -run 'TestUpdateConfigJson_.*EndingBranchReference'`
- [x] `pnpm --filter @mmp/web exec tsc --noEmit` (primary worktree에서 실행, 이 PR은 TS 변경 없음)
