# PR-A — `MMP_PLAYERAWARE_STRICT` 제거 + `PhaseEngine.BuildState()` godoc

> Size: **S** · Risk: **Med** · Dependency: 없음

## 목표

PR-2c 사후 4-agent 리뷰의 MEDIUM 2건을 하나의 작은 PR 에 번들한다.

1. **`MMP_PLAYERAWARE_STRICT` env 삭제** — PR-2a 도입 당시 12/33 모듈이 gate 미충족이라 rollout 안전판으로 env escape hatch 를 두었음. PR-2c 로 12/12 + PublicStateMarker 13/13 → 33/33 Full coverage 달성. escape hatch 는 이제 "실수로 false 가 설정될 때 전체 gate 무력화" 라는 negative-only 가치만 남음.
2. **`PhaseEngine.BuildState()` godoc 강화** — 리뷰 "설계 drift 의심 포인트 #1": `BuildState()` 는 모든 모듈에 pub 메서드로 노출되어 있어 새 handler 가 직접 호출하면 전 플레이어 데이터 유출. 컴파일러/런타임 강제 불가이므로 godoc 으로라도 경계 표시.

## Scope

| 파일 | 변경 |
|------|------|
| `apps/server/internal/engine/registry.go` | `strictGateEnabled()` 함수 및 `MMP_PLAYERAWARE_STRICT` env read 제거. `Register()` panic gate 가 항상 발동. |
| `apps/server/internal/engine/phase_engine.go` | `PhaseEngine.BuildState()` godoc: "internal/persistence only — client broadcast MUST use BuildStateFor. Direct callers must be reviewed for per-player data leakage." |
| `apps/server/internal/engine/gate_test.go` | strict env on/off 분기 테스트 제거, gate-always-on 단일 경로만 유지 |
| `CLAUDE.md` | §모듈 시스템 `PlayerAware (의무)` 항목에서 `MMP_PLAYERAWARE_STRICT=false` 롤백 스위치 문구 삭제 |

## 구현 메모

- `strictGateEnabled()` 참조하는 모든 call site 스캔 (`grep -r MMP_PLAYERAWARE_STRICT`) 후 일괄 제거.
- `gate_test.go` 에서 env-on/off 두 모드를 테스트하던 케이스는 `TestRegister_PanicsOnNonCompliantModule` 같은 단일 경로로 남기고 env 조작 로직 제거.
- godoc 업데이트는 stand-alone 1 문단. "This method returns the all-player state used for persistence (SaveState) and admin/test fixtures. Runtime client broadcast MUST flow through BuildStateFor — any new handler calling this method directly is a per-player data leakage hazard and must be reviewed."

## 테스트

- 기존 `engine/gate_test.go` 통과 (strict on/off 케이스 축약 후)
- `go test -race -count=1 ./internal/engine/...`
- 부팅 시 33 모듈 전부 gate 통과 확인 (이미 검증된 상태지만 env 제거로 다시 회귀)

## 리스크

- `MMP_PLAYERAWARE_STRICT=false` 로 production 환경에 유일한 escape hatch 가 존재하는 경우, 이 PR 머지 후 해당 환경의 모든 모듈이 gate 미충족 시 boot panic 으로 fail. **사전 점검**: 2026-04-18 기준 33/33 모듈이 gate 충족 → 회귀 가능성 없음.
- godoc-only 변경은 이전 behaviour 에 영향 없음.

## 검증 체크리스트

- [ ] `strictGateEnabled` 참조 0건 확인 (`grep`)
- [ ] `MMP_PLAYERAWARE_STRICT` 참조 0건 확인
- [ ] `go test -race` engine + 전 모듈 green
- [ ] 실제 main 바이너리 부팅 smoke: `go run ./cmd/server` 3초 내 Registry log 출력 + panic 없음
- [ ] CLAUDE.md §모듈 시스템에서 롤백 스위치 문구 삭제 완료
