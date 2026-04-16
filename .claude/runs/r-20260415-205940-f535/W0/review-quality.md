---
verdict: pass
issues_high: 0
issues_medium: 2
issues_low: 3
file_size_violations: 1
---

# Phase 18.4 W0 Code Quality + Coverage Review

**Commits:** 848f458 (PR-1 templates route), d5e318b (PR-2 editor fixes)
**Build:** `go build ./...` PASS (exit 0)
**Overall:** PASS with 2 MEDIUM and 3 LOW follow-ups. No CRITICAL/HIGH blockers.

## 파일 크기 체크

| 파일 | 줄수 | 한도 | 상태 |
|------|------|------|------|
| apps/server/cmd/server/main.go | 535 | 500 | **초과 (+35)** — 기존 상태, PR-1이 +10 가중 |
| apps/server/internal/apperror/apperror.go | 155 | 500 | OK |
| apps/server/internal/apperror/codes.go | 116 | 500 | OK |
| apps/server/internal/apperror/handler.go | 123 | 500 | OK |
| apps/server/internal/domain/editor/clue_relation_service.go | 166 | 500 | OK |
| apps/server/internal/domain/editor/clue_relation_handler_test.go | 174 | 500 | OK |
| apps/server/internal/domain/editor/service.go | 1056 | 500 | **기존 초과** (PR-2는 -23 감축) |
| apps/server/internal/domain/editor/service_config.go | 64 | 500 | OK |
| apps/server/internal/domain/editor/service_config_test.go | 202 | 500 | OK |
| apps/server/internal/server/template_handler_test.go | 106 | 500 | OK |

- `service.go` 1056줄은 이번 PR의 신규 위반이 아니라 **선행 기술부채**. PR-2는 UpdateConfigJson을 service_config.go로 추출하여 -23줄 감축하고 주석으로 의도를 명시 (line 484-488). 올바른 분리 방향.
- 함수 크기: 스캔한 editor/service.go의 주요 함수들은 모두 80줄 이하. ValidateTheme(798-864)가 ~67줄로 한계에 근접하나 테이블-드리븐 카운트라 허용.

## Stage 1 — 스펙 준수

PR-1 (templates route):
- main.go:333-336에 `/templates`, `/templates/{id}`, `/templates/{id}/schema` 3개 등록 — spec 일치.
- `NewLoader()` → `NewTemplateHandler(loader)` DI 순서가 기존 DI 패턴(themeHandler, creatorHandler 등)과 동일 (main.go:225-228 추가).
- template_handler_test.go: list / get(존재) / get(404) 3 케이스. **`/templates/{id}/schema`는 스모크 테스트 누락.**

PR-2 (clue-relations empty + config 409):
- clue_relation_service.go:29-31에서 `pgx.ErrNoRows` → 빈 슬라이스 반환 ✓
- clue_relation_handler_test.go: `TestGetClueRelations_Empty`가 200 + 빈 배열(non-null) 검증 ✓
- service_config.go:32-34: `pgx.ErrNoRows` → `buildConfigVersionConflict` ✓
- `buildConfigVersionConflict`가 `GetTheme` 재조회 실패 시 fallback 버전 사용 + Warn 로그 ✓
- service_config_test.go:45-157에서 `extensions.current_version` 존재/positive 검증 ✓
- apperror.go에 `WithExtensions` + deep-copy, handler.go에 Extensions JSON 필드 — RFC 9457 일관.

## Stage 2 — 코드 품질

### MEDIUM

**[MED-1] `/templates/{id}/schema` 핸들러 테스트 누락**
File: `apps/server/internal/server/template_handler_test.go`
Issue: 3개 라우트 중 `schema` 핸들러는 스모크 커버리지 없음. spec 요구 "3개 핸들러 스모크" 미충족.
Fix: 테이블에 `{name: "get template schema", path: "/templates/"+sampleID+"/schema", register: r.Get("/templates/{id}/schema", handler.GetTemplateSchema), wantStatus: 200}` 케이스 추가.

**[MED-2] `TestUpdateConfigJson_VersionMismatch_CarriesCurrentVersion` 경쟁조건 테스트가 결정적이지 않음**
File: `apps/server/internal/domain/editor/service_config_test.go:100-123`
Issue: 실제 race가 conflict를 만들어내지 않을 경우 `testSvc.buildConfigVersionConflict`를 직접 호출하는 fallback이 있음 — 이 경로에선 **실제 service 경로(pgx.ErrNoRows 분기)가 실행되지 않을 수 있음**. 테스트가 CI에서 flaky하게 unit 단위 fallback만 검증할 위험.
Fix: (1) DB 선행 조건 강제 설정 후 `f.q.UpdateThemeConfigJson`을 stale version으로 직접 호출하여 `pgx.ErrNoRows` 분기를 deterministic하게 만든 뒤, service의 상위 전용 테스트에서는 fake/mock queries로 `pgx.ErrNoRows`를 주입. 또는 (2) 현재 race 시도를 N번 loop하고 그래도 실패 시 `t.Fatal` (현재처럼 silent Skip/직접호출 금지).

### LOW

