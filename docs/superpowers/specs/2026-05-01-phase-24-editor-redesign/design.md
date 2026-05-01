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

```text
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

```text
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

```text
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
| ~~O-01~~ ✅ **D-19** | 데이터 모델 | **단일 맵** `modules: {[id]: {enabled, config?}}` (B 옵션). 프론트 `module_configs` 분리 키 폐기, 프리셋 32개 마이그, 백엔드 loader 통합. ECS entity-attached 모듈 (예: `location.evidenceConfig`)과 동일 mental model — Phase 24 한 PR로 마이그. (2026-05-01 결정) |
| ~~O-02~~ ✅ **D-20** | 마이그레이션 | **Lazy on read — 백엔드 normalizer**. read 시 옛 shape→새 shape 변환, write는 항상 새 shape, 옛 키는 자연 sweep 후 +1 PR로 drop. Notion 블록 / Articy 프로젝트 컨버터 패턴. (2026-05-01 결정, 출처: System Design with Sage / PingCAP) |
| ~~O-03~~ ✅ **D-22** | 동시편집 충돌 (E-3) | **Phase 24 OUT** — Phase 25+ 별 phase로 deferred. 현재 백엔드 optimistic lock + 프론트 409 토스트 유지. 우리 도메인 단일 작가 위주(Linear "conflicts are rare" 동등) + Phase 24 scope 보호 + YAGNI. ship 후 빈도 측정 → 필요시 자동 rebase(B) 또는 다이얼로그(A) 채택. (2026-05-01 결정) |
| ~~O-04~~ ✅ **D-23** | 백엔드 ConfigSchema 신설 | **신규 모듈 `ending_branch`** — 기존 `engine.Module + ConfigSchema + GetRules()` 패턴 확장. `module_configs.ending_branch` 안에 questions/matrix/scores. 매트릭스 우선순위 평가 = 기존 JSONLogic 엔진(`rule_evaluator.go`) 재사용, 신규 평가기 0. 프론트는 `Schema()` 로 폼 자동 생성. (2026-05-01 결정) |
| ~~O-05~~ ✅ **D-24** | 점수 시스템 모듈 | **`ending_branch` 안에 embed** (D-23 자연 확장) — questions 배열의 `impact: score` 케이스로 점수 가감, 누적, breakdown 모두 한 모듈. SRP는 D-23 모듈이 "결말 결정"이라는 단일 책임이라 위반 X. *미래 다른 phase 점수 가감 필요 시* `internal/scoring` shared 도메인으로 추출 가능하도록 함수 boundary 명확 (글로벌 카논 "추후 계획 = 추상화 1순위"). (2026-05-01 결정) |
| ~~O-06~~ ✅ **D-25** | 동적 섹션 UI 형태 | **아코디언 (Notion property + Figma Inspector + Unity foldout 합본)**. 디테일 3: ① 베이스+역할지 = 항상 펼침 고정, ② 활성 모듈 = 기본 펼침 / 비활성 = 접힘 + "설정 시작 →" placeholder, ③ 펼침 상태 localStorage per-user 저장 (Unity last-state 패턴). 카드는 스크롤 피로, 탭은 Baymard 저장 모호 + 동시 비교 불가. (2026-05-01 결정) |
| ~~O-07~~ ✅ **D-21** | dead key 처리 | **Union 병합** — `clue_placement` 우선(런타임 권위), dead key는 보충(단독 데이터 보존), 충돌 케이스 백엔드 DEBUG 로그. Django stub field + Odin `FormerlySerializedAs` 패턴. (2026-05-01 결정) |
| ~~O-08~~ ✅ **D-26** | 다중 선택 다수결 룰 (분기 질문 한정) | **Per-choice threshold (각 보기 50%+) → sorted set 종합** → 매트릭스 cell 매칭. Threshold 기본 50%, 에디터 조정 가능. cell 표기 = `"지갑+반지"` "+" 결합, backend sorted normalize. **점수 가감 질문은 룰 적용 X** — 응답자 각자 보기별 점수 합산해 개인 누적 (D-14 별 차원), 게임 끝 breakdown에 캐릭터별 표시. Doodle 시간 투표 / Approval voting 패턴. (2026-05-01 결정) |

## 8. 다음 단계 워크플로우

1. 이 design.md 사용자 review (round-2 결과 포함)
2. `superpowers:writing-plans` 으로 implementation plan 생성 (PR 분할 전략 + 마이그 normalizer + ending_branch 모듈 + 아코디언 UI 컴포넌트 + 결정 D-19~D-26 모두 반영)
3. PR 생성 (이 spec + plan 묶어서)
4. 구현 phase 진입

## 9. 결정 D-23/D-24 데이터 모델 합본 (명확화)

D-23(ending_branch 모듈) + D-24(점수 embed) 결합 결과 = 단일 데이터 shape. **점수는 별도 필드가 아니라 questions 배열의 score-impact 케이스 안에 인라인**:

```json
module_configs.ending_branch = {
  questions: [
    { id: "q1", impact: "branch", type: "single",
      choices: ["예","아니오"], respondents: ["김철수","박민수"] },
    { id: "q3", impact: "score",  type: "single",
      choices: ["협박","치정","금전","모르겠다"], respondents: "all",
      scoreMap: { "협박": 5, "치정": -2, "금전": -2, "모르겠다": 0 } }
  ],
  matrix: [
    { priority: 1,
      conditions: { voting: "이영희 검거", q1: "*", q5: "읽었다" },
      ending: "TRUTH" },
    ...
  ],
  defaultEnding: "미해결",
  multiVoteThreshold: 0.5  // D-26: 분기 다중 선택 per-choice threshold
}
```

분기 질문 응답 종합 = D-26 룰. 점수 질문 응답 처리 = 응답자별 누적 (개인 차원, 매트릭스 매칭 X).

---

**참여**: brainstorm round-1 19 turn (q1~q19, 결정 D-01~D-18) + round-2 8 결정 (D-19~D-26, 모두 production 사례 검색 + 출처 명시).
**소스**: `.superpowers/brainstorm/64970-1777627635/` (round-1) + `.superpowers/brainstorm/83684-1777635117/` (round-2) + `mockups/` 보존.
