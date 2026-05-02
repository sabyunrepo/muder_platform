# 모듈 Skeleton = PublicStateMarker로 시작 카논

> PR-N skeleton 단계 모듈은 `engine.PublicStateMarker` embed로 시작. 진짜 per-player data 추가될 PR에서 marker drop + `BuildStateFor` 구현. F-sec-2 `playeraware-lint`가 강제. PR-1 (#212) ending_branch 시점 등재.

## 카논

**모듈 신설 PR이 Schema/lifecycle 인터페이스만 implement하고 게임 로직 (per-player state, answers, role-private data)이 없으면, `engine.PublicStateMarker`를 embed하고 `BuildStateFor` 메서드를 추가하지 말 것.**

### 강제 메커니즘

`apps/server/scripts/check-playeraware-coverage.sh` (F-sec-2 lint canon)는 다음 패턴을 즉시 fail:

```go
func (m *Module) BuildStateFor(_ uuid.UUID) (json.RawMessage, error) {
    return m.BuildState()  // ❌ 차단됨 — every player에게 동일 state 노출
}
```

이유: per-player trust boundary 우회. PlayerAwareModule 인터페이스 implement는 진짜 redaction 의무.

### Skeleton 패턴 (정답)

```go
type Module struct {
    engine.PublicStateMarker  // ← embed
    mu  sync.RWMutex
    cfg Config
}

// BuildState는 모든 player에게 동일한 public state 반환
func (m *Module) BuildState() (json.RawMessage, error) { ... }

// BuildStateFor 메서드 X — PublicStateMarker가 그 역할 대체

var (
    _ engine.Module            = (*Module)(nil)
    _ engine.ConfigSchema      = (*Module)(nil)
    _ engine.PublicStateModule = (*Module)(nil)  // ← marker 인터페이스
)
```

### Per-player data 추가될 PR 전환 패턴

진짜 redaction이 필요한 PR (예: ending_branch PR-5에서 player answer state 추가) 시점:

1. `engine.PublicStateMarker` embed 제거
2. `BuildStateFor(playerID uuid.UUID)` 메서드 추가 — 진짜 redaction 구현
3. interface assertion: `_ engine.PublicStateModule = (*Module)(nil)` → `_ engine.PlayerAwareModule = (*Module)(nil)`
4. `playeraware-lint`가 redaction 로직 (snapshot 함수 호출 등) 검증 통과 확인

## Anti-pattern (금지)

- ❌ Skeleton에 `engine.PlayerAwareModule` interface assertion 추가 + `BuildStateFor`가 `BuildState`로 delegate — F-sec-2 lint 차단됨
- ❌ "TDD 신호 — PR-5에서 break하면 그때 redaction 구현" 분류 — CI canon이 즉시 차단하므로 deferred 분류 무효
- ❌ 4-agent round-N critic의 "premature PlayerAwareModule" 지적을 다음 PR로 이연 — 같은 fix-loop에서 처리

## 근거 사례 (PR-1 #212)

- 4-agent round-1 critic 지적: "engine.PlayerAwareModule interface assertion at module.go:163 is premature for a skeleton"
- Round-1 fix에서 처리 안 함 → CI `playeraware-lint` 차단 (CI run 4 fail)
- Fix `f6624e2`: `engine.PublicStateMarker` embed + `BuildStateFor` 제거 → playeraware-lint PASS

## 연관 카논

- `memory/MISTAKES.md` 2026-05-02 premature-playeraware-skeleton entry
- `apps/server/scripts/check-playeraware-coverage.sh` (lint canon master)
- `apps/server/internal/engine/types.go` PublicStateMarker definition (line 117-130)
- `apps/server/internal/module/decision/{voting,accusation,hidden_mission}` sibling 모듈 (어느 패턴 사용하는지 비교 reference)

## 적용 대상

- 새 모듈 추가 PR (decision/cluedist/communication/crime_scene/exploration/media/progression 등 어느 sub-package)
- 기존 모듈에 player-private data 추가 PR (역방향 전환)
