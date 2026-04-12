# Scope & 7 Standard Decisions

## 1. Scope

### IN
- Phase 8.0 `Module` 인터페이스 → ISP 리파인먼트 (Core 7 + Optional 5, 임시명 `Plugin*`)
- 레거시 삭제: `GameProgressionEngine`, `ProgressionStrategy`, 3 strategies, `dispatcher.go`, `validation.go`, `eventbus/`
- 신규 패키지: `internal/auditlog/`, `internal/clue/`, `internal/template/`
- 신규 엔진 컴포넌트: `PhaseEngine` (JSON 구동), `EventBus` (typed), `RuleEvaluator` (JSON Logic), `Validator chain`
- Phase 8.0 29 모듈 새 인터페이스로 마이그 (대부분 Optional opt-in 만 추가)
- 4 장르 × N 프리셋 JSON 템플릿 (embed)
- L1 에디터 MVP (SchemaDrivenForm 자동 폼)
- CrimeScene 전용 모듈 (Location/Evidence/Combination)

### OUT (명시적 비목표)
- L2 Phase Timeline 에디터 (별도 phase)
- L3 Visual Node Editor (별도 phase)
- 모듈 팔레트 커스텀 조합 UX (백엔드 지원하나 MVP UI 미노출)
- 모바일 에디터
- LiveKit 통합 변경
- 템플릿 마켓플레이스 / 공유
- 템플릿 DB 저장 (MVP 는 go:embed 만)

## 2. Architecture pattern — Composable Module + JSON Template

**핵심**: 장르는 Go 코드에 존재하지 않는다. JSON 템플릿이 "어떤 모듈 + 설정 + 페이즈" 를 선언.

```
internal/engine/
  module.go           Core 7 (temp: Plugin)
  module_optional.go  5 Optional interfaces
  module_types.go     GameEvent, GameState, Phase, WinResult, Rule
  module_registry.go  PluginRegistry (factory)
  phase_engine.go     JSON template 구동 phase machine      [A4]
  event_bus.go        typed pub/sub                          [A2]
  rule_evaluator.go   JSON Logic                             [A7]
  validator.go        validation chain                        [A5]

internal/module/      재사용 모듈 (Phase 8.0 대부분 생존)
  cluedist/  communication/  core/  decision/
  exploration/  media/  progression/  crime_scene/(신규)

internal/clue/         ClueGraph primitive                   [A6]
internal/auditlog/     append-only event log                 [A3]
internal/template/     loader + validator
  presets/             go:embed JSON
    murder_mystery/  crime_scene/  script_kill/  jubensha/
```

## 3. Lifecycle

- **Module 인스턴스**: 세션당 Factory 로 fresh 생성 (싱글턴 금지)
- **Template load**: 세션 시작 시 1회, 모든 Module `GetConfigSchema()` 로 검증
- **Init 순서**: 템플릿 선언 순서 (deterministic)
- **Phase 전환**: PhaseEngine 구동, `PhaseHookPlugin` 구현체에만 `OnPhaseEnter/Exit` 호출
- **Cleanup**: 역순, 세션 종료/패닉 시

## 4. External interface

- **WS 프로토콜**: 변경 없음 (`game.action` / `game.event` / `game.state`)
- **신규 REST**:
  - `GET /api/templates/{id}` — 템플릿 메타
  - `GET /api/templates/{id}/schema` — 모든 모듈 schema merge 결과
- **Backend → Editor 계약**: 모듈별 `GetConfigSchema()` → 템플릿 단위로 merge → 프론트 `SchemaDrivenForm` 자동 렌더
- **Editor → Backend**: theme JSON 저장 시 template loader 검증

## 5. Persistence / State

- **모듈 상태**: Optional `SerializablePlugin` (BuildState/RestoreState)
- **스냅샷**: 기존 `game_snapshots` 테이블 재사용 (sqlc 변경 없음)
- **Audit log**: 신규 `internal/auditlog/`, append-only, 세션별
- **템플릿**: `go:embed` (MVP), DB 저장은 future
- **테마**: 기존 `themes` 테이블

## 6. Operational safety

- **Panic 격리**: PhaseEngine 경계에서 모듈 panic catch → audit 기록 → 세션 error state (서버 크래시 X)
- **Observability**: zerolog 구조화 (`session_id`, `module_id`, `event_id`, `phase_id`)
- **Tests**: 엔진/모듈 75%+ 커버리지, 장르별 e2e 1개씩
- **Race**: `go test -race` CI 게이트
- **모듈 격리 테스트**: 한 모듈 변경 → 다른 모듈 빌드/테스트 통과 (CI 자동화, V1)
- **Template validation**: load 시 fail-fast, JSON path 명시 에러

## 7. Rollout — 빅뱅

- **No feature flag**. A4 에서 레거시 통째 삭제 + 리네임
- Wave 1 (A1/A2/A3): 신규 코드 임시명으로 추가, 기존 코드 불변
- Wave 2 (A4): `Plugin → Module` 리네임, 32 consumer 동시 수정, 레거시 삭제
- A4 머지 전: wave1 전체 머지, user 승인 1회 게이트 필수
- Rollback: A4 리버트 = 레거시 전체 복원
