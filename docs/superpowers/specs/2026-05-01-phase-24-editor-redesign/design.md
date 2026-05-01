# Phase 24 — 에디터 ECS 재설계 (Design Spec)

> 머더미스터리 플랫폼 v3 에디터를 **Entity-Component-System (ECS)** 패턴으로 재설계.
> 작성일: 2026-05-01 · 상태: brainstorm 완료, 미해결 항목 있음 (§7).

## 1. TL;DR

현재 v3 에디터는 백엔드 32 모듈의 풍부한 표현력을 못 따라가고 있다. **단서를 등록하는 패널이 3 곳에 흩어져** 있고 모듈 설정 위치 표준 (`modules` vs `module_configs`)이 부재하며, `locations[].clueIds` 같은 키는 에디터가 채워도 런타임이 안 읽는 dead key 가 존재.

Phase 24 는 이를 **ECS 패턴**으로 재구성한다:
- **Entity 5 종** (캐릭터·장소·단서·페이즈·결말) 을 1차 시민으로
- **모듈 = capability** — entity 폼에 동적 섹션으로 attach
- **글로벌 모듈** = 별도 페이지 + 모달 패턴 (모든 카드 클릭 = 모달, 일관성)
- **결말 분기 = 질문 + 답 매트릭스** 시스템 (정답 없는 분기, 점수 가감 별도 차원)

업계 표준 (Articy:draft / Unity Inspector / RPG Maker / Notion / WordPress ACF) 의 3-way 합. §1 참조.

## 2. 결정 인덱스

각 결정의 한 줄 요약 + 상세 레퍼런스 링크.

| # | 영역 | 결정 | 근거 ref | 대표 mockup |
|---|------|------|---------|-----------|
| D-01 | 아키텍처 패턴 | ECS — 페이지 분리 + 동적 섹션 | [01](refs/01-architecture.md) | q2 |
| D-02 | 사이드바 분류 | B+C 하이브리드 (entity 5 + 글로벌 1) | [02](refs/02-sidebar-taxonomy.md) | q4 |
| D-03 | 모듈 ON/OFF 위치 | 분리 — 글로벌은 모듈 페이지, entity 연결은 entity 리스트 | [02](refs/02-sidebar-taxonomy.md), [08](refs/08-modules-page.md) | q12 |
| D-04 | 모듈 토글 위치 | entity **리스트 화면** 상단 (영향 범위 일치) | [02](refs/02-sidebar-taxonomy.md) | q12 |
| D-05 | 글로벌 모듈 UX | 카드 클릭 = **모달** (모두 동일, 일관성) | [08](refs/08-modules-page.md) | q11, q12 |
| D-06 | 캐릭터 entity | 베이스 + 역할지 (Markdown) + 모듈 동적 섹션 | [03](refs/03-entity-character.md) | q6 |
| D-07 | 장소 entity | Tree 무한 중첩 + 접근 제한 (베이스) + 단순 사진 | [04](refs/04-entity-location.md) | q7 |
| D-08 | 단서 entity | 단일 진실 위치 + 자동 backlink + 미사용 표시 | [05](refs/05-entity-clue.md) | q13 |
| D-09 | 단서 참조 패턴 | 다른 entity 는 ID 참조만 (Notion 식) | [05](refs/05-entity-clue.md), [10](refs/10-data-references.md) | q13 |
| D-10 | 페이즈 entity | Flow 다이어그램 메인 뷰 + 노드 더블클릭 편집 | [06](refs/06-entity-phase.md) | q14 |
| D-11 | 결말 entity | 점수 배수 ❌ (1.0 고정), 두 탭 (목록 + 분기) | [07](refs/07-entity-ending-branch.md) | q15-19 |
| D-12 | 결말 분기 시스템 | 질문 + 답 매트릭스 (정답 X, 답 자체 매칭) | [07](refs/07-entity-ending-branch.md) | q17-19 |
| D-13 | 결말 단위 | 공통 결말 (모두 같은 엔딩) | [07](refs/07-entity-ending-branch.md) | q19 |
| D-14 | 점수 시스템 | 별 차원 (질문 영향 = 결말 분기 OR 점수 가감 택1) | [07](refs/07-entity-ending-branch.md) | q18-19 |
| D-15 | 점수 가시성 | 플레이어 답할 때 ❌ 숨김, 게임 끝 표시 | [07](refs/07-entity-ending-branch.md) | q19 |
| D-16 | 모듈-entity 매핑 | 21 모듈 분류 (회색지대 3 그룹 결정) | [09](refs/09-module-mappings.md) | q5 |
| D-17 | clue_interaction 옵션 | 발견자/공개/전달 가능 = 모듈 capability | [09](refs/09-module-mappings.md) | — |
| D-18 | voting 결과 → 매트릭스 | 자동 컬럼 (별도 질문 X) | [07](refs/07-entity-ending-branch.md) | q17-19 |

## 3. 핵심 다이어그램

