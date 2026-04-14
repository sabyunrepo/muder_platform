# PR-5: Ending 노드

> Phase 15.0 | Wave 3 | 의존: PR-3, PR-4

---

## 변경 범위

### Ending 노드
- `EndingNode.tsx`: 둥근사각 커스텀 노드 (입력 핸들만)
- 라벨 + 점수배율 badge 표시
- 색상: 엔딩별 구분 (성공=green, 실패=red, 중립=slate)

### Ending 편집 패널
- `EndingNodePanel.tsx`: 우측 사이드패널
- 라벨 input, 설명 textarea, 점수배율 number
- 엔딩 타입 select (승리/패배/분기)

### NodeDetailPanel 확장
- ending 타입 → EndingNodePanel 렌더링

---

## Task 목록

1. **EndingNode.tsx** — 엔딩 커스텀 노드
2. **EndingNodePanel.tsx** — 엔딩 편집 사이드패널
3. **NodeDetailPanel 확장** — ending 타입 라우팅
4. **FlowCanvas 업데이트** — EndingNode 등록
5. **FlowToolbar 업데이트** — Ending 추가 버튼
6. **테스트** — EndingNode + 패널

---

## 테스트

- `EndingNode.test.tsx`: 렌더링, 점수배율 표시
- `EndingNodePanel.test.tsx`: 폼 입력 + 변경
