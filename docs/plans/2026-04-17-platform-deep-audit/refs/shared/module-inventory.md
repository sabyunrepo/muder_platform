# Module Inventory & Compliance Matrix — Phase 19 W1

> 실측: `apps/server/internal/module/**` · `apps/server/internal/engine/**` (2026-04-17)
> 설계 문서 "29개 모듈" vs 실측 **33개** → **+4개 차이**. 상세는 §Drift.

## 규약 요약 (engine/types.go 기준)

| 규약 | 필수/선택 | 구현 방식 |
|------|---------|---------|
| `engine.Module` | **필수** | `Name/Init/BuildState/HandleMessage/Cleanup` 5 메서드 |
| Factory | **필수** | `engine.Register(name, func() engine.Module { return NewXxx() })` in `init()` |
| blank import | **필수** | `apps/server/internal/module/register.go` 8개 카테고리 패키지 blank import |
| `engine.ConfigSchema` | 선택 | `Schema() json.RawMessage` 반환 |
| `engine.PhaseReactor` | 선택 | `ReactTo + SupportedActions` — Phase action에 반응할 때만 |
| `engine.GameEventHandler` | 선택 | `Validate + Apply` — 이벤트 수신 모듈 |
| `engine.SerializableModule` | 선택 | `SaveState + RestoreState` — 스냅샷/재접속 |
| `engine.WinChecker` | 선택 | `CheckWin` — 승패 판정 |
| `engine.PlayerAwareModule` | 선택 | `BuildStateFor` — 플레이어별 redaction |

**중요**: 설계 문서(CLAUDE.md · project_module_system.md)에 나오는 `BaseModule` 임베드 타입은 코드에 존재하지 않는다. 각 모듈이 직접 `engine.Module`을 구현하고 컴파일 타임 체크 `var _ engine.Module = (*XxxModule)(nil)`로 검증한다. **설계-코드 drift #1.**

## 인벤토리 (실측 33개)

| # | 이름 | 카테고리 | Module | Factory+init() | ConfigSchema | PhaseReactor | Extra | LOC |
|---|------|---------|:-:|:-:|:-:|:-:|-----|----:|
| 01 | room | core | O | O | - | - | - | 140 |
| 02 | ready | core | O | O | - | - | GEH | 179 |
| 03 | connection | core | O | O | - | - | SER | 180 |
| 04 | clue_interaction | core | O | O | O | O | GEH | 475 |
| 05 | starting_clue | cluedist | O | O | O | - | SER | 259 |
| 06 | round_clue | cluedist | O | O | O | - | GEH+SER | 320 |
| 07 | timed_clue | cluedist | O | O | O | - | SER | 325 |
| 08 | conditional_clue | cluedist | O | O | O | - | GEH | 326 |
| 09 | trade_clue | cluedist | O | O | O | O | SER | 531 |
| 10 | text_chat | communication | O | O | O | O | GEH | 242 |
| 11 | whisper | communication | O | O | - | O | GEH | 236 |
| 12 | group_chat | communication | O | O | O | O | GEH+SER | 426 |
| 13 | voice_chat | communication | O | O | - | - | - | 182 |
| 14 | spatial_voice | communication | O | O | - | - | - | 201 |
| 15 | evidence | crime_scene | O | O | - | - | GEH+SER | 399 |
| 16 | location | crime_scene | O | O | - | - | GEH+SER | 316 |
| 17 | combination | crime_scene | O | O | - | - | GEH+WIN+SER | 482 |
| 18 | accusation | decision | O | O | O | - | GEH+WIN | 506 |
| 19 | voting | decision | O | O | O | O | GEH+WIN+SER | 638 |
| 20 | hidden_mission | decision | O | O | O | - | SER+WIN | 558 |
| 21 | floor_exploration | exploration | O | O | O | O | GEH | 204 |
| 22 | room_exploration | exploration | O | O | O | - | GEH | 217 |
| 23 | timed_exploration | exploration | O | O | O | - | GEH | 297 |
| 24 | location_clue | exploration | O | O | O | - | GEH | 187 |
| 25 | audio | media | O | O | - | O | GEH | 200 |
| 26 | script_progression | progression | O | O | O | - | - | 148 |
| 27 | event_progression | progression | O | O | O | - | - | 185 |
| 28 | hybrid_progression | progression | O | O | O | - | - | 184 |
| 29 | reading | progression | O | O | O | - | - | 642 |
| 30 | gm_control | progression | O | O | - | - | - | 187 |
| 31 | consensus_control | progression | O | O | - | - | - | 248 |
| 32 | skip_consensus | progression | O | O | O | - | - | 239 |
| 33 | ending | progression | O | O | O | - | - | 198 |

> Extra 약어: **GEH**=GameEventHandler · **SER**=SerializableModule · **WIN**=WinChecker. **PlayerAwareModule 실측 0건.**

## 총계

| 항목 | 구현 | 총 | 비율 |
|------|----:|---:|----:|
| engine.Module 인터페이스 | 33 | 33 | **100%** |
| Factory + init() + engine.Register | 33 | 33 | **100%** |
| blank import (register.go) | 8 카테고리 전부 | 8 | **100%** |
| ConfigSchema (선택) | 22 | 33 | 67% |
| PhaseReactor (선택) | 8 | 33 | 24% |
| GameEventHandler (선택) | 17 | 33 | 52% |
| SerializableModule (선택) | 11 | 33 | 33% |
| WinChecker (선택) | 4 | 33 | 12% |
| PlayerAwareModule (선택) | 0 | 33 | **0%** |
| LOC 합계 (non-test) | 10,057 | - | - |
| 500줄 초과 파일 | 6 | 33 | 18% |

