# 단서 아이템 시스템 설계

## 개요
단서(clue)에 사용 가능 속성을 추가하여, 게임 중 아이템으로 활용하는 범용 시스템.

## 효과 종류

| effect | 설명 | 대상 | MVP |
|--------|------|------|-----|
| peek | 상대 단서 1개 열람 | player | ✅ |
| steal | 상대 단서 강탈 | player | ❌ |
| reveal | 상대 단서 강제 공개 | player | ❌ |
| block | 다음 아이템 무효화 | self | ❌ |
| swap | 강제 교환 | player | ❌ |

> MVP에서는 peek만 구현. 나머지는 effect 타입만 정의, 핸들러는 "미구현" 에러 반환.

## ClueInteraction 확장

### 기존 메시지 (변경 없음)
- `draw_clue`, `transfer_clue`

### 신규 메시지
- `clue:use` — 아이템 사용 선언
- `clue:use_target` — 대상 지정
- `clue:use_cancel` — 사용 취소

### 내부 상태
```go
type ItemUseState struct {
    UserID    uuid.UUID
    ClueID    uuid.UUID
    Effect    string
    Target    string
    StartedAt time.Time
}
```

## 에디터 UI

ClueForm에 토글 추가:
- ☑ 사용 가능 (아이템) → 하위 필드 노출
  - 효과: select (peek/steal/reveal/block/swap)
  - 대상: select (player/clue/self)
  - 사용 후 소멸: checkbox (기본 true)
