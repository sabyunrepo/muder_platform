# PR-T2 — 4 장르 N 프리셋 JSON 템플릿

**Wave**: 5 · **Sequential** · **Depends on**: T1 · **Worktree**: optional

## Scope globs
- `apps/server/internal/template/presets/murder_mystery/*.json` (new)
- `apps/server/internal/template/presets/crime_scene/*.json` (new)
- `apps/server/internal/template/presets/script_kill/*.json` (new)
- `apps/server/internal/template/presets/jubensha/*.json` (new)
- `apps/server/internal/template/presets_test.go` (new)

## Context
4 장르 × N 프리셋 JSON 파일 작성. T1 loader 가 모든 프리셋을 검증 통과해야 머지.

## Tasks

1. **murder_mystery** — 최소 3 프리셋 (6P classic / 8P expert / 4P quick)
   - 모듈: cluedist.starting, cluedist.round, cluedist.conditional, decision.voting, decision.accusation, progression.timer, progression.ending
2. **crime_scene** — 최소 2 프리셋 (3 locations / 5 locations)
   - 모듈: crime_scene.location, crime_scene.evidence, crime_scene.combination, decision.accusation, progression.timer
3. **script_kill** — 최소 2 프리셋 (3 rounds / 5 rounds)
   - 모듈: cluedist.round (script 배부), progression.timer, decision.voting, decision.accusation, media.bgm
4. **jubensha** — 최소 2 프리셋 (1st person / 3rd person)
   - 모듈: communication.groupchat, communication.whisper, cluedist.round, decision.voting, media.bgm, progression.timer
5. **presets_test** — golden: 모든 프리셋 loader 검증 통과, 필수 필드 present

## Verification
- `go build ./...` clean
- `go test -race ./internal/template/...` all green (모든 프리셋 load 성공)
- 각 프리셋 수동 검증: JSON schema 유효, 모듈 ID 정확, phase 구조 논리적
- 커버리지 100% (골든 — 프리셋 파일이 곧 테스트 데이터)

## Notes
- 프리셋 JSON 파일은 **장르 테마 작가가 읽기/편집 가능한 형태** 로 작성 (주석/포맷 정리)
- MVP 수준 — 풍부한 컨텐츠는 별도 phase
- `crime_scene.*` 모듈은 F1 에서 구현 — T2 의 crime_scene 프리셋은 F1 머지 후 활성화 (또는 stub 으로 시작)
