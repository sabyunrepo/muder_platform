# 04. 장소 entity

> 결정: D-07.
> 대표 mockup: [q7](../mockups/q7-location-entity.html)

## 결정 사항

### 베이스 필드 (항상)

| 필드 | 타입 | 비고 |
|------|-----|------|
| 이름 | string | 예: "서재" |
| 로케이션 코드 | string | 예: "study_room" |
| 이미지 | image upload | 단순 사진 1장 (인터랙티브 맵은 별 phase) |
| 공개 설명 | string (multiline) | 모든 플레이어에게 공개 |
| 부모 장소 | location_id (nullable) | Tree 구조, 무한 중첩 |
| 진입 메시지 | string (Markdown) | 들어왔을 때 표시되는 분위기 텍스트 |
| 접근 제한 캐릭터 | character_ids[] | 체크박스, 차단된 캐릭터는 못 들어옴 |

### 🧩 동적 모듈 섹션 (모듈 ON 시)

| 모듈 | 섹션 내용 |
|------|---------|
| `evidence` | "이 장소의 자동 발견 증거" — 단서 multi-select + 등장 페이즈 |
| `location_clue` | "이 장소에서 검색 시 발견" — 단서 multi-select + 반복 검색 토글 |
| `location` | 메타데이터 (현재 schema 미구현, 추후 확장) |

### Tree 구조 (좌측 리스트)

```text
🏠 별장
└ 🏢 1층
  └ 📖 서재 ◀ (편집 중)
  └ 🛋️ 거실
  └ 🍳 부엌
└ 🏢 2층
  └ 🛏️ 침실
  └ 🛁 욕실
🌳 정원
```

- 들여쓰기로 트리 표현
- 드래그 → 부모 변경
- 클릭 → 펼침/접힘
- 우클릭 → 복제 / 삭제

## 배경·근거

### Tree 깊이 = 무한 중첩

mockup q7 결정 4건 중 1건. 옵션:
- ⭐ 무한 중첩 (사용자 자유)
- 2단계 제한 (건물→방)
- 평면 (parent 없음)

무한 채택. 이유: 머더미스터리 게임 다양성 (호텔·저택·복잡한 다층 구조 등) 표현 자유 우선. 깊이 제한 = 답답함 risk.

### 접근 제한 = 베이스 필드

옵션:
- ⭐ 베이스 (현재 결정)
- 모듈 capability (특정 모듈 ON 시만 노출)

베이스 채택. 이유: 머더미스터리 도메인 핵심 기능. Phase 19 D-SEC-5 메모에서도 `RestrictedCharacters` = "creator metadata" 분류.

### 이미지 = 단순 사진 (인터랙티브 맵 X)

Phase 24 범위에 인터랙티브 평면도 (x,y 좌표 / 클릭 가능 영역) 포함 안 함. 이유:
- Scope creep 회피
- 기존 v3 에 평면도 시스템 없음 → 신설 = 별 phase
- 머더미스터리 게임 80% 가 단순 사진으로 충분

별 phase 후보: "평면도 좌표 + 인터랙티브 맵" — Phase 25+ 검토.

### 진입 메시지 = 추가 베이스 필드

원래 mockup q7 베이스에 없었으나 추가. 이유: 머더미스터리 분위기 (장소 들어왔을 때 분위기 묘사) 가 중요한데 모듈로 처리하면 토글 의존 — 베이스가 자연.

## UX 디테일

### 편집 폼 구조

```text
⚙️ 서재 편집

📋 베이스 (항상)
  이름·코드·이미지·공개 설명
  📂 부모 장소: [1층 ▼]   ← 계층 자동 표시: 별장 ⊃ 1층 ⊃ 서재
  📩 진입 메시지: (Markdown)
  🔒 접근 제한:
    ☐ 김철수 (탐정)
    ☑ 이영희 (용의자A) — 차단
    ☐ 박민수
    ☐ 최지영
    ☐ 정대호

🟢 evidence 옵션 (모듈 ON 시)
  배치 단서: [c5 시체 ✕] [c6 흉기 ✕]
  자동 발견 ☑
  등장 페이즈: phase 1부터

🟢 location_clue 옵션 (모듈 ON 시)
  숨겨진 단서: [c1 일기장 ✕] [c2 편지 ✕]
  단서 개수 표시 ☑
  반복 검색 ☐

🟢 room_exploration 옵션 (모듈 ON 시 — 글로벌이지만 장소별 설정)
  최대 동시 인원: 3
  이동 쿨다운: 30초

🟢 audio 옵션 (모듈 ON 시)
  진입 BGM: study_ambient.mp3
  페이드 인: 2초

[저장] [삭제] [복제]
```

### 부모 장소 dropdown

- 자기 자신과 자기 자손은 부모로 선택 불가 (순환 방지)
- 클릭 시 트리 dropdown 으로 모든 장소 표시 + 들여쓰기

## 현재 코드 차용

| 영역 | 기존 |
|------|-----|
| 장소 CRUD | 기존 `LocationsSubTab` / `LocationDetailPanel` 패턴 |
| Tree | 신설 (현재 v3 평면 구조). React DnD or `@hello-pangea/dnd` 라이브러리 검토 |
| 접근 제한 | `service_location.go:140,168` `RestrictedCharacters *string` (CSV) — 현 schema 보존 or `string[]` 으로 정규화 검토 (Phase 19 D-SEC-5) |

## 미해결 디테일

- **검색 가능 토글** = 베이스 vs 모듈 (`location_clue` 가 ON 이어야 검색 가능?). 현재 모듈 의존으로 결정.
- **분위기 태그** (예: "어둠", "공포", "고요") — 베이스 추가? 단순함 우선 = skip.
- **인터랙티브 맵** — 별 phase 25+ 후보.

## 참고 mockup

- [q7](../mockups/q7-location-entity.html) — 장소 Tree + 베이스 + 모듈 동적 섹션
- [q8](../mockups/q8-all-modules-on-full-ui.html) — 4 모듈 동시 ON 시 풀 모습 (장소 섹션 5)
