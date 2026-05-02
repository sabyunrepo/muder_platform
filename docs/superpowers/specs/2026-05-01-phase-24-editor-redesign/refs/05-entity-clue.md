# 05. 단서 entity

> 결정: D-08 (단일 진실 위치 + 자동 backlink), D-09 (참조 패턴), D-17 (clue_interaction 옵션).
> 대표 mockup: [q13](../mockups/q13-clue-entity.html)

## 결정 사항

### 베이스 필드 (항상)

| 필드 | 타입 | 비고 |
|------|-----|------|
| 이름 | string | 예: "일기장" |
| 단서 코드 | string | 예: "c1" — 시스템 식별자 |
| 이미지 | image upload | 단서 시각 표현 |

### 📄 발견 시 표시 컨텐츠 (Markdown)

- 별도 영역 (베이스와 분리)
- 단서를 발견한 플레이어에게 노출되는 텍스트
- 예: "표지에 검은 잉크. 마지막 페이지에 *그를 죽일 수밖에 없었다*..."

### 🧩 동적 모듈 섹션

| 모듈 | 섹션 내용 |
|------|---------|
| `conditional_clue` | "조합 해제 룰" — 선행 단서 multi-select + AND/OR + 알림 모드 |
| `combination` | "조합 룰" — 이 단서 + [다른 단서] = 새 단서 생성 |
| `clue_interaction` | "사용·이전·중복 정책" — 다음 절 D-17 참조 |

### D-17: clue_interaction 옵션 (단서별 개별 설정)

`clue_interaction` 모듈 ON 시 단서 편집 폼에 추가:

| 옵션 | 동작 |
|------|------|
| 발견자 표시 ☑ | 누가 이 단서를 발견했는지 모두에게 공개 |
| 다른 사람에게 공개 가능 ☑ | 자유 공개 허용 |
| 다른 사람에게 전달 가능 ☑ | 양도 허용 |

게임 전체 정책 (덮어쓰기 룰 / 단서 레벨 등) 은 모듈 페이지 모달에서 1번 설정.

### 🔗 자동 역참조 (Backlink)

단서 페이지 하단에 "이 단서가 사용된 곳" 자동 표시:

```
🔗 자동 역참조
📍 서재 (location_clue 검색 단서)
👤 김철수 (starting_clue 시작 단서)
🔍 c8 진실의 증거 (조합 재료)
❓ Q5 결말 분기 (단서 보기)
→ 클릭 시 해당 페이지로 이동. 자동 갱신 (수동 입력 X).
```

Notion / Articy:draft 의 backlink 패턴.

### 📋 미사용 단서 표시 (리스트 화면)

리스트에서 어디서도 안 쓰이는 단서는 "— 미사용" 표시. 만들고 잊은 dead clue 발견 도움.

### ⚠️ 삭제 경고

단서 삭제 시 "이 단서가 사용된 N 곳에서 자동 제거됨" 다이얼로그. 참조 무결성.

## 배경·근거

### 단일 진실 위치 (D-08, D-09)

이전 v3 의 단점: 단서가 3 패널에 흩어짐 — `clue_placement` (clue→location 1:1) / `locations[].clueIds` (location-centric) / `character_clues` (캐릭터별). 같은 단서를 다른 양식으로 표현 → 사용자 혼란.

해결 = **단서는 단서 페이지에서만 추가, 다른 entity 는 ID 참조만**:

| 작업 | 어디서 |
|------|------|
| 단서 c1 만들기 | 🔍 단서 페이지에서만 (베이스 + 컨텐츠 1번 작성) |
| 서재(장소)에 등록 | 📍 장소의 `evidence` 섹션에서 단서 multi-select **선택만** |
| 김철수의 시작 단서로 | 👤 캐릭터의 `starting_clue` 섹션에서 **선택만** |
| 단서 내용 수정 (이미지 교체) | 🔍 단서 페이지에서 1번 → 모든 참조처에 자동 반영 |

비유: **노션 페이지 1장 + 여러 곳에서 @언급**. WordPress / Articy:draft 표준.

### 자동 backlink

