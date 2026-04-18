---
name: MMP v3 에러 처리 체계
description: Phase A/B/C 에러 인프라 — AppError 확장, ErrorBoundary, Sentry, OTel (2026-04-05)
type: project
---

## 에러 처리 체계 (2026-04-05 구현 완료)

### Phase A: 백엔드 에러 인프라

**AppError 확장** (`apperror/apperror.go`):
- `Internal error` (json:"-") + `Unwrap()` — errors.Is/As 체인 지원
- `Wrap(err)` — 원본 에러 보존, 로그에만 출력
- `Params map[string]any` — 프론트 i18n용 동적 파라미터 (`WithParams`)
- `Errors []FieldError` — 유효성 검증 필드 에러 (`WithErrors`)
- `Validation()`, `Conflict()`, `Timeout()` 편의 생성자
- 모든 With* 메서드는 deep copy (map/slice 포함)

**WriteError 확장** (`apperror/handler.go`):
- `atomic.Bool` devMode — 환경별 응답 분기
- prod: 5xx detail → "an unexpected error occurred" 마스킹
- dev: debug info (Internal 에러 메시지) 포함
- Sentry: 5xx 에러 자동 캡처
- OTel: trace_id 응답에 포함

**WrapHandler** (`httputil/handler.go`):
- `func(w, r) error` 시그니처 → 자동 WriteError
- `statusWriter`로 이미 Write된 응답 감지

### Phase B: 프론트엔드 에러 인프라

**에러 타입**: `ApiHttpError extends Error` (Object.setPrototypeOf 안전)
**에러 매퍼**: 22개 에러 코드 → 한국어 메시지 + `{key}` params 치환
**ErrorBoundary 3계층**: Global(앱 크래시) → Page(라우트) → Component(부분 실패)
**토스트**: sonner — 4xx: 5초, 5xx: 수동닫기 + trace ref, 401: 리다이렉트 (루프 방지)
**글로벌 핸들러**: unhandledrejection + chunk loading 실패 감지, prod에서 raw 메시지 미노출
**API 클라이언트**: 네트워크 에러 분리 (status=0, NETWORK_ERROR), 조건부 Content-Type

### Phase C: 관측성

**Sentry**: sentry-go + @sentry/react, DSN 없으면 no-op
- 백엔드: BeforeSend로 Authorization/Cookie 필터
- 프론트: replay PII 마스킹 (maskAllText + maskAllInputs + blockAllMedia)
- 5xx만 캡처, trace_id 태그 연결

**OpenTelemetry**: TracerProvider + OTLP HTTP exporter
- 조건부 TLS (dev만 insecure), 10% 샘플링
- zerolog Hook으로 trace_id/span_id 자동 주입
- Endpoint 없으면 no-op

### 에러 추적 흐름
```
Browser → X-Request-ID → Sentry middleware → Recovery → Service(Wrap)
  → WriteError: log(Internal) + Sentry(5xx) + RFC 9457(trace_id)
  → Frontend: ApiHttpError → showErrorToast → 한국어 + trace ref
  → Sentry: trace_id 태그로 BE↔FE 연결
```

**Why:** Phase 6까지 기본 에러 처리만 있었고, 에러 원인 추적/프로덕션 마스킹/관측성이 부재
**How to apply:** 새 도메인 추가 시 AppError.Wrap(err) 패턴 사용, 새 에러 코드는 codes.go + error-messages.ts 동기화
