# PR-2c — craftedAsClueMap redaction (D-MO-1)

> Size: **S-M** · Risk: **Low** · Dependency: **PR-2a 머지 선행 필수**, PR-2b 와 동일 파일 touch 주의
> Finding: D-MO-1 단독 해소 (Phase 18.1 B-2 반쪽 상태 해소)

## 목표

`CombinationModule` 의 `completed / derived / collected` 세 map 이 현재 `BuildState` 에서 **전 플레이어 결합 결과** 를 그대로 직렬화한다(`combination.go:325-355`). 이 때문에 "다른 플레이어가 이미 어떤 단서를 조합했는지" 가 스냅샷으로 유출된다. `craftedAsClueMap(playerID)` helper 는 이미 존재 (line 185-194) 하지만 내부 `checkNewCombos` 에서만 사용, 외부 스냅샷에는 반영되지 않는다.

PR-2c 는 **`BuildStateFor(playerID)` 를 real 구현** 으로 교체해 caller 의 combined 결과만 노출한다. PR-2b 가 combination 모듈에 stub 을 두고 지나가는 것을 PR-2c 가 real 로 승격한다.

## Scope

| 파일 | 변경 |
|------|------|
| `apps/server/internal/module/crime_scene/combination.go` | `BuildStateFor` real 구현 + `snapshotFor(playerID)` helper 추가 |
| `apps/server/internal/module/crime_scene/combination_test.go` | `TestCombination_BuildStateFor_*` 3 케이스 추가 |
| `apps/server/internal/session/snapshot_redaction_test.go` | `TestSnapshot_Redaction_CombinationCrafted` 1 케이스 추가 |

## 변경 내용

### 1. combination.go — snapshot 함수 per-player 변형

```go
// snapshotFor returns the combination state from the given player's view.
// Other players' completed/derived/collected are elided — preserves
// Phase 18.1 B-2 per-player snapshot redaction boundary (D-MO-1).
func (m *CombinationModule) snapshotFor(playerID uuid.UUID) combinationState {
    s := combinationState{
        Completed: map[string][]string{},
        Derived:   map[string][]string{},
        Collected: map[string][]string{},
    }
    if ids := m.completed[playerID]; len(ids) > 0 {
        cp := make([]string, len(ids))
        copy(cp, ids)
        s.Completed[playerID.String()] = cp
    }
    if ids := m.derived[playerID]; len(ids) > 0 {
        cp := make([]string, len(ids))
        copy(cp, ids)
        s.Derived[playerID.String()] = cp
    }
    if evMap := m.collected[playerID]; len(evMap) > 0 {
        ids := make([]string, 0, len(evMap))
        for id := range evMap {
            ids = append(ids, id)
        }
        s.Collected[playerID.String()] = ids
    }
    return s
}

// BuildStateFor implements engine.PlayerAwareModule — per D-MO-1
// only the caller's crafted/discovered clue sets are disclosed.
func (m *CombinationModule) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) {
    m.mu.RLock()
    s := m.snapshotFor(playerID)
    m.mu.RUnlock()
    return json.Marshal(s)
}
```

### 2. BuildState() 정책 결정

`BuildState` (공개) 는 3가지 선택지:
- (A) **현재 유지** — 관리 콘솔·E2E fixture 용 디버그 경로. 런타임에선 `BuildStateFor` 가 우선 호출되어 공개로 빠지지 않음.
- (B) **빈 snapshot 리턴** — 실수로라도 `BuildState()` 가 브로드캐스트 경로에 끼면 유출이므로 안전판.
- (C) **삭제** — 인터페이스에서 Module.BuildState() 는 필수라 삭제 불가, (B) 와 동일 효과.

**권장: (A)** 유지. 이유: PR-2a 의 registry 게이트가 public fallback 을 원천 차단(모든 모듈이 PlayerAware OR PublicState). 즉 engine.BuildModuleStateFor 가 PlayerAware 구현을 반드시 호출한다. `BuildState()` 는 serializable/snapshot 내부 저장용·테스트용으로 남는다. 다만 docstring 에 "internal/test only — do NOT feed to clients directly" 주석 강제.

### 3. 테스트

#### combination_test.go 신규 케이스