단서 = 여러 곳에서 참조됨 → "이 단서가 어디서 쓰이는지" 사용자가 알 필요. Notion / Articy 의 backlink 자동 생성. 구현: 다른 entity 가 단서 ID 참조 시 인덱싱.

### clue_interaction = 모듈 capability (D-17)

옵션:
- 베이스 (모든 단서에 항상 노출)
- ⭐ 모듈 capability (모듈 ON 시만 노출)

모듈 채택. 이유:
- 머더미스터리 게임마다 단서 인터랙션 정책 다름 (캐주얼은 공유 X, 액티브는 거래 활발)
- 모듈 OFF 시 옵션 사라져 베이스 깔끔
- 단서마다 다르게 설정 가능 (시체 = 공개 OK, 비밀 일기 = 공개 X)

기존 `clue_interaction` ConfigSchema 에 `commonClueVisibility` / `duplicatePolicy` 이미 있음 → 확장만.

## UX 디테일

### 리스트 화면 (모듈 토글 + 표)

```
🧩 단서 관련 모듈 (전체 단서에 적용)
[☑ conditional_clue] [☑ combination] [☐ clue_interaction]

🔍 단서 (12)                               [+ 새 단서]

| 코드 | 이름 | 사용된 곳 (자동) |
|------|------|---------------|
| c1   | 일기장 | 📍서재 · 👤김철수 |
| c2   | 편지 | 🎬R2(round_clue) · 🔍c1(prereq) |
| c3   | 칼   | 👤김철수 |
| c4   | 알리바이 | 🎬R3 |
| c5   | 시체 | 📍서재(evidence) |
| c7   | 담배꽁초 | — 미사용 |
| c8   | 진실의 증거 (조합) | c1+c3 결합 결과 |
```

### 편집 폼 구조

```
⚙️ c1 일기장 편집

📋 베이스: 이름·코드·이미지

📄 발견 시 표시 컨텐츠 (Markdown)
## 일기장
표지에 검은 잉크. 마지막 페이지에 ...

🟢 conditional_clue 옵션
  선행 단서: [c2 편지] AND [c5 시체]
  해제 모드: 자동
  알림: 전원 공지

🟢 combination 옵션
  이 단서 + [c3 칼] = 새 단서 [c8 진실의 증거] 생성

🟢 clue_interaction 옵션
  ☑ 발견자 표시
  ☐ 공개 가능
  ☐ 전달 가능

🔗 자동 역참조 (이 단서가 사용된 곳)
  📍 서재 (location_clue 검색 단서)
  👤 김철수 (starting_clue 시작 단서)
  🔍 c8 진실의 증거 (조합 재료)

[저장] [삭제] [복제]

⚠️ 삭제 시 경고: 3 곳에서 자동 제거됨
```

### 조합 결과 단서 (c8) 표시

- `combination` 모듈로 자동 생성된 단서도 entity 로 등록
- 리스트에서 (조합) 라벨 표시
- 발견 시 컨텐츠 + 모듈 옵션 모두 다른 단서와 동일

## 현재 코드 차용

| 영역 | 기존 |
|------|-----|
| 단서 CRUD | Phase C-5 (PR 미완료) — 본 phase 에서 완성 |
| 발견 시 컨텐츠 | v2 `theme_contents` 테이블 (`content_type='clue'` row) 차용 |
| 단서 ↔ 장소 매핑 | 기존 3 패널 (`clue_placement` / `locations[].clueIds`) 폐기, evidence/location_clue 모듈 동적 섹션으로 마이그레이션 (§미해결 O-02) |

## 미해결 디테일

- **단서 등급 / 카테고리 태그** — 베이스 추가? 머더미스터리 도메인에 자주 등장. 추후 phase.
- **단서 발견 알림 정책** — 글로벌 모듈 (`clue_interaction.notifyOnDiscover`) vs 단서별. 현재 글로벌 결정.
- **dead clue 자동 정리** — 미사용 단서 N 일 후 자동 삭제? 사용자 결정 위임.

## 참고 mockup

- [q13](../mockups/q13-clue-entity.html) — 단서 entity 풀 모습 (리스트 + 편집)
- [q8](../mockups/q8-all-modules-on-full-ui.html) — 모든 모듈 ON 시 단서 섹션 (3 동적 + backlink)
