---
name: mmp-module-factory
description: MMP v3 게임 모듈 작성 템플릿. BaseModule + ConfigSchema(선언적 설정) + AutoContent(자동 콘텐츠) + PhaseReactor(선택적) + Factory(세션별 인스턴스) + init()/blank import 등록. 신규 모듈, 장르, 메타포, 단서 모듈 추가 시 필수.
---

# mmp-module-factory — 모듈 작성 템플릿

## 왜
MMP v3는 세션별 독립 인스턴스를 강제한다. 싱글턴/전역 상태는 멀티 세션에서 크로스 오염을 일으킨다. Factory + ConfigSchema 조합이 에디터 자동 노출과 테스트 격리를 동시에 달성한다.

## 파일 레이아웃

신규 모듈은 `apps/server/internal/module/<category>/<name>/` 아래에 아래 4-5개 파일로 시작:

```
<name>/
├── core.go       # 모듈 struct + 생명주기 메서드 (Init/Start/Stop)
├── schema.go     # ConfigSchema 선언 + 검증
├── factory.go    # Factory 함수 + deps 주입
├── reactor.go    # (선택) PhaseReactor 구현
└── events.go     # (선택) 내부 이벤트 타입
```

각 Go 파일 500줄 이하, 함수 80줄 이하.

## 필수 패턴

### 1. Factory (`factory.go`)
```go
type Deps struct {
    Bus       eventbus.Bus
    Logger    zerolog.Logger
    Clock     clock.Clock
}

func NewFactory(d Deps) module.Factory {
    return func(sessionID string, cfg module.Config) (module.Module, error) {
        if err := schema.Validate(cfg); err != nil {
            return nil, apperror.New(ErrInvalidConfig, err)
        }
        return &Module{sid: sessionID, cfg: cfg, d: d}, nil
    }
}
```

### 2. 등록 (`init()` + blank import)
```go
// <name>/init.go (짧으면 factory.go에 통합 가능)
func init() {
    module.Register("<category>/<name>", /* manifest */)
}
```

최상위 서버 `main.go` 또는 `module/all.go`:
```go
import _ "...internal/module/<category>/<name>"
```

### 3. ConfigSchema (`schema.go`)
- 단일 소스: Go struct 태그 기반. JSON 중복 선언 금지.
- 에디터 노출 필드는 `json:"..." editor:"label,hint,required"` 메타 태그로.
- 검증은 `Validate(cfg)` 함수로 중앙화.

### 4. PhaseReactor (선택)
모듈이 Phase 이벤트에 반응할 때만 구현. 전부 구현 강제 아님.
```go
func (m *Module) OnPhase(ctx context.Context, a phase.Action) error { ... }
```

### 5. 이벤트 relay
`EventBus.SubscribeAll` + prefix 기반. 임시 채널 생성 금지.

## 테스트 요구
- Factory 독립성: 동일 sessionID 두 번 호출해도 서로 다른 인스턴스.
- ConfigSchema 검증: 잘못된 cfg에 `ErrInvalidConfig` 반환.
- PhaseReactor 구현 시: Phase 이벤트 순서 보존.

## 금지
- 패키지 전역 변수(맵, 슬라이스)로 세션 상태 공유
- 런타임 동적 등록
- Config 이중 선언(struct + 별도 JSON)
- Factory 서명에 deps 3개 초과 — 초과 시 `Deps` 구조체로 묶기

## 체크리스트
- [ ] 파일 4-5개로 분할, 각 500줄 이하 / 함수 80줄 이하
- [ ] Factory가 세션별 독립 인스턴스 반환
- [ ] ConfigSchema 단일 소스 + 검증 함수
- [ ] `init() { Register(...) }` + blank import 추가
- [ ] PhaseReactor는 필요할 때만 구현
- [ ] 모듈 추가 후 `docs/plans/2026-04-05-rebuild/module-spec.md` 갱신 알림