```go
func TestCombination_BuildStateFor_OnlyCallerVisible(t *testing.T) {
    m := NewCombinationModule()
    // setup config with 1 combo
    ...
    alice := uuid.New()
    bob := uuid.New()
    // alice combines (e1+e2 → derived=d1), bob combines (e3+e4 → derived=d2)
    m.completed[alice] = []string{"c1"}
    m.derived[alice]   = []string{"d1"}
    m.completed[bob]   = []string{"c2"}
    m.derived[bob]     = []string{"d2"}

    raw, err := m.BuildStateFor(alice)
    // assert: derived has alice.String() key with ["d1"], no bob key.
    // assert: completed has alice.String() with ["c1"], no bob key.
}

func TestCombination_BuildStateFor_EmptyForNewPlayer(t *testing.T) { ... }

func TestCombination_BuildStateFor_CollectedMirror(t *testing.T) {
    // evidence.collected event 로 m.collected[alice][e1]=true 설정 후
    // alice 스냅샷에만 collected["alice-uuid"] = ["e1"] 나타나는지.
}
```

#### snapshot_redaction_test.go 신규 케이스

```go
func TestSnapshot_Redaction_CombinationCrafted(t *testing.T) {
    // 2-player session with combination module configured.
    // Alice triggers combine (evidence_ids e1+e2) → derived d1.
    // Request snapshot for Bob. Bob's payload must NOT contain "d1"
    // in any combination.derived field.
}
```

## PR-2b 와의 관계

PR-2b 의 커밋 granularity 제안에서 combination 은 **stub 유지** (PR-2b 가 real 구현으로 교체하지 않음). PR-2b 의 lint "BuildStateFor real 구현 필수" 는 combination 을 예외 리스트에 두고, PR-2c 머지 시 예외 제거. 이유: PR-2b 리뷰어가 combination 의 `derived/collected/completed` 3-way map 교차 필터를 별도 검증하기 쉽도록 분리.

**병렬 가능 여부**: combination.go 파일 하나만 touch 하므로 PR-2b 와 **동일 파일 수정 없음** 조건 하에 병렬 가능. 단 PR-2b 의 카테고리 커밋에서 crime_scene 묶음에 combination.go 가 들어가면 conflict → PR-2b 를 evidence/location 만 포함하도록 조정 + combination 은 PR-2c 전담. **순차 권장**: PR-2b 머지 → PR-2c rebase.

## Size · Risk 재추정

- **Size S-M**: combination.go +60 LOC (snapshotFor + BuildStateFor + 주석), combination_test.go +80 LOC, snapshot_redaction_test.go +40 LOC ≈ **180 LOC**.
- **Risk Low**:
  - 기존 `craftedAsClueMap(playerID)` helper 가 이미 per-player 필터를 올바르게 수행하는 패턴을 확립. `snapshotFor` 는 같은 패턴을 3 map 에 확장할 뿐.
  - `BuildState()` 정책 (A) 유지로 기존 테스트 (`TestCombination_*`) 영향 없음.
  - 클라이언트 소비 측면: Phase 18.1 B-2 이후 클라이언트는 이미 `combination.derived[myPlayerId]` 만 읽는 패턴이므로 재렌더링 영향 없음 (확인 필요: `apps/web/src/features/game/runtime/modules/combination.ts` 가 있다면 grep).

## 검수 체크리스트

- [ ] `TestCombination_BuildStateFor_*` 3개 통과
- [ ] `TestSnapshot_Redaction_CombinationCrafted` 통과
- [ ] `TestCombination_Integration` 기존 테스트 무회귀
- [ ] `module-inventory.md` 의 combination 라인 PlayerAware O 로 업데이트
- [ ] E2E 회귀 (recovery 시나리오에서 combination 재조합 플로우 영향 없음)
- [ ] `docs/plans/2026-04-17-platform-deep-audit/refs/pr-2/current-state.md` 의 combination 라인 "PlayerAware 구현 완료" 로 업데이트

## PR-2b 와의 충돌 방지 운영

- PR-2b 브랜치가 open 인 동안 PR-2c 는 `main + PR-2a` 기반으로 분기.
- PR-2b 머지 후 PR-2c 는 1회 rebase — combination.go 가 stub 에서 real 로 변할 가능성이 없으므로 (PR-2b 는 combination 을 안 건드림) conflict 없음.