**500줄 초과 모듈** (`CLAUDE.md` Go 500줄 하드 리밋 위반): `progression/reading.go`(642) · `decision/voting.go`(638) · `decision/hidden_mission.go`(558) · `cluedist/trade_clue.go`(531) · `decision/accusation.go`(506) · `core/clue_interaction.go`는 475 (경계). → W2 `01-go-backend` finding 대상.

## 비준수 TOP 3 (필수 규약 기준)

실측상 **필수 규약 (Module + Factory + init) 33/33 전원 충족**. 비준수는 "선택적이어야 할 자리에 미구현으로 기능 공백이 생긴 케이스"로 재정의.

1. **PlayerAwareModule 0/33** — Phase 18.1 B-2 redaction boundary 인터페이스인데 아무도 구현하지 않음. `hidden_mission.go`(role-private), `whisper.go`(1:1 메시지), `starting_clue.go`(플레이어별 시작 단서)는 명백한 private state 보유. `module_types.go:94-97` 인터페이스만 존재, 호출처는 `BuildModuleStateFor`에서 fallback만 타는 중. → **W2 `05-security` cross-ref 대상**.
2. **communication/voice_chat.go:182 · spatial_voice.go:201 · core/room.go:140** — ConfigSchema 미구현. 에디터에서 설정 불가능 → 하드코딩 의존. voice_chat은 `maxChannels`·`codec`·LiveKit opts, spatial_voice는 `radius`·`attenuation` 등 명백한 튜닝 노브가 있는데 노출 경로 없음.
3. **progression/gm_control.go:15 주석 "Does not implement ConfigSchema or PhaseReactor"** — 자체 주석으로 선언적 스키마 부재를 공식화함. GM 제어는 호스트가 타임라인에서 직접 조작하는 축이라 Phase action 매핑이 자연스러운 후보(`ActionLockModule`·`ActionUnlockModule`이 types.go:30-31에 이미 정의). 현재 gm_control은 이 action들의 reactor가 아님.

## 중복·스멜 (≤5)

1. **`crime_scene/location.go` vs `exploration/location_clue.go` vs `exploration/floor_exploration.go`** — "장소" 개념이 3 모듈에 분산. `location`은 장소 엔티티 CRUD + 이벤트, `location_clue`는 장소별 단서 노출, `floor_exploration`은 층 단위 탐색. 경계가 코드 주석 외에는 명확하지 않음. config 중복(장소 목록을 여러 곳에서 선언) 소지 → W2 `03-module-architect` finding 후보.
2. **`progression/script_progression` · `event_progression` · `hybrid_progression`** — hybrid가 앞 둘의 합성인데 3개 별도 모듈로 등록. hybrid.go:184 LOC 중 상당수가 script/event 재구현 가능성. DRY 위반 의심 → W2 `03` finding 후보.
3. **`decision/voting.go` 638 LOC** — 500줄 리밋 초과 + WinChecker·SerializableModule·PhaseReactor·GameEventHandler 4 인터페이스 동시 구현. SRP 위반. `core.go`+`reactor.go`+`snapshot.go` 분할 후보. W2 `01-go-backend` cross-ref.
4. **`cluedist/` 5개 모듈 (starting/round/timed/trade/conditional)** — 모두 "단서 배포 타이밍"이 key differentiator. `conditional_clue`가 조건식을 받으면 나머지 4개를 파라미터화 가능. 설계 시점에 의도적 분할이었는지 검증 필요(의도적이면 docs-navigator drift 체크).
5. **`voice_chat` + `spatial_voice` ConfigSchema 공백 + 0 테스트 Phase reactor** — LiveKit 연동 모듈이 Phase 18.x의 action catalog(BGM·PlaySound·StopAudio는 `audio.go` 전담)와 분리됐는데, 오디오 라이프사이클 일부를 voice가 나눠 가질 여지 있음. 책임 경계 재검토.

## Drift — 설계 문서 vs 실측

- **설계**: `CLAUDE.md`·`project_overview.md`·`project_module_system.md` 모두 "29개 모듈" 명시.
- **실측**: 33개 모듈 파일(non-test `.go`). 카테고리 8개(cluedist 5 · communication 5 · core 4 · crime_scene 3 · decision 3 · exploration 4 · media 1 · progression 8).
- **+4개 추가분 후보**: Phase 9.0 완료 시 "31개 모듈"로 문서화(project_phase90_progress.md), 이후 Phase 11/12/17에서 cluedist·progression 확장으로 33개 도달 가능성. 정확한 증분 이력은 W2 `08-docs-navigator`가 커밋 로그로 확정해야 함.
- **BaseModule**: 설계 문서는 `BaseModule` 임베드를 반복 언급하지만 코드엔 타입 자체가 없음. 규약은 `engine.Module` 인터페이스 + 컴파일 타임 체크로 수렴. → 설계 문서 업데이트 필수(W2 `08-docs-navigator` finding).

## 참조

- 엔진 인터페이스: `apps/server/internal/engine/types.go:70-139`
- 선택 인터페이스: `apps/server/internal/engine/module_optional.go:12-61`
- 레지스트리 + 등록: `apps/server/internal/engine/registry.go:22-30` · `apps/server/internal/module/register.go`
- Factory + host 검증: `apps/server/internal/engine/factory.go:42-95`
- Phase action 카탈로그: `apps/server/internal/engine/types.go:14-32` · `ActionRequiresModule` 매핑 54-65
