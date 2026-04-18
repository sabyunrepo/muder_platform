# PR-C — session 통합 테스트 + 3+ players table + helper export

> Size: **M** · Risk: **Med** · Dependency: 없음

## 목표

PR-2c 리뷰 LOW 급 피드백 중 가장 load-bearing 인 "통합 테스트 부재" 를 해소. 현재 PR-2c 는 `combination_test.go` 단위 테스트(+PR-2c hotfix 의 concurrent/deadlock 테스트) 로만 검증됐고, session broadcast fan-out 까지 end-to-end 로 잡아내는 회귀 테스트가 없다.

동시에 12 PlayerAware 모듈 (PR-2b+PR-2c) 에 걸쳐 반복되는 per-player redaction 검증 보일러플레이트를 공통 helper 로 추출해 향후 테스트 비용을 낮춘다.

## Scope

| 파일 | 변경 |
|------|------|
| `apps/server/internal/engine/testutil/redaction.go` | **신규 helper 패키지**. `PeerLeakAssert(t *testing.T, raw []byte, caller uuid.UUID, peers ...uuid.UUID)` — raw JSON 에 peers 의 uuid 문자열이 등장하면 t.Errorf. 부가: `AssertEmptyShape(t, raw)` for 3 map `{}` pattern. |
| `apps/server/internal/session/snapshot_redaction_test.go` | `TestSnapshot_Redaction_CombinationCrafted` 신규 — 3 player 세션에서 alice 가 knife+glove combine → weapon_set 파생. Bob/Charlie 의 session:state 브로드캐스트 payload 에 `weapon_set` 이 등장하지 않음을 `PeerLeakAssert` 로 검증. |
| `apps/server/internal/module/crime_scene/combination/combination_test.go` | 기존 3 BuildStateFor 테스트(OnlyCallerVisible · EmptyForNewPlayer · CollectedMirror) + hotfix 3 테스트(NilUUIDEmpty · CollectedSortedStable · ConcurrentBroadcast) 를 table-driven 으로 재편. `PeerLeakAssert` 재사용. 3+ player matrix (alice/bob/charlie) 추가. RestoreState → BuildStateFor 경로 추가. |

## 구현 메모

### PeerLeakAssert helper

```go
// Package testutil provides shared helpers for engine module redaction tests.
package testutil

import (
    "strings"
    "testing"

    "github.com/google/uuid"
)

// PeerLeakAssert verifies that a per-player snapshot payload contains no
// reference to any peer's UUID. Used to pin redaction contracts across
// PlayerAware modules.
func PeerLeakAssert(t *testing.T, raw []byte, caller uuid.UUID, peers ...uuid.UUID) {
    t.Helper()
    s := string(raw)
    if !strings.Contains(s, caller.String()) && len(peers) > 0 {
        // Caller may legitimately have no state — only flag if peers are present.
    }
    for _, p := range peers {
        if strings.Contains(s, p.String()) {
            t.Errorf("peer uuid %s leaked into caller snapshot:\n  %s", p, s)
        }
    }
}
```

### 통합 테스트 구조

```go
func TestSnapshot_Redaction_CombinationCrafted(t *testing.T) {
    m, _, sender, sessionID := startRedactionSession(t)
    // 3 player setup: alice, bob, charlie.
    alice, bob, charlie := uuid.New(), uuid.New(), uuid.New()
    // Trigger alice combine via session.HandleMessage → combination module.
    // Then m.OnPlayerRejoined(..., bob) & charlie → expect session:state envelopes.
    // Awaiting envelopes, assert no occurrence of alice's derived "weapon_set"
    // in bob/charlie payloads.
    ...
}
```

Note: session 레이어의 fakeEngine (`session/snapshot_test.go` 의 `fakeCache`/`fakeSender`) 에 실제 CombinationModule 을 주입하려면 `session.InjectSnapshot` 또는 session.NewSessionManager 의 모듈 설치 경로를 써야 함. 복잡도 증가 시 session-level API 가 부족하면 helper 신설로 확장.

### combination_test.go table-driven

```go
tests := []struct {
    name    string
    setup   func(*CombinationModule, uuid.UUID, []uuid.UUID)
    caller  uuid.UUID
    peers   []uuid.UUID
    assert  func(*testing.T, []byte) // extra asserts beyond PeerLeakAssert
}{
    {"OnlyCallerVisible", ..., assertCompleted(&{...})},
    {"EmptyForNewPlayer", ..., assertEmptyShape},
    {"CollectedMirror_EventBus", ..., assertCollectedHas("knife")},
    {"ThreePlayers_AliceIsolated", ..., ...},
    {"RestoreState_PreservesIsolation", ..., ...},
}
```

## 테스트 검증 체크리스트

- [ ] `engine/testutil/redaction.go` 독립 패키지 컴파일 OK (`go build ./internal/engine/testutil`)
- [ ] `testutil/redaction_test.go` 자체 테스트 — PeerLeakAssert 가 peer uuid 존재 시 실패, 부재 시 통과
- [ ] `TestSnapshot_Redaction_CombinationCrafted` 통합 테스트 3 player 시나리오 pass
- [ ] `combination_test.go` table-driven 리팩터 후 기존 7 테스트 케이스(+신규 3+ player, RestoreState→BuildStateFor) 전부 pass
- [ ] `go test -race -count=1 ./internal/engine/... ./internal/module/... ./internal/session/...` green
- [ ] coverage (`go test -coverprofile`) combination 패키지 커버리지 변화 ≤1% 증가 (리팩터로 라인 줄고 테스트 늘어남)

## 리스크

- session-level 통합 테스트가 fakeEngine 확장을 요구할 가능성. 현재 `snapshot_test.go::fakeEngine` 은 CombinationModule 을 직접 install 하는 API 가 없을 수 있음. 필요 시 session.NewSessionManager 의 모듈 교체 helper 추가 (minor 범위, session 패키지 pub API 변경 수반).
- `PeerLeakAssert` 의 substring 검색은 uuid 를 payload 의 다른 필드(예: 다른 모듈 상태) 에 우연히 포함된 경우 false positive 위험. 대안: JSON 파싱 후 특정 field (`combination.derived`, `combination.collected`) 만 검사. 1 차 구현은 substring, 필요 시 JSON-path 확장.
- testutil 패키지 import path 가 다른 모듈 테스트에서 참조될 때 순환 import 우려 (`engine` 이 `testutil` 을 depend). testutil 은 `engine` import 없이 독립적으로 작성.