### 3.1 사이드바 구조 (B+C 하이브리드)

```
🎯 컨셉
─────────────────
1️⃣ 세계 정의
  👤 캐릭터  (5)
  📍 장소     (8)
  🔍 단서     (12)
─────────────────
2️⃣ 흐름 & 결말
  🎬 페이즈   (4)
  🎭 결말     (3)
─────────────────
🌐 글로벌 시스템 (6/12)
```

총 6 항목. entity 5 + 글로벌 1.

### 3.2 ECS 페이지 흐름

```
┌──────────────────────────────────────┐
│ 🌐 글로벌 시스템 페이지              │
│  - voting / accusation / chat / ...  │
│  - 카드 클릭 → 모달                  │
│  - ON 시 voting 결과가 매트릭스에 자동│
└────────────┬─────────────────────────┘
             │ 게임 단위 1번 결정
             ▼
┌──────────────────────────────────────┐
│ 👤📍🔍🎬🎭 entity 페이지              │
│                                      │
│  [리스트 화면]                        │
│   상단 = 모듈 토글 (전체 entity 영향) │
│   아래 = entity 리스트 + "+추가"      │
│           │                          │
│           ▼ entity 1개 클릭          │
│  [편집 화면]                          │
│   - 베이스 필드                      │
│   - Markdown 컨텐츠 (해당 entity 만) │
│   - 🟢 동적 모듈 섹션 (켜진 모듈만)   │
│   - 🔗 자동 backlink (단서만)         │
└──────────────────────────────────────┘
```

### 3.3 결말 분기 시스템 (3 화면)

```
[제작자 설정]                  [플레이어 답]               [게임 끝]
질문 + 점수 정의       →      점수 숨김 답 입력      →    공통 결말 + 응답 표
(에디터 매트릭스 편집)         (단순 보기 클릭)             (Markdown + breakdown)
```

## 4. 영역별 결정 요약

각 영역은 별도 ref 파일로 분리. 아래는 한 단락씩.

### 4.1 아키텍처 ([01](refs/01-architecture.md))

ECS 패턴 채택. 페이지 두 종류 (모듈 ON/OFF + entity 편집) 분리. 모듈 ON 결과로 entity 폼이 동적 변화. Unity Inspector / Articy:draft Templates 패턴 참고.

### 4.2 사이드바 ([02](refs/02-sidebar-taxonomy.md))

B+C 하이브리드: Entity-first (B) + 작업 단계 그룹 헤더 (C). 사이드바 6 항목 (entity 5 + 글로벌 1).

### 4.3 모듈 페이지 ([08](refs/08-modules-page.md))

글로벌 모듈만 노출. entity 연결 모듈은 entity 페이지에서 직접 토글. 일관성 = 모든 카드 클릭 = 모달.

### 4.4 Entity 5 종

- **캐릭터** ([03](refs/03-entity-character.md)): 베이스 (이름·코드·사진·공개 소개) + 📜 역할지 Markdown + 모듈 (`starting_clue`, `hidden_mission`)
- **장소** ([04](refs/04-entity-location.md)): 베이스 (이름·코드·이미지·공개 설명·진입 메시지) + 부모 Tree (무한 중첩) + 접근 제한 + 모듈 (`evidence`, `location_clue`, `location`)
- **단서** ([05](refs/05-entity-clue.md)): 베이스 (이름·코드·이미지) + 📄 발견 시 컨텐츠 + 자동 역참조 + 모듈 (`conditional_clue`, `combination`, `clue_interaction`)
- **페이즈** ([06](refs/06-entity-phase.md)): Flow 다이어그램 메인 + 베이스 (이름·타입·시간·라운드·자동진행) + 모듈 (`round_clue`, `timed_clue`, `progression`, `gm_control`)
- **결말** ([07](refs/07-entity-ending-branch.md)): 두 탭 (목록 + 분기 시스템). 점수 배수 X, 1.0 고정.

### 4.5 모듈-entity 매핑 ([09](refs/09-module-mappings.md))

21 모듈 + 회색지대 3 그룹 결정 (탐색 = 글로벌, 진행 제어 = 글로벌, trade_clue = 글로벌).

### 4.6 데이터 참조 패턴 ([10](refs/10-data-references.md))

단서 = 단일 진실 위치 (단서 페이지에서만 추가). 다른 entity 는 ID 참조 + 자동 backlink.

## 5. mockup 인덱스

19개 HTML mockup 보존. `mockups/` 디렉토리.

