# PR C-5: Clue List View + Clue API 확장

> Phase C | 의존: C-1 | Wave: W2 (C-2~C-4와 병렬)

---

## 목표
단서 리스트 뷰 (Phase C 범위). 그래프 뷰는 Phase D.
ClueType enum 확장 + category 컬럼 추가.

## 변경 파일

**신규 (Frontend)**
```
apps/web/src/features/editor/
  components/Sidebar/ClueList.tsx       # Sidebar용 컴팩트 리스트
  components/RightPanel/ClueEditor.tsx   # RightPanel용 편집 (기본 필드)
  components/Canvas/ClueTableView.tsx    # Canvas용 테이블 뷰
  stores/clueStore.ts                   # 단서 상태 (Zustand)
```

**수정 (Frontend)**
```
apps/web/src/features/editor/
  api.ts                                # ClueType 확장 types
  components/Sidebar/SidebarPanel.tsx   # ClueList 통합
```

**수정 (Backend)**
```
apps/server/internal/domain/editor/
  types.go                              # ClueType enum 확장, category 추가
  handler.go                            # CreateClue/UpdateClue 확장
```

## ClueType 확장

기존: `normal`, `weapon`, `evidence`, `alibi`
신규: `evidence`, `testimony`, `weapon`, `alibi`, `deduction`, `key_item`, `red_herring`

> `normal` 제거, `testimony`/`deduction`/`key_item`/`red_herring` 추가

## CreateClueRequest 확장

```go
type CreateClueRequest struct {
    // 기존 (유지)
    LocationID  *uuid.UUID `json:"location_id"`
    Name        string     `json:"name" validate:"required,min=1,max=200"`
    Description *string    `json:"description" validate:"omitempty,max=2000"`
    ImageURL    *string    `json:"image_url" validate:"omitempty,url"`
    IsCommon    bool       `json:"is_common"`
    Level       int32      `json:"level" validate:"min=1,max=10"`
    ClueType    string     `json:"clue_type" validate:"required"`
    SortOrder   int32      `json:"sort_order" validate:"min=0"`
    // 신규
    Category    string     `json:"category" validate:"omitempty,max=50"`
}
```

## ClueTableView (Canvas)

- 테이블: ID, 이름, 타입, 배포방식, 레벨, 유효성
- 필터: 타입별, 카테고리별
- 검색: 이름 기반
- 일괄 선택 + 삭제
- 최대 200개 제한 (시스템 제약)

## ClueList (Sidebar)

- 컴팩트: 이름 + 타입 아이콘 + 레벨 뱃지
- 선택 → RightPanel 편집

## 테스트

- `ClueList.test.tsx`: 필터, 검색, 선택
- `ClueTableView.test.tsx`: 테이블, 필터, 일괄 삭제
- `clueStore.test.ts`: 상태 업데이트
