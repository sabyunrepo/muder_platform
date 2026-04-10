# PR C-4: Character CRUD (리팩토링)

> Phase C | 의존: C-1 | Wave: W2 (C-2, C-3과 병렬)

---

## 목표
기존 `CharactersTab` + `CharacterForm`을 3-column 레이아웃에 맞게 리팩토링.
Sidebar에 컴팩트 리스트, RightPanel에 상세 편집.

## 변경 파일

**신규**
```
apps/web/src/features/editor/
  components/Sidebar/CharacterList.tsx   # Sidebar용 컴팩트 리스트
  components/RightPanel/CharacterEditor.tsx  # RightPanel용 편집 폼
```

**수정**
```
apps/web/src/features/editor/
  components/Sidebar/SidebarPanel.tsx    # CharacterList 통합
  components/RightPanel/RightPanel.tsx   # CharacterEditor 통합
```

## CharacterList (Sidebar)

- 컴팩트 리스트: 이름 + 역할 아이콘 + 범인 뱃지
- 선택 → `selectedNodeId` 설정 → RightPanel에 편집 폼
- 드래그앤드롭 정렬 (sort_order 변경)
- 최대 20명 제한 (시스템 제약)

## CharacterEditor (RightPanel)

- `selectedNodeId`가 character일 때만 표시
- react-hook-form + zod 검증 (C-3과 동일 패턴)
- 저장 → `useUpdateCharacter` → optimistic update
- 삭제 확인 모달

## API (기존, 변경 없음)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/v1/editor/themes/{id}/characters` | 목록 |
| POST | `/v1/editor/themes/{id}/characters` | 생성 |
| PUT | `/v1/editor/characters/{id}` | 수정 |
| DELETE | `/v1/editor/characters/{id}` | 삭제 |

## 테스트

- `CharacterList.test.tsx`: 선택, 드래그 정렬, 20명 제한
- `CharacterEditor.test.tsx`: 폼 검증, 저장, 삭제
