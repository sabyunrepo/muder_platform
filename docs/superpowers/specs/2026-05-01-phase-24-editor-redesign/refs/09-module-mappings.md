# 09. 모듈-Entity 매핑

> 결정: D-16 (21 모듈 분류, 회색지대 3 그룹 결정).
> 대표 mockup: [q5](../mockups/q5-module-entity-mapping.html)

## 결정 사항 — 21 모듈 분류

### 👤 캐릭터 entity (2 모듈)

| 모듈 | 섹션 |
|------|-----|
| `starting_clue` | 캐릭터별 시작 단서 분배 (charCode → clueIDs) |
| `hidden_mission` | 캐릭터별 숨겨진 임무 (Markdown) |

### 📍 장소 entity (3 모듈)

| 모듈 | 섹션 |
|------|-----|
| `evidence` | 자동 발견 증거 (장소 진입 시) |
| `location_clue` | 검색 시 발견 단서 (능동) |
| `location` | 장소 메타데이터 (현재 schema 미구현) |

### 🔍 단서 entity (3 모듈)

| 모듈 | 섹션 |
|------|-----|
| `conditional_clue` | 조합 해제 룰 (선행 단서 AND/OR) |
| `combination` | 단서 조합 룰 (이 단서 + X = 새 단서) |
| `clue_interaction` | 사용·이전·중복 정책 (D-17: 발견자 표시 / 공개 / 전달) |

### 🎬 페이즈 entity (7 모듈, 회색지대 3 결정 포함)

| 모듈 | 섹션 |
|------|-----|
| `round_clue` | 라운드별 분배 |
| `timed_clue` | 주기 분배 |
| `script_progression` / `event_progression` / `hybrid_progression` | 진행 방식 (택1) |
| `gm_control` / `consensus_control` / `skip_consensus` | 진행 제어 |

### 🎭 결말 entity (1 모듈)

| 모듈 | 비고 |
|------|------|
| `ending` | 결말 핸들러 — entity 자체가 capability. 베이스 + 분기 매트릭스로 충분. |

### 🌐 글로벌 모듈 (10 모듈)

| 카테고리 | 모듈 |
|---------|-----|
| ⚖️ 결정 룰 | `voting`, `accusation`, `trade_clue` |
| 💬 통신 | `text_chat`, `group_chat`, `whisper`, `voice_chat`, `spatial_voice` |
| 🚶 탐색 (택1) | `room_exploration`, `floor_exploration`, `timed_exploration` |
| 🎵 미디어 | `audio` |

### 🔧 핵심 (사용자 비편집, 4 모듈)

`connection`, `room`, `ready`, `reading` — 시스템 내부, 에디터에 노출 X.

## 회색지대 3 그룹 결정

q5 mockup 에서 ◐ 마크된 3 그룹 — 사용자 결정 (디테일 회상 시 v4 v5 진행 흐름 중 묵시적 합의):

### 1. `room_exploration / floor_exploration / timed_exploration` (3 모듈)

**결정**: 글로벌 (택1).

이유: 머더미스터리 게임 1개에 1 탐색 방식. 페이즈마다 변경 = 도메인에 거의 없음. 글로벌 + 라디오 채택.

### 2. `gm_control / consensus_control / skip_consensus` (3 모듈)

**결정**: 페이즈 entity (q5 매핑 그대로).

이유: 페이즈마다 다른 진행 제어 가능 (예: 인트로 = GM 제어, 토론 = 합의). 페이즈 단위 자유.

다만 게임 단위 default 정책은 글로벌 모듈 페이지에서 설정 — 별도 confirm 필요. 단순화 위해 일단 페이즈 단위만.

### 3. `trade_clue` (1 모듈)

**결정**: 글로벌.

이유: 거래 룰 = 게임 단위 결정 (캐릭터 1명에만 적용 X). 다른 결정 룰 (voting / accusation) 옆에 자연.

## 배경·근거

### 분류 원칙

- **Entity 연결**: 모듈이 특정 entity 단위로 다른 데이터 다루는가? (예: 캐릭터마다 다른 시작 단서)
- **글로벌**: 게임 단위 1번 결정? (예: 투표 방식)
- **택1 (글로벌)**: 게임에 한 종류만 활성? (탐색 시스템)
- **핵심 (숨김)**: 시스템 내부, 사용자 변경 불가? (`connection`, `room`)

### 새 모듈 추가 시 룰

새 모듈 도입 시 위 4 분류 중 하나 선택:
1. 특정 entity 단위 → entity 연결
2. 게임 단위 1번 → 글로벌
3. 다른 모듈과 상호 배타 → 글로벌 (택1 카테고리)
4. 사용자 비편집 → 핵심

## 분배 패턴 다양성 (참고)

분석 4 결과 — 단서 분배 모듈 7 종 비교 (이미 도메인 다양성 충분히 표현):

| 트리거 | 모듈 |
|------|-----|
| 게임 시작 / phase 진입 / 읽기 후 | `starting_clue` (`distributeAt` enum) |
| 라운드 변경 시 | `round_clue` |
| clue.acquired (조합 해제) | `conditional_clue` |
| `timed_clue:tick` (주기) | `timed_clue` |
| `location.examined` (위치 방문) | `evidence` (autoDiscover) |
| `location:search` (능동 검색) | `location_clue` |
| 거래 메시지 | `trade_clue` |

→ 라운드별 / 조합별 / 즉시 / 주기 / 위치 / 거래 모두 백엔드에 이미 표현됨. **에디터가 그걸 따라가는 것**이 Phase 24 의 본질.

## 미해결 디테일

- **`gm_control` 등 페이즈 단위 vs 글로벌 default** — 게임 전체 default 를 글로벌에서 정하고 페이즈마다 override 허용? 단순화 위해 일단 페이즈 단위만.
- **Phase 24 범위에 핵심 4 모듈 보일지** — 노출 X 가 기본. 디버그 모드에서 보일지 추후.

## 참고 mockup

- [q5](../mockups/q5-module-entity-mapping.html) — 9 카드 매핑 + 회색지대 표시
