# Issue #523 - 단서 Kill Effect Runtime 계약

## 상태

- GitHub Issue: [#523](https://github.com/sabyunrepo/muder_platform/issues/523)
- 관련 작업: [#509](https://github.com/sabyunrepo/muder_platform/issues/509), [#520](https://github.com/sabyunrepo/muder_platform/issues/520)
- 결정: `kill`은 `clue_interaction`이 직접 상태를 바꾸는 효과가 아니다. 단서 아이템 사용이 player-status runtime action을 요청하는 계약으로 둔다.

## 현재 Runtime 사실

- `clue_interaction`은 단서 획득, 단서 전달, 아이템 사용 중복 방지, `reveal`/`grant_clue`처럼 단서 안에서 끝나는 효과를 소유한다.
- `ClueItemEffectConfig`는 현재 `peek`, `reveal`, `grant_clue`만 허용하고, 알 수 없는 효과는 module init 단계에서 실패한다.
- 플레이어 생존/사망 상태는 이미 session player state와 persistence(`session_players.is_alive`)에 있다.
- `PlayerRuntimeInfo.IsAlive`는 session player-info provider를 통해 engine에 노출되고, 조건 평가는 `character_alive`를 `characters.<id>.alive`로 매핑한다.
- 투표와 고발 UI는 player `isAlive`로 후보를 필터링한다. 투표 runtime도 `OPEN_VOTING` 시점의 `alivePlayers`를 갖고 있으므로 라운드 중 사망 정책은 별도로 정해야 한다.

## 책임 결정

`clue_interaction`은 단서 사용을 검증하고 kill request를 발행할 수 있지만, `is_alive`를 직접 쓰면 안 된다.

실제 사망 상태의 runtime owner는 session/runtime layer의 전용 player-status boundary가 되어야 한다. 이 boundary가 생기기 전까지 직접 `kill` 실행은 후속으로 미룬다.

이유:

1. 사망은 단서 상태만 바꾸지 않는다. 투표 자격, 고발 대상, phase 조건, 캐릭터 표시, 향후 GM 중재까지 영향을 준다.
2. session actor가 이미 runtime state를 안전하게 직렬 변경하는 단일 경로다.
3. `clue_interaction`은 재사용 가능한 모듈이다. 여기서 player lifecycle을 직접 쓰면 단서 효과가 게임 전체 정책과 강하게 결합된다.

## 최소 계약

### Editor Config Shape

최종 config는 상태를 조용히 바꾸는 값이 아니라, 제거 요청임을 명확히 표현해야 한다.

```json
{
  "effect": "kill",
  "target": "player",
  "consume": true,
  "requiresApproval": true,
  "reason": "poisoned_clue"
}
```

계약 규칙:

- `target`은 `player`여야 한다.
- `requiresApproval`은 제작자 안전을 위해 기본값을 `true`로 둔다.
- `consume=true`는 허용하되, 단서 소모는 kill request가 승인된 뒤에만 적용한다.
- 에디터는 이를 일반 정보 공개가 아니라 위험한 runtime action으로 표시해야 한다.

### Runtime Event

설정된 단서를 사용하고 대상이 선택되면 `clue_interaction`은 아래 이벤트를 발행한다.

```json
{
  "type": "clue.kill_requested",
  "payload": {
    "requestId": "<uuid>",
    "source": "clue_effect",
    "actorPlayerId": "<uuid>",
    "targetPlayerId": "<uuid>",
    "clueId": "<uuid>",
    "requiresApproval": true,
    "reason": "poisoned_clue"
  }
}
```

이 이벤트는 요청일 뿐, 권위 있는 사망 결과가 아니다.

### Runtime Command

후속 player-status owner는 승인된 요청을 받아 권위 있는 결과를 발행한다.

```json
{
  "type": "player.status_changed",
  "payload": {
    "playerId": "<uuid>",
    "characterId": "<id>",
    "isAlive": false,
    "reason": "clue_effect",
    "sourceClueId": "<uuid>",
    "actorPlayerId": "<uuid>"
  }
}
```

클라이언트와 조건 평가기는 이 결과 이후에만 캐릭터를 사망 상태로 판단한다.

## 정책 경계

- 자기 자신 대상 허용 여부, 이미 죽은 대상 처리, host 면역, GM 승인은 clue policy가 아니라 player-status policy다.
- 투표가 이미 열려 있다면 voting module은 자격을 `OPEN_VOTING` 시점으로 고정할지, `player.status_changed`로 갱신할지 명시해야 한다.
- 효과가 거절되거나 만료되면 단서 소모를 적용하지 않는다.
- `character_alive` 조건은 계속 shared player-runtime context를 읽어야 하며, clue module state를 읽으면 안 된다.

## 구현 후속

이 이슈는 계약을 확정한다. 실제 구현은 shared runtime behavior를 바꾸고 backend, frontend, test coverage를 한 번에 맞춰야 하므로 별도 이슈에서 추적한다.

후속 범위:

- typed clue effect config와 validation에 `kill`을 추가한다.
- `clue_interaction`은 alive state를 쓰지 않고 `clue.kill_requested`만 발행한다.
- session actor를 통해 alive-state 변경을 직렬화하는 session/player-status runtime owner를 추가한다.
- 에디터 UI에 보호 장치가 있는 "살해 요청" effect mode를 추가한다.
- validation, event payload, 승인/사망 결과, voting eligibility policy, frontend config read/write를 focused test로 검증한다.
