# 03. 캐릭터 entity

> 결정: D-06.
> 대표 mockup: [q6](../mockups/q6-entity-crud-base-fields.html)

## 결정 사항

### 베이스 필드 (항상)

| 필드 | 타입 | 비고 |
|------|-----|------|
| 이름 (표시) | string | 예: "김철수" |
| 캐릭터 코드 | string | 시스템 식별자, 예: "탐정" / "양지" |
| 사진 | image upload | 선택 |
| 공개 소개 | string (multiline) | 모든 플레이어에게 공개되는 짧은 소개 |

### 📜 역할지 (Role Sheet) — Markdown

- v2 `contentService.getRoleSheet(characterCode)` 모델 그대로
- markdown content: 비밀·동기·알리바이·다른 캐릭터 정보 등 자유 작성
- 별도 컨텐츠 영역 (베이스와 분리, 색상으로 구분)
- 게임 시작 시 해당 캐릭터를 맡은 플레이어에게만 노출

### 🧩 동적 모듈 섹션 (모듈 ON 시)

| 모듈 | 섹션 내용 |
|------|---------|
| `starting_clue` | "이 캐릭터에게 시작 시 줄 단서들" — 단서 multi-select + 분배 시점 (`game_start`/`first_phase`/`after_reading`) |
| `hidden_mission` | "이 캐릭터의 숨겨진 임무" — Markdown 컨텐츠 |

### CRUD UX

- 좌측 캐릭터 리스트 + "+추가" 버튼
- 우클릭 → 복제 / 삭제
- 드래그 → 순서 변경
- 클릭 → 우측 편집 폼

## 배경·근거

### 역할지 = Markdown 자유 작성 (구조화 폼 X)

mockup q6 결정 — 옵션 3 가지:
1. ⭐ 자유 Markdown (v2 호환, 자유도 ↑)
2. 구조화 폼 (비밀/동기/알리바이 별도 필드)
3. 쪽 (page) 단위

자유 Markdown 채택. 이유: 머더미스터리 작가의 자유도 + v2 기존 컨텐츠 마이그레이션 호환.

### 캐릭터 ↔ 단서 참조 = ID 만

`starting_clue` 섹션의 단서 multi-select 는 단서 ID 만 저장 (`["c1","c3"]` 등). 단서 자체 (이름·이미지·발견 컨텐츠) 는 단서 페이지에서만 정의 → §10 참조.

## UX 디테일

### 편집 폼 구조 (위에서 아래)

```
⚙️ 김철수 편집

📋 베이스 (항상)
  이름·코드·사진·공개 소개

📜 역할지 (Markdown)
  ## 당신의 정체
  ## 비밀
  ## 동기
  ## 알리바이

🟢 starting_clue 옵션 (모듈 ON 시)
  분배 시점: game_start
  받을 단서: [c1 일기장 ✕] [c3 칼 ✕]

🟢 hidden_mission 옵션 (모듈 ON 시)
  # 임무
  정대호의 협박 증거를 찾아 폐기하라.

[저장] [삭제] [복제]
```

### "사용처 자동 표시" (옵션, 단서 entity 와 동일 패턴)

캐릭터 페이지 하단에 "이 캐릭터가 사용된 곳":
- 🔍 단서 (starting_clue 시작 단서로)
- 📍 장소 (접근 제한 캐릭터로)
- ❓ 결말 분기 질문 (응답 캐릭터로)

→ 클릭 시 해당 페이지로 이동

## 현재 코드 차용

| 영역 | 기존 |
|------|-----|
| 캐릭터 CRUD | Phase C-4 (PR 미완료) — 본 phase 에서 완성 |
| 역할지 | v2 `contentService.getRoleSheet()` 모델 차용. v3 `theme_contents.body` 컬럼에 저장 (이미 schema 있음) |
| 캐릭터 ↔ 단서 매핑 | 기존 `CharacterAssignPanel` 의 `config_json.character_clues` (charId → clueIds) 패턴 — `starting_clue` 동적 섹션으로 마이그레이션 |

## 미해결 디테일

- **승리 조건 필드** — 캐릭터별 승리 조건이 베이스인지 모듈인지. 머더미스터리 도메인에서 보통 `hidden_mission` 모듈 영역.
- **다중 역할지** — 한 캐릭터에 여러 분기 역할지 (예: 진실 / 거짓 두 버전) 필요한 게임이 있을지. 향후 phase.

## 참고 mockup

- [q6](../mockups/q6-entity-crud-base-fields.html) — 캐릭터 베이스 + 역할지
- [q8](../mockups/q8-all-modules-on-full-ui.html) — 모듈 ON 시 풀 모습 (캐릭터 섹션)
