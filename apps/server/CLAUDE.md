# apps/server — Go 백엔드 룰

> Go 1.25 + gorilla/websocket + sqlc + pgx + asynq + go-redis. PostgreSQL + Redis. zerolog.

## 계층

- Handler → Service(인터페이스) → Repository/Provider(구현)
- DI: 생성자 주입 (수동, 프레임워크 없음)
- 에러: `AppError` + RFC 9457 Problem Details + 에러 코드 레지스트리
- 로깅: `zerolog` 만 사용 (`log.Println` / `fmt.Println` 금지)

## 모듈 시스템 (PlayerAware 의무 — 2026-04-18 PR-2a)

모든 `engine.Module`은 둘 중 하나 충족:
1. `PlayerAwareModule.BuildStateFor(playerID)` 구현
2. `engine.PublicStateMarker` 임베드 → `PublicStateModule` 명시적 opt-out

registry boot 시점 panic으로 강제 (F-sec-2 게이트). 상세 패턴: `memory/project_module_system.md`.

## 테스트

- `mockgen` (go.uber.org/mock v0.6.0, Go 1.24 tool directive) + `testcontainers-go`
- 75%+ 커버리지 목표 (현재 enforcement gate 41%)
- 위치: `apps/server/internal/<pkg>/*_test.go`

## 파일 크기 (티어)

- 파일 하드 리밋 **500줄** (자동생성 sqlc/gen 예외)
- 함수 권장 **80줄** (table-driven 데이터 제외)
- 초과 예상 시 분할 설계 — handler 분리 / service 인터페이스 쪼개기 / 모듈은 core+schema+factory+reactor

## WS 인증

- WebSocket 토큰은 **`?token=` 쿼리 파라미터** (Authorization 헤더 ❌)
- 상세: `memory/feedback_ws_token_query.md`

## 보안

- AppError + RFC 9457 + 감사 로그(`auditlog`)
- 입력 검증: 핸들러 진입 시점 (handler layer)
- 비밀정보 redact: voice token, password, OAuth secret
- 코드 리뷰 패턴: `memory/feedback_code_review_patterns.md`
