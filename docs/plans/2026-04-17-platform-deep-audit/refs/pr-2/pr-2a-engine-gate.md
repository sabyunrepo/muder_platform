# PR-2a — Engine Gate + Mandatory Interface

> Size: **S** · Risk: **Low** · Dependency: 없음 (단독 mergeable)
> Finding: F-sec-2 인프라 (게이트만, 실구현은 PR-2b)

## 목표

`engine.PlayerAwareModule` 을 선택(optional) → *규약상* 의무로 승격. 단 의무화 방식은 **compile-time assertion + registry boot-fail** 이중 게이트로 enforce 한다. 실제 redaction 로직은 모듈마다 다르므로 PR-2a 는 *인프라* 만 깔고, PR-2b 가 real 구현을 채운다.

## Scope

| 파일 | 변경 | 책임 |
|------|------|------|
| `apps/server/internal/engine/types.go` | 수정 | `PlayerAwareModule` 문서 업데이트 ("mandatory") + `PublicStateModule` sentinel 추가 |
| `apps/server/internal/engine/factory.go` | 수정 | `Create(name)` 가 반환 모듈에 대해 PlayerAware **OR** PublicState 중 하나 구현 검증, 둘 다 미구현이면 error |
| `apps/server/internal/engine/registry.go` | 수정 | `Register(name, factory)` 가 첫 호출 시 (init() 시점) factory 를 **한 번 실행해 interface 검증** → 미충족 시 panic (boot fail) |
| `apps/server/internal/module/**/*.go` | 수정 | 모든 33 모듈에 `BuildStateFor` **stub** 또는 `var _ engine.PublicStateModule = ...` marker 추가 |
| `apps/server/internal/engine/build_state_for_test.go` | 수정 | 기존 fallback test 제거 → "모든 등록 모듈이 PlayerAware OR PublicState 구현" gate test 로 교체 |
| `apps/server/internal/engine/factory_test.go` | 신규 | 가상 모듈(미구현) 팩토리 등록 시 `Create` 가 error 리턴 확인 |

## 변경 내용

### 1. types.go — sentinel marker + 문서 업데이트

```go
// PlayerAwareModule는 per-player redaction 이 필요한 모듈이 구현한다.
// PR-2 이후로 Module 구현체는 PlayerAwareModule 또는 PublicStateModule
// 둘 중 하나를 반드시 만족해야 한다. registry 가 boot 시점에 검증한다.
type PlayerAwareModule interface {
    BuildStateFor(playerID uuid.UUID) (json.RawMessage, error)
}

// PublicStateModule 은 state 가 전 플레이어에게 동일하게 공개됨을 선언하는
// sentinel marker. 메서드는 의도적으로 비움 — compile-time marker 용도.
// 이 marker 를 달면 registry 의 mandatory 게이트를 통과한다.
// 예: room, ready, audio, consensus_control 등.
type PublicStateModule interface {
    isPublicState()   // 패키지 외부 구현 금지 — engine 패키지 내부 타입만 임베드 가능
}
```

> 대안: sentinel 대신 `BuildStateFor` 를 public state 모듈도 구현(그냥 `BuildState` 호출). 장점: 타입 하나. 단점: "공개 state" 라는 설계 의도가 코드에 안 드러남 → F-sec-2 재발 위험. **sentinel marker 채택 권장.**

### 2. factory.go — Create 검증

```go
func (f *Factory) Create(name string) (Module, error) {
    factory, ok := f.registry.Get(name)
    if !ok {
        return nil, fmt.Errorf("module %q not registered", name)
    }
    m := factory()

    // PR-2 mandatory gate: PlayerAware OR PublicState 중 하나 구현 필수.
    _, isPlayerAware := m.(PlayerAwareModule)
    _, isPublic := m.(PublicStateModule)
    if !isPlayerAware && !isPublic {
        return nil, fmt.Errorf(
            "module %q violates F-sec-2: must implement PlayerAwareModule "+
                "or declare PublicStateModule", name)
    }
    return m, nil
}
```

### 3. registry.go — 첫 등록 시 sanity check

```go
func Register(name string, factory ModuleFactory) {
    // PR-2a: init() 시점 factory 시험 호출로 interface 게이트 강제.
    sample := factory()
    _, isPA := sample.(PlayerAwareModule)
    _, isPS := sample.(PublicStateModule)
    if !isPA && !isPS {
        panic(fmt.Sprintf(
            "module %q F-sec-2 violation: "+
                "implement BuildStateFor or embed engine.PublicStateMarker",
            name))
    }
    defaultRegistry.register(name, factory)
}
```

