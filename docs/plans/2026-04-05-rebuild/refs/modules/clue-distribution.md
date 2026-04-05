# Clue Distribution 모듈 (5개) — 단서 배포 방식

## 25. ConditionalClueModule

```
타입: conditional-clue | 카테고리: CLUE_DISTRIBUTION
```

**Config:** announceToAll(false), announceToFinder(true)

전제조건 충족 시 자동 해금. EventBus "clue.acquired" 구독 → 조건 체크 → 배포. 연쇄 가능.
에디터 "단서 관계" 탭: `dependencies: [{ clueId, prerequisiteClueIds, mode: ALL|ANY }]`

---

## 26. StartingClueModule

```
타입: starting-clue
```

**Config:** distributeAt(game_start|first_phase|after_reading), notifyPlayer(true)

게임 시작 시 캐릭터별 초기 단서 자동 배포. 롤지와 함께 표시.
에디터: `startingClues: [{ characterCode, clueIds }]`

---

## 27. RoundClueModule

```
타입: round-clue
```

**Config:** distributeMode(specific|random|all), announcePublic(true)

라운드 전환 시 자동 배포. EventBus "phase.changed" 구독, round 변경 감지.
에디터 "라운드 단서" 탭: `distributions: [{ round, clueId, targetCode, mode }]`

---

## 28. TimedClueModule

```
타입: timed-clue
```

**Config:** interval(120초), maxAutoClues(5), targetMode(all|random_player|least_clues)

interval마다 asynq 타이머로 자동 배포. least_clues: 밸런싱. maxAutoClues 도달 시 중지.

---

## 29. TradeClueModule

```
타입: trade-clue | PhaseReactor: ReactsTo [ALLOW_EXCHANGE]
```

**ConfigSchema:**
| Key | Label | Type | Default | DependsOn |
|-----|-------|------|---------|-----------|
| allowTrade | 교환 (소유권 이전) | boolean | true | |
| allowShow | 보여주기 (소유권 유지) | boolean | true | |
| showDuration | 보여주기 시간 (초) | number | 30 | allowShow=true |
| showMaxViewers | 동시 열람 인원 | number | 1 | allowShow=true |
| requireMutualTrade | 상호 교환만 | boolean | false | |
| tradeProposalTimeout | 제안 만료 (초) | number | 60 | |

**WS 이벤트:**
- 교환: `clue:trade_propose/accept/decline` → `clue:trade_proposed/accepted/declined/expired`
- 보여주기: `clue:show_request/accept/decline` → `clue:show_started { duration } / show_ended`
