# Exploration 모듈 (4개) — 탐색 수단

## 탐색 방식 (택 1, 상호 배타적) + LocationClue (독립)

### 21. FloorExplorationModule

```
타입: floor-exploration | conflicts: [room-exploration, timed-exploration]
PhaseReactor: ReactsTo [RESET_FLOOR_SELECTION]
```

**Config:** allowChangeFloor(false), showOccupancy(true), defaultFloor("1층")

라운드 시작 시 전원 미선택. 층 선택 → 해당 맵 단서만 수색. SpatialVoice 연계.
WS: `floor:select { mapId }` → `floor:selected / floor:occupancy`

---

### 22. RoomBasedExplorationModule

```
타입: room-exploration | conflicts: [floor-exploration, timed-exploration]
```

**Config:** maxPlayersPerRoom(3), moveCooldown(5초), showPlayerLocations(true)

방 단위 이동. max 초과 거부. Redis 쿨다운. restrictedCharacters 지원.
WS: `room:move { locationId }` → `room:player_moved / room:occupancy`

---

### 23. TimedExplorationModule

```
타입: timed-exploration | conflicts: [floor-exploration, room-exploration]
```

**Config:** explorationTime(180초), warningTime(30초), autoEndAction(lock|next_phase), freeRoam(true)

페이즈 진입 시 타이머. freeRoam: 모든 장소 자유 이동. lock: 시간 종료 수색 불가. next_phase: 자동 다음.
WS: `explore:start` → `explore:timer / explore:warning / explore:ended`

---

### 24. LocationClueModule

```
타입: location-clue | conflicts: [] (어떤 탐색이든 위에 얹을 수 있음)
```

**Config:** showClueCount(false), allowRepeatSearch(true)
(drawLimit은 ClueInteractionModule에서 단일 관리)

ThemeLocation 배치 단서 중 현재 clueLevel 맞는 것만. 에디터 "장소/단서" 탭.
WS: `location:search { locationId }` → `location:clue_found / location:empty`