### 4. 모듈 33개 업데이트

각 모듈 파일 상단에 **둘 중 하나만** 추가:

- **PlayerAware 모듈** (21개, PR-2b 대상 13 + 이미 구현된 8): stub 추가 (13개) — `func (m *X) BuildStateFor(playerID uuid.UUID) (json.RawMessage, error) { return m.BuildState() }` + `var _ engine.PlayerAwareModule = (*X)(nil)`. PR-2b 에서 real 구현으로 교체.
- **Public 모듈** (12개): embed `engine.PublicStateMarker` 익명 임베드 또는 `func (*X) isPublicState() {}` 구현 + `var _ engine.PublicStateModule = (*X)(nil)`.

> **주의**: `isPublicState()` 는 unexported method 이므로 외부 패키지에서는 구현 불가. engine 패키지가 helper type 을 export 해야 한다.

```go
// engine/types.go 추가
// PublicStateMarker embeds to satisfy PublicStateModule from outside packages.
type PublicStateMarker struct{}
func (PublicStateMarker) isPublicState() {}
```

모듈 쪽:
```go
type RoomModule struct {
    engine.PublicStateMarker
    // ...
}
```

### 5. 테스트

- `engine/build_state_for_test.go`: 기존 "PlayerAware 미구현 → fallback to BuildState" 케이스 제거 (이제 gate 가 그 상태를 막음). 대신 "PlayerAware 구현 모듈 → 해당 메서드 호출", "Public 모듈 → BuildState 호출" 두 분기.
- `engine/factory_test.go` (신규): 가상 모듈 3종 — (a) PlayerAware 만 (b) Public 만 (c) 둘 다 미구현 — 각각 Create 결과 검증. (c) 는 error 반환 확인.
- `engine/registry_test.go`: 현재 `TestRegister`/`TestAllNames` 가 있다면 그대로. 신규로 미구현 factory 가 `Register` 에 들어오면 panic 확인 (defer recover).

## 의존성

- **상류**: 없음. main HEAD 에서 바로 착수.
- **하류**: PR-2b 는 이 PR 머지 후 stub 을 real 구현으로 교체. PR-2c 도 이 PR 머지 전제.

## Size · Risk 재추정

- **Size S**: types.go +20 LOC · factory.go +10 · registry.go +8 · 모듈 33개 평균 +4 LOC (stub or marker) ≈ **170 LOC 변경**, 33 파일. XL 우려는 모듈 개수 때문이지만 변경은 모두 boilerplate.
- **Risk Low**:
  - Panic 경로는 `init()` 시점 — 시작 시점에 즉시 발현되어 숨겨진 regression 없음.
  - Stub 의 `BuildStateFor` 는 `BuildState` 호출 → 동작 동일. 사용자 체감 0.
  - Rollback: PR revert 로 인터페이스 게이트 제거, stub 메서드는 남아도 무해.
- **CI risk**: build_state_for_test.go 기존 fallback 테스트를 삭제·재작성해야 함. 이 재작성이 빠지면 PR-2b 머지 시 test drift 로 빨간불.

## 검수 체크리스트

- [ ] `go build ./...` 성공 (33 모듈 전부 인터페이스 충족)
- [ ] `go test ./internal/engine/...` 통과
- [ ] `go test ./internal/module/... -run Build` — 각 모듈의 BuildState / BuildStateFor 테스트 그대로 통과 (stub 이므로 동일 결과)
- [ ] `go test ./internal/session/... -run Redaction` — 기존 snapshot_redaction_test 그대로 통과
- [ ] 가상 "미구현 모듈" 을 한 번 registry 에 넣어보고 panic 출력 육안 확인 (테스트 내부)
- [ ] `module-inventory.md` 의 PlayerAware 수치 업데이트 (33/33 실구현은 PR-2b 완료 후, PR-2a 시점은 "21 real + 12 public" 로 표기)

## 예상 PR 구성

- 커밋 1: engine types.go + factory.go + registry.go + PublicStateMarker 헬퍼 타입
- 커밋 2: 12 public 모듈에 marker 추가 (카테고리별 묶음)
- 커밋 3: 13 pending PlayerAware 모듈에 stub 추가
- 커밋 4: 기존 8 PlayerAware 모듈에 `var _ engine.PlayerAwareModule = (*X)(nil)` assertion 추가 (누락된 곳만)
- 커밋 5: engine 테스트 업데이트 + factory_test.go 신규
