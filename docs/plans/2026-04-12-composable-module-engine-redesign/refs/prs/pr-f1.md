# PR-F1 — CrimeScene Module (Location/Evidence/Combination)

**Wave**: 6 · **Parallel**: ×2 · **Depends on**: A4, A7 · **Worktree**: required

## Scope globs
- `apps/server/internal/module/crime_scene/location.go` (new)
- `apps/server/internal/module/crime_scene/evidence.go` (new)
- `apps/server/internal/module/crime_scene/combination.go` (new)
- `apps/server/internal/module/crime_scene/register.go` (new)
- `apps/server/internal/module/crime_scene/*_test.go` (new)

## Context
CrimeScene 장르가 사용할 전용 모듈. Location (장소 이동/탐색), Evidence (증거 발견), Combination (증거 조합 → 새 단서 해금).

## Tasks

1. **Location 모듈**
   - Core 7
   - `GameEventHandler` (move/examine)
   - `SerializablePlugin` (현재 위치, 방문 이력)
   - `RuleProvider` (접근 가능 장소 룰)
2. **Evidence 모듈**
   - Core 7
   - `GameEventHandler` (discover/collect)
   - `SerializablePlugin` (수집한 증거)
   - `PhaseHookPlugin` (OnPhaseEnter 에서 새 증거 해금)
3. **Combination 모듈**
   - Core 7
   - `GameEventHandler` (combine)
   - `WinChecker` (핵심 증거 3종 조합 승리)
   - `RuleProvider` (조합 규칙)
   - `clue.Graph` 라이브러리로 증거 의존성 관리
4. **register.go** — init() + `engine.Register(...)` 3 모듈 등록
5. **tests** — 단위 + 통합 (3 모듈 같이 돌려서 완주 시나리오)

## Verification
- `go build ./...` clean
- `go test -race ./internal/module/crime_scene/...` all green
- 커버리지 ≥ 80%
- 다른 모듈 영향 없음

## Parallel-safety notes
- C1 (프론트) 와 충돌 불가
- B 시리즈 마이그와 다른 디렉터리 (신규 패키지)

## Notes
- T2 의 crime_scene 프리셋 JSON 이 F1 모듈을 참조 — F1 머지 후 T2 프리셋 재검증