| q | 파일 | 결정한 것 |
|---|------|---------|
| q1 | [q1-primary-concept.html](mockups/q1-primary-concept.html) | 1차 시민 컨셉 — 모듈 vs 컨셉 vs 하이브리드 |
| q2 | [q2-ecs-pattern-mockup.html](mockups/q2-ecs-pattern-mockup.html) | ECS 패턴 + 두 페이지 분리 |
| q3 | [q3-concept-taxonomy.html](mockups/q3-concept-taxonomy.html) | 컨셉 분류 (A/B/C 비교) |
| q4 | [q4-bc-hybrid-with-references.html](mockups/q4-bc-hybrid-with-references.html) | B+C 하이브리드 + 실제 도구 사례 |
| q5 | [q5-module-entity-mapping.html](mockups/q5-module-entity-mapping.html) | 모듈-entity 매핑 + 회색지대 |
| q6 | [q6-entity-crud-base-fields.html](mockups/q6-entity-crud-base-fields.html) | 캐릭터 entity 베이스 + 역할지 |
| q7 | [q7-location-entity.html](mockups/q7-location-entity.html) | 장소 entity Tree + 접근 제한 |
| q8 | [q8-all-modules-on-full-ui.html](mockups/q8-all-modules-on-full-ui.html) | 모든 모듈 ON 5 entity 풀 모습 |
| q9 | [q9-global-systems-page.html](mockups/q9-global-systems-page.html) | 글로벌 시스템 페이지 (분리 모델) |
| q10 | [q10-modules-unified-page.html](mockups/q10-modules-unified-page.html) | 모듈 통합 페이지 (탐색 시도) |
| q11 | [q11-modal-pattern.html](mockups/q11-modal-pattern.html) | 모달 vs 인라인 펼침 |
| q12 | [q12-separation-refined.html](mockups/q12-separation-refined.html) | 분리 모델 + B 옵션 (모듈 토글 위치) |
| q13 | [q13-clue-entity.html](mockups/q13-clue-entity.html) | 단서 entity + 자동 backlink |
| q14 | [q14-phase-entity.html](mockups/q14-phase-entity.html) | 페이즈 Flow 다이어그램 |
| q15 | [q15-ending-branch-system.html](mockups/q15-ending-branch-system.html) | 결말 분기 시스템 v1 (정답 기반) |
| q16 | [q16-ending-branch-v2.html](mockups/q16-ending-branch-v2.html) | v2 — 점수 배수 제거, 답 자체 매칭 |
| q17 | [q17-ending-branch-v3.html](mockups/q17-ending-branch-v3.html) | v3 — 응답 캐릭터 셀렉트, voting 자동 |
| q18 | [q18-ending-branch-v4-scoring.html](mockups/q18-ending-branch-v4-scoring.html) | v4 — 점수 가감 질문 추가 |
| q19 | [q19-ending-v5-final.html](mockups/q19-ending-v5-final.html) | v5 — 점수 숨김, 공통 결말, 응답 breakdown |

## 6. 업계 사례 참고

| 도구 | 패턴 차용 |
|------|---------|
| Articy:draft | Entity Database + Template + Feature 매핑 |
| Unity Inspector | GameObject + Component 동적 폼 |
| RPG Maker | entity-first 사이드바 트리 |
| World Anvil | 사용자 커스텀 카테고리 그룹 |
| Notion / Linear | 사이드바 그룹 헤더 (uppercase 라벨) |
| WordPress ACF | Field Group attach 패턴 |
| Stripe Dashboard | 모달 vs 사이드 패널 |
| Figma plugins | 동적 우측 패널 |

## 7. 미해결 항목 (다음 단계)

이 spec 이후 결정 필요한 큰 항목:

| ID | 영역 | 무엇을 결정해야 하나 |
|----|------|------------------|
| O-01 | 데이터 모델 | `theme.config_json` namespace 표준 — `modules.<name>` vs `module_configs.<name>` 통합 |
| O-02 | 마이그레이션 | 기존 3 패널 (`clue_placement` / `locations[].clueIds` / `character_clues`) 데이터 이전 경로 |
| O-03 | 동시편집 충돌 (E-3) | 3-way merge vs 다이얼로그 — Phase 24 범위 vs 별 phase |
| O-04 | 백엔드 ConfigSchema 신설 | 매트릭스/질문 데이터 모델 (결말 분기) |
| O-05 | 점수 시스템 모듈 | `scoring` 신설 vs 기존 `voting`/`accusation` 확장 |
| O-06 | 동적 섹션 UI 형태 | 카드 / 아코디언 / 탭 — 빽빽함 우려 시 아코디언 |
| O-07 | dead key 처리 | `locations[].clueIds` v1 → 삭제 vs evidence wire-up |
| O-08 | 다중 선택 다수결 룰 | "보기별 과반" vs "가장 많이 받은 N개" 정밀화 |

## 8. 다음 단계 워크플로우

1. 이 design.md 사용자 review
2. 미해결 8 항목 brainstorm 이어서
3. `superpowers:writing-plans` 으로 implementation plan 생성
4. PR 생성 (이 spec + plan 묶어서)
5. 구현 phase 진입

---

**참여**: brainstorm 19 turn (q1~q19), 사용자 결정 18 건 (D-01 ~ D-18).
**소스**: `.superpowers/brainstorm/64970-1777627635/` 세션 + `mockups/` 보존.
