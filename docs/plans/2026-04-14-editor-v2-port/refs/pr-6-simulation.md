# PR-6: 흐름 시뮬레이션 패널

> Wave 3 | 의존: PR-3, PR-4 | Branch: `feat/phase-17.0/PR-6`

## 문제

게임 흐름 미리보기가 없음. 디자이너가 페이즈 순서/타이밍을 시각적으로 확인 불가.
v2는 SimulationPanel로 진행도, 현재 페이즈, 다음/처음 버튼 제공.

## 수정 대상

| 파일 | 변경 |
|------|------|
| 새 `design/FlowSimulationPanel.tsx` | 시뮬레이션 UI |
| `design/FlowCanvas.tsx` | 시뮬레이션 토글 + 노드 하이라이트 |

## v2 참고

- `GameFlowTab.tsx:103-253` — SimulationPanel 전체
- 진행 상태: currentIndex, totalPhases, 현재 페이즈 이름/시간

## Tasks

### Task 1: FlowSimulationPanel 컴포넌트
- 토폴로지 정렬로 Start→...→Ending 순서 계산
- 현재 페이즈 인디케이터 (진행 바 + 이름 + 시간)
- 다음/이전/처음 버튼
- 전체 예상 소요 시간 합계

### Task 2: 노드 하이라이트 연동
- 현재 시뮬레이션 페이즈의 노드에 하이라이트 CSS 적용
- FlowCanvas에서 simulationNodeId prop → 해당 노드 강조
- 시뮬레이션 비활성 시 하이라이트 해제

### Task 3: 테스트
- 토폴로지 정렬 결과 확인
- 다음/이전 버튼으로 페이즈 이동 확인
- 노드 하이라이트 렌더링 확인

## 검증

- [ ] 시뮬레이션 토글 → 패널 표시
- [ ] 다음 버튼 → 순차 페이즈 이동
- [ ] 현재 페이즈 노드 하이라이트
- [ ] 전체 소요시간 표시
- [ ] `pnpm test` pass
