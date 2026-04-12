# PR-T1 — Template Loader + Validator + Schema Merger

**Wave**: 5 · **Sequential** · **Depends on**: A4, B1, B2, B3, B4 · **Worktree**: optional

## Scope globs
- `apps/server/internal/template/loader.go` (new)
- `apps/server/internal/template/validator.go` (new)
- `apps/server/internal/template/schema_merger.go` (new)
- `apps/server/internal/template/types.go` (new)
- `apps/server/internal/template/loader_test.go` (new)
- `apps/server/internal/template/validator_test.go` (new)
- `apps/server/internal/template/schema_merger_test.go` (new)
- `apps/server/internal/server/template_handler.go` (new)
- `apps/server/internal/server/router.go` (modify — 라우트 등록)

## Context
JSON 템플릿 시스템의 코어. `go:embed` 로 프리셋 번들, loader 가 모듈 schema 와 교차 검증, HTTP 엔드포인트로 에디터에 schema 제공.

## Tasks

1. **types** — `Template` struct (ID, Genre, Version, Modules, Phases, Rules), `TemplateModule` (ID, Config json.RawMessage)
2. **loader** — `go:embed` presets/ 전체, `Load(id) (*Template, error)`, `List() []TemplateMeta`
3. **validator** — 템플릿의 각 모듈 ID 가 registry 에 존재, 각 모듈 config 가 `GetConfigSchema()` 와 매칭
4. **schema merger** — 템플릿의 모든 모듈 schema 를 merge (allOf) 해서 에디터에 제공할 단일 JSON Schema 생성
5. **HTTP handler** — `GET /api/templates`, `GET /api/templates/{id}`, `GET /api/templates/{id}/schema`
6. **router 등록**
7. **tests** — loader golden, validator 엣지 케이스, schema merger 정합성, handler 통합

## Verification
- `go build ./...` clean
- `go test -race ./internal/template/...` all green
- HTTP 핸들러 통합 테스트 (기존 pattern 따라)
- 커버리지 ≥ 85% (golden tests)

## Notes
- T1 머지 후에야 T2 프리셋 JSON 이 검증 통과 가능 — 순차
- 에디터 (C1) 는 T1 의 `/schema` endpoint 에 의존
