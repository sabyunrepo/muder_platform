---
run_id: r-20260415-205940-f535
wave: W0
pr: PR-2
task: clue-relations empty + config 409 current_version
status: completed
tasks_done: 4/4
tests_passed: partial
files_changed:
  - apps/server/internal/apperror/apperror.go
  - apps/server/internal/apperror/codes.go
  - apps/server/internal/apperror/handler.go
  - apps/server/internal/domain/editor/clue_relation_service.go
  - apps/server/internal/domain/editor/clue_relation_handler_test.go
  - apps/server/internal/domain/editor/service.go
  - apps/server/internal/domain/editor/service_config.go
  - apps/server/internal/domain/editor/service_config_test.go
---

# PR-2 Summary

## 변경
- `clue_relation_service.go`: `pgx.ErrNoRows`/empty → 빈 배열 반환 (500 → 200)
- `apperror.go` + `codes.go`: AppError extensions 필드 + `ErrEditorConfigVersionMismatch` 코드 추가
- `apperror/handler.go`: RFC 9457 Problem Details extensions 직렬화
- `service.go` / `service_config.go`: UpdateThemeConfigJson 409 응답에 `current_version` 동봉 (optimistic lock 충돌 시 현재 버전 조회 후 extensions로 전달). service.go 500줄 초과 방지 위해 `service_config.go` 분리.
- 테스트: `service_config_test.go` (version mismatch → extensions 확인), `clue_relation_handler_test.go` (빈 결과 200)

## Scope 확장 메모
- 원래 scope는 `internal/domain/editor/**`. AppError extensions 지원은 공통 구조체(internal/apperror/*) 변경이 불가피 → 3개 파일 추가.
- 하위 호환: extensions 는 optional, 기존 클라이언트 무시.

## 테스트
- `go build ./...` ✓
- `go test -race ./internal/apperror/...` ✓
- `go test -race ./internal/domain/editor/...` — testcontainers 기반 테스트가 Docker 미구동 환경에서 FAIL. 코드는 기존 testcontainers 패턴 준수. CI Docker 환경에서 재검증 필요.

## 위험
- 409 extensions 스키마가 프론트 PR-4와 계약. PR-4에서 `current_version` 소비 구현.
