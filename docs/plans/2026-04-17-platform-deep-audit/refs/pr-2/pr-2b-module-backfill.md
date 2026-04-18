# PR-2b — 모듈 구현 백필 (13 모듈 실구현)

> Size: **L** · Risk: **Med** · Dependency: **PR-2a 머지 선행 필수**
> Finding: F-03 + F-sec-2 실구현

## 목표

PR-2a 가 깔아둔 stub `BuildStateFor` 를 13개 모듈에서 **real per-player redaction** 으로 교체. 각 모듈의 민감 필드를 식별해 caller 만 포함한 state 반환. snapshot_redaction_test 확장으로 회귀 방지.

## Scope (13 모듈)

| # | 모듈 | 파일 | 민감 필드 | 구현 난이도 |
|---|------|------|---------|:-:|
| 1 | clue_interaction | `core/clue_interaction.go` | `drawCount` `clueLevel` | 중 |
| 2 | evidence | `crime_scene/evidence.go` | `discovered` `collected` | 중 (F-03) |
| 3 | location | `crime_scene/location.go` | `positions` `history` `lastMove` | 중 (F-03) |
| 4 | combination | `crime_scene/combination.go` | `completed` `derived` `collected` | **PR-2c 분리** |
| 5 | accusation | `decision/accusation.go` | `activeAccusation.Votes` | 상 (시점 정책) |
| 6 | text_chat | `communication/text_chat.go` | DM 채널 | 중 (구조 확인) |
| 7 | group_chat | `communication/group_chat.go` | `memberships` `messages` | 중 |
| 8 | floor_exploration | `exploration/floor_exploration.go` | `floorSelection` | 하 |
| 9 | room_exploration | `exploration/room_based_exploration.go` | 방문 기록 | 하 |
| 10 | timed_exploration | `exploration/timed_exploration.go` | 개인 타이머 | 하 |
| 11 | location_clue | `exploration/location_clue.go` | 노출 단서 | 하 |
| 12 | reading | `progression/reading.go` | `progress` | 하 |
| 13 | gm_control | `progression/gm_control.go` | GM-only 판정 필요 | 상 (사전 조사) |

**combination 은 PR-2c 로 이관**, gm_control 은 "GM 플레이어만 state 수신" 정책이 이미 상위 레이어에 있는지 먼저 조사 (snapshot_send.go gm 필터). 결과에 따라 PR-2b 에 포함 또는 PublicStateMarker 로 재분류.

## 공통 구현 패턴

### Pattern A: simple per-player map filter

```go
func (m *EvidenceModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
    m.mu.RLock()
    defer m.mu.RUnlock()

    s := evidenceState{
        Evidence:     m.config.Evidence,              // 공개 OK (id/name/locationId)
        UnlockedByID: m.unlockedByID,                  // 전역 unlock 상태 공개 OK
        Discovered:   filterByPlayer(m.discovered, playerID),
        Collected:    filterByPlayer(m.collected, playerID),
    }
    return json.Marshal(s)
}

// engine/helpers 또는 module/common 에 helper 두기
func filterByPlayer[V any](m map[uuid.UUID]V, pid uuid.UUID) map[uuid.UUID]V {
    if v, ok := m[pid]; ok {
        return map[uuid.UUID]V{pid: v}
    }
    return map[uuid.UUID]V{}
}
```

### Pattern B: 조건부 공개 (accusation, voting-like)

`activeAccusation.Votes` 는 투표 종료 전에는 빈 맵, 종료 후에는 공개. `voting.go:400-` 에 이미 확립된 패턴이 있으므로 동일 구조 차용.

### Pattern C: 복합 redaction (group_chat)

`memberships[caller]` 로 caller 그룹 목록을 얻은 뒤, `messages` 를 그룹 ID 집합으로 필터. helper 필요.

## 테스트 전략

### 1. `session/snapshot_redaction_test.go` 확장

기존 3개 테스트 (TwoPlayersEachGetEnvelope · PayloadContainsSessionID · NoPlayerIDCrossLeak) 에 다음 추가:

```go
// TestSnapshot_Redaction_EvidenceDiscovered 
// Alice 만 evidence e1 을 collected. Bob 스냅샷에 e1 이 없어야.
func TestSnapshot_Redaction_EvidenceDiscovered(t *testing.T) { ... }

// TestSnapshot_Redaction_AccusationVotesHidden
// Defense 진행중인 accusation 의 Votes 가 어느 플레이어 스냅샷에도 없어야.
func TestSnapshot_Redaction_AccusationVotesHidden(t *testing.T) { ... }

// TestSnapshot_Redaction_GroupChatIsolation
// Alice 가 그룹 g1, Bob 이 그룹 g2. 서로 다른 그룹 메시지가 교차 유출되지 않아야.
func TestSnapshot_Redaction_GroupChatIsolation(t *testing.T) { ... }
```

### 2. 모듈 단위 테스트

각 모듈 `*_test.go` 에 `TestBuildStateFor_*` 시리즈 추가. 최소 3 케이스:
- caller 가 state 를 가진 경우 → 자기 필드만
- caller 가 state 없는 경우 → 빈 맵 (nil 아님)
- 타 플레이어 상태 존재 시 → caller 응답에 포함되지 않음

### 3. redaction coverage 회귀 게이트

신규 CI 스크립트 `scripts/check-playeraware-coverage.sh` 를 PR-2a 에서 먼저 넣고, PR-2b 에서 "13 모듈 모두 real 구현 (stub 패턴 `return m.BuildState()` 금지)" lint 추가. `forbidigo` 또는 `rg` 기반.

## 구현 순서 (커밋 granularity)

단일 PR 내 카테고리별 커밋 분리:

1. 커밋 1: helpers (`filterByPlayer`) 추가 + util test
2. 커밋 2: crime_scene/evidence + crime_scene/location (F-03 핵심 2)
3. 커밋 3: decision/accusation
4. 커밋 4: communication/text_chat + communication/group_chat
5. 커밋 5: exploration 4종 + progression/reading
6. 커밋 6: core/clue_interaction
7. 커밋 7: gm_control 정책 확정 결과 반영 (PlayerAware or PublicState 재분류)
8. 커밋 8: snapshot_redaction_test 확장 + coverage lint

Cherry-pick rebase 가능하도록 각 커밋은 독립 compilable.

## Size · Risk 재추정

- **Size L**: 13 모듈 × 평균 +40 LOC (BuildStateFor + 단위 테스트) ≈ **520 LOC**. 기존 원 PR-2 의 XL 중 모듈 구현 부분 거의 전부.
- **Risk Med**:
  - 각 모듈의 state shape 변경 없음 (필드 삭제 아닌 필터). 클라이언트 호환성 유지.
  - but: 25 모듈 중 11개가 이미 PlayerAware 미구현이라 실제 운영 중 fallback 으로 전 플레이어 공개되고 있었음 → PR-2b 머지 직후 **기능 변화** 체감 가능 (예: "다른 플레이어가 어떤 증거를 수집했는지" 가 안 보이게 됨). 이 기능이 게임플레이 의도인지 체크 필요.
- **Mitigation**:
  - **feature flag**: 개별 모듈마다 `BuildStateFor` 가 `m.BuildState()` 로 rollback 하는 `MMP_PLAYERAWARE_STRICT` env toggle (default true). 프로덕션 이슈 시 false 로 즉시 롤백. **채택 권장** — PR-2b 만 적용, PR-2a 는 flag 없음.
  - Advisor 확인: evidence/location 이 "전 플레이어 위치 공개" 인지 "본인만 보이는 개인 탐색" 인지 게임 디자인 결정 (03-module-architect Advisor-Ask §1 미해결).

## 검수 체크리스트

- [ ] 13 모듈 각각 `BuildStateFor` 가 `m.BuildState()` 를 호출하지 않음 (grep lint)
- [ ] `snapshot_redaction_test.go` 신규 케이스 3+ 통과
- [ ] 각 모듈 `TestBuildStateFor_*` 3 케이스 통과
- [ ] E2E 회귀 (pnpm test:e2e) — 기존 12 flow 영향 없음
- [ ] `scripts/check-playeraware-coverage.sh` green
- [ ] `module-inventory.md` PlayerAware coverage 24% → 64% (21/33)
- [ ] `MMP_PLAYERAWARE_STRICT=false` 환경에서 종전 public state 로 복귀하는 smoke test (feature flag 채택 시)

## 의존성 요약

- 상류 필수: PR-2a (gate + stub)
- 상류 권장: module-inventory.md 의 W1 drift 교정 PR (별도, phase19 backlog 참조)
- 하류: PR-2c 와 병렬 가능하지만 순차 권장 (combination.go 동일 파일 touch 시 conflict 가능)
