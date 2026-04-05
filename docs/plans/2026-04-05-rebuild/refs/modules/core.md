# Core 모듈 (4개) — 항상 활성, 에디터 비노출

## 1. ConnectionModule

```
타입: connection | 카테고리: CORE | 인증: NONE → SESSION
requires: [] | conflicts: []
ConfigSchema: 없음 | AutoContent: 없음 | PhaseReactor: 아님
```

**WS 이벤트:**
- `→ join_game { sessionId, characterCode, secretKey }`
- `→ reconnect_sync { sessionId }`
- `← init_state { 전체 스냅샷 }` / `← player_status_change { playerId, status }`

**로직:** 접속 → Redis online Set 추가 → 모든 모듈 핸들러 등록 → init_state. 해제 → 30초 유예 후 오프라인. 재접속 → 모든 모듈 BuildState() 집계.

---

## 2. RoomModule

```
타입: room | 카테고리: CORE | 인증: SESSION
requires: [] | conflicts: []
ConfigSchema: 없음
AutoContent:
  - notice (공지사항) / prologue (프롤로그) / opening (오프닝)
PhaseReactor: 아님
```

**WS 이벤트:**
- `→ room:select_character { characterCode }` / `→ room:deselect_character`
- `← room:player_joined/left` / `← room:character_selected/deselected`

**로직:** 입장 → 대기 화면(공지사항). 캐릭터 선택 → 중복 방지. 프롤로그/오프닝은 어떤 Progression이든 필요하므로 Core에 배치.

---

## 3. ReadyModule

```
타입: ready | 카테고리: CORE | 인증: CHARACTER
requires: [] | conflicts: []
ConfigSchema: 없음 | AutoContent: 없음 | PhaseReactor: 아님
```

**WS 이벤트:**
- `→ ready:toggle` / `← ready:status_changed { playerId, isReady }` / `← ready:all_ready`

**로직:** Redis Set으로 ready 관리. gmMode=REQUIRED → GM 시작 버튼. gmMode=NONE → 전원 준비 자동 시작.

---

## 4. ClueInteractionModule

```
타입: clue-interaction | 카테고리: CORE | 인증: CHARACTER
requires: [] | conflicts: []
PhaseReactor: ReactsTo [RESET_DRAW_COUNT, SET_CLUE_LEVEL]
```

**ConfigSchema:**
| Key | Label | Type | Default |
|-----|-------|------|---------|
| drawLimit | 라운드당 수색 횟수 | number | 5 |
| initialClueLevel | 초기 단서 레벨 | number | 1 |
| cumulativeLevel | 누적 레벨 | boolean | true |
| duplicatePolicy | 단서 중복 정책 | select | exclusive |
| commonClueVisibility | 공용 단서 공개 범위 | select | all |
| autoRevealClues | 자동 공개 단서 | boolean | false |

**duplicatePolicy:** exclusive(독점) / shared(중복 가능) / copy(복사)
**commonClueVisibility:** all(전체) / finder_only / same_location

**WS 이벤트:**
- `→ draw_clue { locationId }` / `→ transfer_clue { targetCode, clueId }`
- `← clue_found_private / clue_found_common / clue_transferred`

**로직:** drawCount 체크 → clueLevel 필터 → duplicatePolicy 적용 → 분산 락 → EventBus "clue.acquired" emit. **drawLimit = 단일 소스** (LocationClue에서 별도 관리 안 함).
