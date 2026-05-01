# 02. 사이드바 분류 — B+C 하이브리드

> 결정: D-02 (entity-first + 작업 단계 그룹), D-03 (분리 모델), D-04 (모듈 토글 = 리스트 화면 상단).
> 대표 mockup: [q4](../mockups/q4-bc-hybrid-with-references.html), [q12](../mockups/q12-separation-refined.html)

## 결정 사항

### 사이드바 구조 (6 항목)

```
🎯 컨셉
─────────────────
1️⃣ 세계 정의            ← 그룹 헤더 (uppercase, 클릭 X)
  👤 캐릭터  (5)
  📍 장소     (8)
  🔍 단서     (12)
─────────────────
2️⃣ 흐름 & 결말          ← 그룹 헤더
  🎬 페이즈   (4)
  🎭 결말     (3)
─────────────────
🌐 글로벌 시스템 (6/12)
```

- **Entity 5** (👤📍🔍🎬🎭) + **글로벌 1** (🌐) = 6 항목
- 그룹 헤더 2 (작업 단계 가이드, Notion 식 라벨 — 클릭 X)
- 글로벌 항목은 별도 그룹 (구분선)

### 모듈 ON/OFF 위치 (분리 모델)

| 모듈 종류 | 어디서 ON/OFF | 클릭 동작 |
|---------|------------|---------|
| **글로벌 모듈** (voting / accusation / chat / audio / 탐색) | 🌐 글로벌 시스템 페이지 | **모달** (모두 동일) |
| **entity 연결 모듈** (starting_clue / evidence / round_clue / ...) | entity **리스트 화면** 상단 | 토글 (그 자리 ON/OFF) |

### 모듈 토글 위치 = entity 리스트 화면 (1개 편집 화면 X)

이유: 토글 효과는 **테마 전체 entity 에 적용** (예: starting_clue ON 하면 모든 캐릭터 폼에 섹션 추가). 1명 편집 화면에 두면 "여기서 끄면 다른 캐릭터에서도 꺼지나?" 헷갈림. 리스트 화면 = 영향 범위와 일치.

## 배경·근거

### B+C 하이브리드 = 무엇

- **B (Entity-first)**: 단서/장소/캐릭터부터 만들고 모듈은 capability 로 attach. 사용자 작업 흐름과 일치.
- **C (작업 단계 그룹 헤더)**: "1️⃣ 세계 / 2️⃣ 흐름 / 3️⃣ 글로벌" 같은 라벨. 초보자 길잡이.

A 옵션 (모듈 카테고리 식) 거부 — 단서가 4 카테고리에 흩어짐, entity-first 의도 어긋남.
C 옵션 (작업 단계만) 거부 — 고수에게 답답.

### 분리 모델 (D-03) — 일관성 회복

이전 시도 q10 (모듈 통합 페이지) 에서 발견한 문제: 카드 클릭이 **어떤 건 모달, 어떤 건 페이지 이동** = UX 일관성 깨짐.

해결 = 분리:
- 글로벌 모듈만 모듈 페이지 (모두 모달)
- entity 연결 모듈은 entity 페이지 안에서 토글 + 동적 섹션

이게 사용자 처음 직관 ("단서 편집 페이지랑 모듈 켜기 페이지 따로 있고") 의 자연스러운 형태.

### 업계 사례

| 도구 | 차용 |
|------|------|
| RPG Maker | entity-first 트리 (16 entity) — 우리는 5 + 그룹 헤더로 더 가벼움 |
| Notion / Linear | uppercase 그룹 헤더 (WORKSPACE / PRIVATE / SHARED) — 우리 1️⃣2️⃣ 패턴 |
| World Anvil | 사용자 커스텀 카테고리 — 우리는 고정 3 그룹 |

## UX 디테일

### 그룹 헤더 동작

- 클릭 안 됨 (시각 라벨만)
- "1️⃣ 세계 정의" 같은 이모지 + 라벨
- 작은 글씨 (10px), 회색 (`#888`)

### 카운트 표시

각 entity 항목 옆 숫자:
- `👤 캐릭터  (5)` — 등록된 entity 수
- `🌐 글로벌 시스템 (6/12)` — 켜진 모듈 / 전체

### entity 리스트 화면 헤더 = 모듈 토글 박스

mockup q13 / q14 패턴:

```
🧩 단서 관련 모듈 (전체 단서에 적용)
[☑ conditional_clue] [☑ combination] [☐ clue_interaction]
→ 켜면 모든 단서 편집 폼에 해당 섹션 자동 추가
```

토글 박스는 리스트 표 위, "+추가" 버튼 위에 배치.

## 현재 코드 차용

| 영역 | 기존 코드 |
|------|---------|
| 사이드바 구조 | `apps/web/src/features/editor/components/EditorLayout.tsx` (있다면) — 사이드바 6 항목으로 재구성 |
| entity 리스트 | 기존 `CharactersSubTab` / `LocationsSubTab` / `CluesSubTab` 패턴 차용 + 상단 모듈 토글 박스 신설 |

## 참고 mockup

- [q1](../mockups/q1-primary-concept.html) — 1차 시민 컨셉 비교 (A/B/C)
- [q3](../mockups/q3-concept-taxonomy.html) — 컨셉 분류 3 옵션 비교
- [q4](../mockups/q4-bc-hybrid-with-references.html) — B+C 하이브리드 + 실제 도구 사례
- [q12](../mockups/q12-separation-refined.html) — 분리 모델 + B 옵션 (모듈 토글 위치)
