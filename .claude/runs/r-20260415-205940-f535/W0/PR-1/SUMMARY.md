---
run_id: r-20260415-205940-f535
wave: W0
pr: PR-1
task: Backend route fixes (templates GET, flow PATCH 정리)
status: completed
tasks_done: 4/4
tests_passed: true
files_changed:
  - apps/server/cmd/server/main.go
  - apps/server/internal/server/template_handler_test.go
---

# PR-1 Summary

## 변경
- `/api/v1/templates` 라우트 그룹 등록 (GET list / GET by id / GET schema)
- `template.NewLoader()` + `server.NewTemplateHandler()` DI 연결
- `template_handler_test.go` 신규 — httptest 기반 3 핸들러 스모크 테스트

## flow PATCH 정리
- 기존 PATCH 라우트 유지 (L473). PUT 추가하지 않음 (프론트에서 PATCH로 전환 예정, 결정 #1).

## 테스트
- `go build ./...` ✓
- `go test -race ./internal/server/...` ✓ (cached ok)

## 위치 주의
- 핸들러 실제 경로는 `apps/server/internal/server/` (scope 문서의 `internal/domain/server/`는 오타).
