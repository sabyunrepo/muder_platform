# PR-3: 맵/장소 관리 UI

## 개요
맵과 장소를 CRUD 관리하는 UI. 백엔드 API는 이미 존재.

## scope_globs
- apps/web/src/features/editor/components/design/LocationsSubTab.tsx
- apps/web/src/features/editor/api.ts (hooks 추가)

## 구현
1. 좌측: 맵 목록 (추가/삭제)
2. 우측: 선택한 맵의 장소 목록 (추가/편집/삭제)
3. 장소: 이름 + restricted_characters (선택적)
4. API hooks: useEditorMaps, useCreateMap, useDeleteMap, useEditorLocations 등
   (api.ts에 MapResponse, LocationResponse 타입은 이미 정의됨)

## 테스트
- 맵/장소 CRUD 렌더링