**[LOW-1] main.go 파일 크기 선행 초과 (+35줄)**
File: `apps/server/cmd/server/main.go` 535줄 (한도 500)
Issue: PR-1이 신규 발생시킨 문제는 아니나 한도를 이미 넘은 상태에서 +10줄 추가. 
Fix: 후속 cleanup에서 라우트 등록부를 `registerPublicRoutes(r, handlers)` 형태 헬퍼로 추출 권장. 이번 PR에서 강제 수정은 비권장 (scope creep).

**[LOW-2] clue_relation_service.go H-2 트랜잭션 커밋 후 빈 응답 관찰 가능성**
File: `apps/server/internal/domain/editor/clue_relation_service.go:109-143`
Issue: `pgx.BeginTxFunc` 성공 후 `results`가 nil이면 empty slice로 변환(149-151). 논리는 맞으나, `BulkInsertClueRelations`가 0행을 반환하는 edge case에서 `len(reqs) > 0`인데 `results == nil`이면 silent data loss 가능. 현재 코드는 `len(reqs) == 0`일 때만 insert 스킵하므로 맞지만, `logger.Warn`으로 "insert returned 0 rows while len(reqs)=N" 방어 로그 권장.
Fix: transaction 내부에서 `len(rows) != len(reqs)` 검사 + 에러 반환 또는 경고 로그.

**[LOW-3] service_config.go의 `409` 매직 넘버**
File: `apps/server/internal/domain/editor/service_config.go:59`
Issue: `apperror.New(..., 409, ...)` 하드코딩. 기존 `apperror.Conflict(detail)`를 사용하면 `http.StatusConflict` 상수 기반으로 일관.
Fix:
```go
return apperror.New(
    apperror.ErrEditorConfigVersionMismatch,
    http.StatusConflict,
    "theme was modified by another session",
).WithExtensions(...)
```
또는 `apperror.Conflict("...").WithExtensions(...)` — 단 이 경우 Code가 `ErrConflict`로 덮이므로 커스텀 코드가 필요하면 전자 선호. `net/http` import 추가.

## 에러 처리 검토

- `pgx.ErrNoRows` 외 삼킴 없음 — `clue_relation_service.go:32-34`, `service_config.go:35-37` 모두 zerolog Error + apperror.Internal로 surface.
- Optimistic lock repo 호출 순서: `getOwnedTheme`(read version) → `UpdateThemeConfigJson(version=...)` → 실패 시 `GetTheme` 재조회 — 정합적.
- handler.go 5xx Sentry capture + Internal nil 체크 — 기존 패턴 유지.
- `WithExtensions` deep-copy로 goroutine 안전 ✓.

## SOLID / DRY

- **SRP**: service_config.go가 "config JSON + optimistic lock + 409 extensions" 책임 한정. service.go와 책임 경계 명확. 주석(line 485-487)이 분리 의도를 설명. ✓
- **OCP**: apperror `WithExtensions` 체이너 추가로 기존 API 무변경, 새 필드만 노출. ✓
- **DRY**: `buildConfigVersionConflict`가 재사용 가능한 helper로 추출 — 향후 다른 optimistic lock 지점에서도 재활용 가능한 구조.
- apperror extensions 패턴이 기존 `WithParams`/`WithErrors`와 완전 일치 (copy-on-write + deep copy + len guard). 

## 로깅

- zerolog 일관 사용 ✓
- stdout `fmt.Println`/`log.Printf` 없음 ✓
- service_config.go:51-55의 Warn 로그에 `theme_id` 컨텍스트 포함 — 좋음.

## DI 정합 (main.go)

```go
templateLoader := template.NewLoader()
templateHandler := server.NewTemplateHandler(templateLoader)
```
기존 handler 생성 패턴과 동일. Public routes 그룹 내 `/themes` 옆에 배치 — 자연스러운 논리 그룹. ✓

## 컴파일

`go build ./...` PASS (worktree `apps/server/`에서 exit 0).

## 회귀

- editor 도메인의 handler 파일(Handler, NewHandler, chiContext, mockService, testThemeID, withAuth 헬퍼)는 clue_relation_handler_test.go에서 재사용됨 — 기존 테스트 파일 규약 유지.
- apperror 기존 생성자(BadRequest/NotFound/Conflict 등) 시그니처 무변경.
- AppError 구조체에 Extensions 필드 추가는 JSON `omitempty`이므로 기존 응답 스키마 하위 호환.

## 긍정 관찰

- PR-2 주석 품질이 높음 — apperror.go:8-13의 Extensions 주석이 RFC 9457 의도를 정확히 기술.
- `buildConfigVersionConflict`가 "재조회 실패 시 fallback + Warn, 절대 500 아님" 정책을 주석으로 명시 — 운영 시 디버깅 친화.
- service_config.go 분리 + 신규 파일 top에 "왜 분리했는지" 주석 — file-size 한도를 단순 회피가 아닌 의도적 리팩터링으로 수행.
- `TestGetClueRelations_Empty`가 `got == nil` 분기까지 검증 — JSON `null` vs `[]` 회귀 방어.

## 권고

**APPROVE (조건부)**: MED-1 (schema 핸들러 스모크 추가)은 W0 내 PR-3 또는 후속 follow-up commit으로 반영 권장. MED-2는 테스트 결정성 개선 (flaky risk). LOW 3건은 백로그.

