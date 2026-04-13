# PR-5: 단서→장소 배치 UI

## 개요
단서를 장소에 배치하는 UI.

## scope_globs
- apps/web/src/features/editor/components/design/AssignmentSubTab.tsx
- apps/web/src/features/editor/components/design/CluePlacementPanel.tsx

## 구현
1. 2컬럼 레이아웃: 좌(미배치 단서), 우(장소별 단서)
2. 단서 클릭 → 장소 선택 드롭다운으로 배정
3. 배치된 단서는 장소 아래에 표시
4. config_json.clue_placement = { clueId: locationId } 로 저장
5. useEditorClues + useEditorLocations 조합

## 테스트
- 단서 배치/해제
- 미배치 단서 목록 필터링
