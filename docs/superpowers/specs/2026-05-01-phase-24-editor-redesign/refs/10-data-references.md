# 10. 데이터 참조 패턴

> 결정: D-09 (단서 = 단일 진실 위치), 자동 backlink 패턴.
> 관련 mockup: [q13](../mockups/q13-clue-entity.html)

## 결정 사항

### 단일 진실 위치 (Single Source of Truth)

**모든 entity 는 자기 페이지에서만 정의되고, 다른 곳에서는 ID 참조만 한다.**

| 작업 | 어디서 |
|------|-----|
| 단서 c1 만들기 | 🔍 단서 페이지에서만 |
| 단서를 장소에 등록 | 📍 장소의 `evidence` 섹션 — `clueId: "c1"` 참조만 |
| 단서를 캐릭터 시작 단서로 | 👤 캐릭터의 `starting_clue` — `clueId: "c1"` 참조만 |
| 단서 내용 수정 | 🔍 단서 페이지에서 1번 → 모든 참조처 자동 반영 |

비유: 노션 페이지 1장 + 여러 곳에서 @언급. WordPress / Articy:draft / Notion 표준.

### 자동 Backlink

각 entity 페이지 하단에 "이 entity 가 사용된 곳" 자동 표시. 사용자 수동 입력 X.

| Entity | Backlink 출처 |
|--------|------------|
| 🔍 단서 | 📍 장소 (evidence/location_clue) · 👤 캐릭터 (starting_clue) · 🔍 다른 단서 (조합) · ❓ 결말 분기 질문 (보기) |
| 👤 캐릭터 | 🔍 단서 (starting_clue 의 charCode) · 📍 장소 (접근 제한) · ❓ 분기 질문 (응답 캐릭터) |
| 📍 장소 | 🔍 단서 (이 장소에 배치) · 🎬 페이즈 (이 페이즈에 등장) · 🔧 부모/자식 관계 |
| 🎬 페이즈 | 🎬 다른 페이즈 (Flow edge) · 🎭 결말 (분기 노드 연결) |
| 🎭 결말 | 🎬 페이즈 (Flow 결말 노드) · ❓ 분기 매트릭스 (매핑 결과) |

### 참조 무결성 (Referential Integrity)

**삭제 시 경고**:
- 단서 c1 삭제 → "이 단서가 3 곳에서 자동 제거됨 (서재·김철수·c8 진실의 증거)" 다이얼로그
- 캐릭터 삭제 → "이 캐릭터의 starting_clue·접근 제한·분기 질문 응답에서 자동 제거됨" 다이얼로그
- 강제 삭제 옵션 + 취소 옵션

### 미사용 표시

각 entity 리스트에서 어디서도 안 쓰이는 entity 는 "— 미사용" 표시. 사용자가 만들고 잊은 dead entity 발견 도움.

## 배경·근거

### 왜 단일 진실 위치

이전 v3 의 단점:
- 같은 단서가 3 패널 (`clue_placement` / `locations[].clueIds` / `character_clues`) 에 흩어짐
- 동기화 코드 부재 → 두 패널 동시 열면 충돌 risk
- 단서 1개 수정에 N 곳 업데이트 — 일관성 위반 risk

해결 = 1 곳 정의 + 다른 곳 참조. DRY 원칙.

### 왜 자동 Backlink

수동 입력 = 사용자가 "이 단서가 어디서 쓰이는지" 일일이 추적 — 휴먼 에러 + 노동.

자동 = 다른 entity 가 단서 ID 참조하는 시점에 인덱싱. Notion / Articy:draft 식 — 백엔드가 역참조 인덱스 유지.

### 업계 사례

| 도구 | 패턴 |
|------|-----|
| Notion | Database Relation 양방향 동기화 |
| Articy:draft | Entity Cross-References (자동 갱신) |
| Linear | Issue 사이 link backlinks |
| Roam Research | Bi-directional links |

## 데이터 모델 함의

### 백엔드 신설 필요

| 영역 | 무엇 |
|------|-----|
| Backlink 인덱스 | DB 테이블 또는 derived 쿼리로 역참조 자동 산출 |
| 참조 무결성 검사 | entity 삭제 전 N 곳 사용 탐지 |
| 미사용 entity 탐지 | 어디서도 참조 안 되는 entity 식별 |

### TypeScript 타입 예시

```typescript
// 단서 entity 정의
interface Clue {
  id: string;        // "c1"
  name: string;      // "일기장"
  imageUrl?: string;
  discoveryContent: string;  // Markdown
  conditionalClueConfig?: ConditionalClueOption;  // 모듈 ON 시
  combinationConfig?: CombinationOption;
  interactionConfig?: ClueInteractionOption;
}

// 장소가 단서를 참조 (ID 만)
interface Location {
  id: string;
  name: string;
  // ...
  evidenceConfig?: {
    clueIds: string[];  // ← ID 만 (Clue 객체 X)
    autoDiscover: boolean;
    availableAtPhase?: number;
  };
  locationClueConfig?: {
    clueIds: string[];  // ← ID 만
    showCount: boolean;
    allowRepeatSearch: boolean;
  };
}

// 자동 backlink 결과
interface ClueBacklinks {
  clueId: string;
  references: Array<{
    sourceType: 'location' | 'character' | 'clue' | 'question';
    sourceId: string;
    sourceName: string;  // 표시용
    relation: 'evidence' | 'location_clue' | 'starting_clue' | 'combination_input' | 'question_choice';
  }>;
}
```

### config_json shape (장소 예)

```json
{
  "id": "study_room",
  "name": "서재",
  "parentLocationId": "floor_1",
  "restrictedCharacterCodes": ["용의자A"],
  "evidenceConfig": {
    "clueIds": ["c5", "c6"],
    "autoDiscover": true,
    "availableAtPhase": 1
  },
  "locationClueConfig": {
    "clueIds": ["c1", "c2"],
    "showCount": true,
    "allowRepeatSearch": false
  }
}
```

→ 단서 c1 의 데이터 (이름·이미지·발견 컨텐츠) 는 별도 단서 entity 에 1번 정의됨. 장소는 ID 만 참조.

## 마이그레이션 함의 (§O-02)

기존 v3 데이터:
- `config_json.clue_placement: { [clueId]: locationId }` — 1:1 매핑
- `config_json.locations[].clueIds: string[]` — location-centric (dead key)
- `config_json.character_clues: { [charId]: string[] }` — character-centric

→ Phase 24 모델로 마이그레이션:
- `clue_placement` → `locations[].locationClueConfig.clueIds` (search 모드 가정)
- `locations[].clueIds` → 동일하게 `locationClueConfig.clueIds`
- `character_clues` → 새 모듈 `starting_clue` 의 `startingClues` 매핑

기존 데이터 보존 + 점진 마이그레이션 (writing-plans 단계 결정).

## 미해결 디테일

- **Backlink 인덱스 위치** — DB 별도 테이블 vs derived 쿼리 (성능 vs 단순성). writing-plans 단계 결정.
- **순환 참조 처리** — `combination` 으로 단서 A + B = C, C + A = D ... 무한 루프 가능성. validation 필요.
- **Soft delete** — entity 삭제 시 즉시 vs 휴지통 (복원 가능). 사용자 결정 위임.

## 참고 mockup

- [q13](../mockups/q13-clue-entity.html) — 자동 backlink 표시 + 미사용 단서
- [q8](../mockups/q8-all-modules-on-full-ui.html) — 5 entity 의 참조 패턴 풀 모습
