# PR-6: 캐릭터→단서/미션 배정 UI

## 개요
캐릭터별 시작 단서와 히든 미션 배정.

## scope_globs
- apps/web/src/features/editor/components/design/CharacterAssignPanel.tsx
- apps/web/src/features/editor/components/design/MissionEditor.tsx

## 구현
1. 좌측: 캐릭터 목록 (useEditorCharacters)
2. 우측: 선택한 캐릭터의 시작 단서 체크박스 + 히든 미션 편집
3. 시작 단서: 전체 단서 목록에서 체크 → character_clues[charId] = [clueIds]
4. 히든 미션: 미션 추가 폼 (description, type, points, targetClueId)
   → character_missions[charId] = [{ id, type, description, points, ... }]
5. config_json에 저장

## 테스트
- 캐릭터 선택 → 단서 체크
- 미션 추가/삭제
