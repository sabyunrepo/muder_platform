# 2026-05-12 Flow Scene Actions Checklist

## 고정 결정

- [x] `branch` 노드는 이번 범위에서 유지보수하지 않고 flow canvas에서 제거한다.
- [x] 장면 연결은 source 기준 단일 연결만 허용한다. 새 연결을 만들면 같은 source의 기존 연결은 자동 교체한다.
- [x] 장면 삭제는 제작자 확인 후 실행하고, 연결된 선도 함께 제거한다.
- [x] 장면 복제는 같은 내용을 복사하되 연결선은 복사하지 않는다.
- [x] 연결 포인트는 마우스로 잡기 쉽도록 기존보다 크게 만든다.

## 구현 TODO

- [x] 프론트 연결 규칙에서 `branch` 입출력 연결을 차단한다.
- [x] `FlowCanvas`에서 `branch` 노드를 렌더링하지 않는다.
- [x] `BranchNode`, `BranchNodePanel`, 관련 테스트를 제거한다.
- [x] canvas 드래그 연결과 사이드패널 연결 모두 source 단일 연결로 교체 저장한다.
- [x] `NodeDetailPanel`에 장면 복제 버튼을 추가한다.
- [x] 장면 삭제 버튼에 확인 창을 추가한다.
- [x] phase/start 노드 연결 핸들을 확대한다.
- [x] 백엔드 flow DAG validation에서 다중 outgoing edge를 거부한다.
- [x] mocked E2E에 branch 숨김, 장면 복제, 장면 삭제 흐름을 추가한다.

## Coverage Plan

- [x] `connectionValidation.test.ts`: branch 연결 금지와 start/phase 허용 규칙을 검증한다.
- [x] `useFlowData.test.ts`: `onConnect`, `connectNodes`, `duplicateNode`, `deleteNode` 상태 변화를 검증한다.
- [x] `FlowCanvas.test.tsx`: branch 노드와 branch 연결선이 canvas에 보이지 않는지 검증한다.
- [x] `NodeDetailPanel.test.tsx`: 삭제 confirm, 삭제 취소, 장면 복제 버튼 호출을 검증한다.
- [x] `BranchWiring.test.tsx`: branch UI 제거 후 flow wiring 기본 렌더링을 유지하는지 검증한다.
- [x] `validate_test.go`: backend가 다중 outgoing edge를 validation 오류로 막는지 검증한다.
- [x] `editor-golden-path.spec.ts`: 브라우저 흐름에서 branch 숨김, 장면 복제 POST, 장면 삭제 DELETE를 검증한다.

## E2E 체크리스트

- [x] `/editor/:themeId/flow` 진입 후 기존 phase 장면이 보인다.
- [x] 저장 데이터에 legacy `branch` 노드가 있어도 화면에는 보이지 않는다.
- [x] phase 장면 선택 후 `장면 복제`를 누르면 `/flow/nodes` POST가 발생한다.
- [x] 복제 요청 body는 원본 data를 유지하고 label만 `복사본`으로 바꾼다.
- [x] `선택 항목 삭제`를 누르면 confirm 수락 뒤 `/flow/nodes/:id` DELETE가 발생한다.

## 완성조건

- [x] 제작자가 생성한 장면을 UI에서 삭제할 수 있다.
- [x] 제작자가 생성한 장면을 같은 내용으로 복제할 수 있다.
- [x] 하나의 장면에서 여러 다음 장면으로 동시에 연결되지 않는다.
- [x] 새 연결 생성 시 같은 source의 기존 연결이 제거된다.
- [x] branch 노드는 신규 제작 UI에서 보이지 않고 연결 대상도 될 수 없다.
- [x] 백엔드 저장 검증도 다중 outgoing edge를 막아 클라이언트 우회를 방어한다.
- [x] 연결 포인트가 기존보다 크게 렌더링된다.
- [x] focused unit/component/backend/E2E 검증이 모두 통과한다.
- [x] `@mmp/web` typecheck가 통과한다.
- [x] 변경 diff에 의도하지 않은 파일이 섞이지 않는다.

## 검증 기록

- [x] RED: frontend focused tests expected failure.
- [x] RED: `go test ./internal/domain/flow` expected failure.
- [x] GREEN: frontend focused tests passed.
- [x] GREEN: `go test ./internal/domain/flow` passed.
- [x] GREEN: targeted mocked E2E passed.
- [x] GREEN: `pnpm --filter @mmp/web typecheck` passed.
- [x] GREEN: `pnpm --filter @mmp/web lint` passed with existing warnings only.
- [x] GREEN: `scripts/mmp-local-ci.sh quick` passed after commit.
