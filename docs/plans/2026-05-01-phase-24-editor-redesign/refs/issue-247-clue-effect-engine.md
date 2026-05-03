# Issue #247 — 단서 효과 Engine 계약 및 런타임 실행

## 상태

- GitHub Issue: [#247](https://github.com/sabyunrepo/muder_platform/issues/247)
- Branch: `feat/issue-247-clue-effect-engine`
- 목표: 제작자 UI의 단서 사용 설정이 프론트 표시값에 머물지 않고, 백엔드 런타임 Engine에서 실제로 실행되도록 최소 계약을 만든다.

## Uzu 참고점

Uzu 단서 문서는 단서를 단순 텍스트가 아니라 “소유권이 있는 플레이 중 자산”으로 다룬다.

- 단서 기본 정보는 플레이 중 단서 목록/상세에 표시된다.
- 비공개 단서는 소유자 외 사용자에게 제목/태그만 보이고 상세는 숨길 수 있다.
- 배포 조건은 “어떤 조건으로, 어떤 방식으로, 누구에게 줄지”를 나눈다.
- 소유권이 있는 단서는 전체 공개, 공유, 양도가 가능하다.
- 회수 조건으로 이미 배포된 단서를 다시 장에서 제거할 수 있다.
- 조건 그룹은 AND/OR를 지원하지만 깊어질수록 제작자 UI가 복잡해진다.

## MMP 적용 방식

Uzu를 그대로 복제하지 않고, MMP는 실시간 멀티플레이와 player-aware state를 우선한다.

1. 프론트 Adapter는 제작자에게 쉬운 문구와 선택 UI를 제공한다.
2. 백엔드 Engine은 단서 사용 효과의 실제 실행과 권한 검증을 담당한다.
3. 플레이어별 공개 정보는 `BuildStateFor`에서 분리한다.
4. 같은 단서를 재사용하거나 재접속 상태가 반복되어도 중복 지급/중복 공개가 생기지 않도록 idempotency를 둔다.
5. 내부 raw JSON, module key, 숨겨진 reveal text는 플레이어 state에 노출하지 않는다.

## 이번 PR의 구현 범위

### Engine 계약

`clue_interaction` 모듈 config에 `itemEffects`를 추가한다.

```json
{
  "itemEffects": {
    "<clueId>": {
      "effect": "reveal",
      "target": "self",
      "consume": true,
      "revealText": "사용자에게만 공개할 정보"
    }
  }
}
```

지원 효과는 MVP 기준으로 제한한다.

| effect | 의미 | 이번 PR 동작 |
| --- | --- | --- |
| `peek` | 다른 플레이어 단서 보기 | 기존 대상 선택 흐름 유지 |
| `reveal` | 사용한 플레이어에게 정보 공개 | `revealedInfo`에 저장하고 본인에게만 state 공개 |
| `grant_clue` | 사용 성공 시 새 단서 지급 | 보유 단서에 추가하고 `clue.acquired` 이벤트 발행 |

### 보안/정합성

- configured effect는 단서 소유자만 사용할 수 있다.
- `grant_clue`는 지급 대상이 없으면 config init 단계에서 실패한다.
- `reveal`은 공개할 텍스트가 없으면 config init 단계에서 실패한다.
- `consume=true`이면 사용 단서를 보유 목록에서 제거한다.
- 이미 사용한 configured effect는 다시 적용하지 않는다.
- 플레이어 state에는 본인의 `revealedInfo`만 포함하고, 전체 `itemEffects` config는 제거한다.

## 제외 / 후순위

이번 PR에서 구현하지 않는다.

- `steal`, `block`, `swap`의 실제 플레이어 간 상호작용: ownership ledger, 대상 승인, 악용 방지 규칙이 필요하다.
- Uzu식 회수 조건 전체: 배포/회수 ledger가 안정화된 뒤 별도 PR에서 다룬다.
- 복합 조건 UI 전체: Phase/condition 엔진과 결합해야 하므로 후속 이슈로 둔다.
- 프론트 제작자 UI 전면 개편: 이번 PR은 Engine 계약과 테스트가 우선이며, UI는 Adapter가 이 계약을 바라보도록 후속 연결한다.

## 테스트 계획

- Go unit/integration
  - configured `reveal` 실행 시 본인에게만 공개되고 `consume=true`이면 보유 단서에서 제거된다.
  - configured `grant_clue` 실행 시 새 단서가 지급되고 재사용해도 중복 지급되지 않는다.
  - configured effect는 소유하지 않은 플레이어가 사용할 수 없다.
  - 잘못된 effect config는 Init 단계에서 실패한다.
  - 기존 `peek` 대상 선택 흐름은 유지된다.
- E2E 대체 사유
  - 이번 slice는 React 화면/라우트를 바꾸지 않고 백엔드 runtime module 계약을 추가한다.
  - 사용자 관점 흐름은 WS 세션 런타임 연결 후 Playwright로 확장한다.

## 완료 조건

- `clue_interaction` runtime module이 `reveal`/`grant_clue`를 실제 state/event로 실행한다.
- player-aware redaction으로 다른 플레이어에게 공개 텍스트와 effect config가 새지 않는다.
- 기존 `peek` 흐름과 phase action이 깨지지 않는다.
- focused Go test가 통과한다.
