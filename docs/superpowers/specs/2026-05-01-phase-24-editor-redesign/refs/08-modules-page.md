# 08. 글로벌 모듈 페이지

> 결정: D-03 (분리 모델), D-05 (모달 패턴).
> 대표 mockup: [q11](../mockups/q11-modal-pattern.html), [q12](../mockups/q12-separation-refined.html)

## 결정 사항

### 페이지 정체성

- 사이드바 항목 "🌐 글로벌 시스템" 클릭 시 진입
- **글로벌 모듈만** 노출 (entity 연결 모듈은 entity 페이지에서 직접 토글)
- 카운트 표시: `🌐 글로벌 시스템 (6/12)` — 켜진 / 전체

### 카드 구조 (모든 카드 동일)

```
┌────────────────────────────────────┐
│ voting ◉                           │
│   투표 — 캐릭터들이 범인을 결정     │
│                  ● ON  ⚙️ 설정      │
└────────────────────────────────────┘
   ↑ 카드 자체 클릭 = 모달 열림
```

- ON/OFF 토글
- "⚙️ 설정" 버튼 (모달 트리거)
- 카드 자체 클릭 = 모달
- 카테고리 헤더로 그룹핑

### 카테고리 (4 그룹)

```
🌐 글로벌 시스템

⚖️ 결정 룰 (3 모듈)
  ◉ voting           ● ON  ⚙️
  ◉ accusation       ● ON  ⚙️
  ◉ trade_clue       ○ OFF

💬 통신 (5 모듈)
  ◉ text_chat        ● ON  ⚙️
  ◉ group_chat       ● ON  ⚙️
  ◉ whisper          ● ON  ⚙️
  ◉ voice_chat       ○ OFF
  ◉ spatial_voice    ○ OFF

🚶 탐색 (3 모듈, 택1)
  ⊙ room_exploration  ● ON  ⚙️    ← 라디오
  ⊙ floor_exploration ○ OFF
  ⊙ timed_exploration ○ OFF

🎵 미디어 (1 모듈)
  ◉ audio            ○ OFF
```

탐색 카테고리만 라디오 (택1). 나머지는 자유 조합.

### 모달 패턴 (모든 카드 동일)

카드 클릭 → 모달:
```
┌─────────────────────────────────┐
│ ⚙️ voting (투표) 설정            │
│ ⚖️ 결정 룰 · 글로벌 모듈    [✕]  │
├─────────────────────────────────┤
│ 투표 방식: [비공개 ▼]            │
│ 최소 참여율: [50%]               │
│ 무승부 시: [재투표 ▼]            │
│ ☐ 실시간 결과 표시               │
│ ☐ 투표자 공개                    │
│ ☐ 기권 허용                      │
│ ☐ 죽은 사람 투표                 │
│ 최대 투표 라운드: [3]            │
├─────────────────────────────────┤
│              [취소]  [저장]      │
└─────────────────────────────────┘
```

## 배경·근거

### 분리 모델 (D-03)

이전 통합 시도 (q10) — 모든 모듈을 한 페이지에. 발견 문제: entity 연결 모듈 (`starting_clue` 등) 카드 클릭 = 페이지 이동, 글로벌 모듈 카드 클릭 = 모달. **같은 페이지에 두 동작 = 일관성 위반**.

해결 = 분리:
- 글로벌 모듈만 모듈 페이지 (모두 모달, 일관)
- entity 연결 모듈은 entity 리스트 화면 토글 (영향 범위 일치)

### 모달 채택 이유 (D-05)

옵션:
- ⭐ 모달 (팝업)
- 인라인 펼침 (q10 식 — 카드 옆에 설정 폼 펼쳐짐)
- 사이드 패널 (Stripe / Linear 식 슬라이드)

모달 채택. 이유:
- 모듈 페이지 깔끔 (ON/OFF 토글만 한눈에)
- 글로벌 6-8 모듈 동시 펼치면 정신없음 회피
- 한 번에 한 모듈 집중 (머더미스터리 디자이너 작업 패턴)

업계 사례: VS Code 확장 마켓, Stripe Dashboard, Notion 속성 설정.

### 글로벌 모듈 12 종

분석 4 (단서 분배 비교) 결과 + q5 모듈-entity 매핑:
- **결정 룰**: voting, accusation, trade_clue (3)
- **통신**: text_chat, group_chat, whisper, voice_chat, spatial_voice (5)
- **탐색**: room_exploration, floor_exploration, timed_exploration (3, 택1)
- **미디어**: audio (1)

= 12 모듈.

(entity 연결은 13 + 핵심 비편집 4 + voting/etc 3 = 32 - 13 - 4 = 15. 다소 차이는 모듈 분류 회색지대 결과)

## UX 디테일

### 카드 종류 마크 (참고)

이 페이지에는 ◉ 글로벌 마크만 있음. ◧ entity 연결 마크는 entity 리스트 화면에서 토글로 보임 (분리 모델).

### "택1 카테고리" 표시

탐색 시스템 (`room_exploration` / `floor_exploration` / `timed_exploration`) 처럼 택1 카테고리는:
- 카테고리 헤더에 `(택1)` 라벨
- 카드에 라디오 버튼 (체크박스 X)
- 다른 모듈 ON 상태에서 새 모듈 켜면 기존 자동 OFF + confirm 다이얼로그

### 모달 닫기

- ✕ 버튼
- ESC 키
- 백드롭 클릭
- 저장 / 취소 버튼

저장 안 하고 닫으면 변경 사항 폐기 — confirm 다이얼로그 (변경 있을 때만).

## 현재 코드 차용

| 영역 | 기존 |
|------|-----|
| 글로벌 모듈 ConfigSchema | 21 모듈 중 글로벌 12 — 백엔드 `engine.RegisteredModules()` 차용 |
| 모달 컴포넌트 | 기존 v3 모달 (있다면) — 또는 `@radix-ui/react-dialog` 신설 |
| 모듈 토글 mutation | 기존 `useUpdateConfigJson` 훅 차용 (Phase 21 #184 통합) |

## 미해결 디테일

- **모듈 ON/OFF 시 entity 데이터 처리** — 모듈 끄면 그 entity 동적 섹션 데이터 삭제 vs 보존 vs 아카이브. (§O-01 / O-07)
- **글로벌 모듈 vs entity 연결 모듈 분류 표준** — q5 회색지대 3 그룹 결정 후에도 향후 새 모듈 추가 시 어디 분류할지 룰 필요.

## 참고 mockup

- [q9](../mockups/q9-global-systems-page.html) — 첫 시도 (인라인 펼침)
- [q10](../mockups/q10-modules-unified-page.html) — 통합 시도 (일관성 문제 발견)
- [q11](../mockups/q11-modal-pattern.html) — 모달 vs 인라인 비교
- [q12](../mockups/q12-separation-refined.html) — **최종** 분리 모델 + 모달 패턴
