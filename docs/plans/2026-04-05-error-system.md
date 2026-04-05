# Error Handling System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 백엔드(Go) + 프론트엔드(React) 전체 에러 처리 체계를 프로덕션 수준으로 구축

**Architecture:** AppError 확장(Wrap/Unwrap/Params) → 환경별 응답 분기 → WrapHandler → 프론트 ErrorBoundary 3계층 + sonner 토스트 + TanStack Query 통합 → Sentry/OTel 관측성

**Tech Stack:** Go 1.25 + zerolog + chi | React 19 + Zustand 5 + sonner + react-error-boundary + @tanstack/react-query | sentry-go + @sentry/react + OpenTelemetry

---

## Phase A: 백엔드 에러 인프라 보강

### Task A1: AppError 구조체 확장

**Files:**
- Modify: `apps/server/internal/apperror/apperror.go`
- Test: `apps/server/internal/apperror/apperror_test.go` (Create)

**변경사항:**
1. `Internal error` 필드 추가 (json:"-") — 원본 에러 보존, 직렬화 제외
2. `Params map[string]any` 필드 추가 — 프론트 i18n용 동적 파라미터
3. `Errors []FieldError` 필드 추가 — 유효성 검증 필드 에러 목록
4. `Unwrap() error` 메서드 — errors.Is/As 체인 지원
5. `Wrap(err error) *AppError` 메서드 — 원본 에러 래핑
6. `WithParams(params)` 메서드 — i18n 파라미터 첨부
7. `WithErrors(errs)` 메서드 — 필드 에러 첨부
8. `Validation(detail, errs)` 편의 함수 — 422 에러 생성

**기존 코드 호환:** New(), NotFound(), BadRequest() 등 기존 함수 시그니처 변경 없음.

### Task A2: problemResponse 확장 + 환경별 분기

**Files:**
- Modify: `apps/server/internal/apperror/handler.go`
- Modify: `apps/server/internal/apperror/handler_test.go`

**변경사항:**
1. `problemResponse`에 `Params`, `Errors`, `TraceID` 필드 추가
2. `WriteError`에서 `appErr.Internal` 있으면 원본 에러 로깅
3. 환경별 분기: dev → detail 그대로 + debug info, prod → 5xx detail 일반화
4. `SetDevMode(bool)` 패키지 변수로 환경 제어 (main.go에서 초기화)

### Task A3: WrapHandler 패턴

**Files:**
- Create: `apps/server/internal/httputil/handler.go`
- Create: `apps/server/internal/httputil/handler_test.go`

**변경사항:**
1. `type HandlerFunc func(w, r) error` 타입 정의
2. `WrapHandler(HandlerFunc) http.HandlerFunc` — error 반환 시 WriteError 자동 호출
3. 기존 핸들러와 공존 가능 (라우터 등록부에서 선택적 사용)

### Task A4: FieldError 타입 + Validation 헬퍼

**Files:**
- Create: `apps/server/internal/apperror/field_error.go`

**변경사항:**
1. `FieldError` 구조체 (Field, Message, Code)
2. `FieldErrors` 빌더 패턴 (Add, Build)

---

## Phase B: 프론트엔드 에러 인프라 구축

### Task B1: 패키지 설치 + ApiHttpError 클래스

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/api-error.ts`
- Modify: `apps/web/src/services/api.ts`
- Modify: `packages/shared/src/api/types.ts` (ApiError에 params, trace_id 추가)

**패키지:** react-error-boundary, sonner, @tanstack/react-query

**변경사항:**
1. `ApiHttpError extends Error` 클래스 — ApiError를 감싸는 throw 가능한 에러
2. `isApiError()` 타입 가드
3. `api.ts`의 rawFetch에서 `throw new ApiHttpError(error)` 패턴으로 변경

### Task B2: 에러 코드→메시지 매퍼

**Files:**
- Create: `apps/web/src/lib/error-messages.ts`

**변경사항:**
1. `ERROR_MESSAGES: Record<string, string>` — 에러 코드별 한국어 메시지
2. `getUserMessage(error: ApiError): string` — 코드 기반 메시지 변환
3. dev 환경에서는 detail 포함, prod에서는 사용자 메시지만

### Task B3: ErrorBoundary 3계층

**Files:**
- Create: `apps/web/src/components/error/GlobalErrorBoundary.tsx`
- Create: `apps/web/src/components/error/PageErrorBoundary.tsx`
- Create: `apps/web/src/components/error/ComponentErrorBoundary.tsx`
- Create: `apps/web/src/components/error/index.ts`
- Modify: `apps/web/src/App.tsx`

**변경사항:**
1. GlobalErrorBoundary — 전체 앱 크래시 시 풀스크린 폴백
2. PageErrorBoundary — 라우트별 에러 복구 (재시도 버튼)
3. ComponentErrorBoundary — 부분 실패 허용 (작은 fallback)
4. App.tsx에 GlobalErrorBoundary 래핑

### Task B4: Zustand UI Store + sonner 토스트

**Files:**
- Create: `apps/web/src/stores/ui-store.ts`
- Create: `apps/web/src/components/ToastProvider.tsx`
- Modify: `apps/web/src/App.tsx`

**변경사항:**
1. `useUIStore` — showApiError(error) 메서드
2. sonner `<Toaster />` 통합
3. 심각도별 토스트 지속 시간 (4xx: 5초, 5xx: 수동닫기)
4. trace_id 참조 표시

### Task B5: 글로벌 에러 핸들링 + API 클라이언트 개선

**Files:**
- Create: `apps/web/src/lib/global-error-handler.ts`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/services/api.ts`

**변경사항:**
1. `unhandledrejection`, `window.onerror` → 토스트 + 콘솔
2. 401 자동 리다이렉트 (/login)
3. 네트워크 에러 vs HTTP 에러 구분

---

## Phase C: 관측성 (Sentry + OTel 기초)

### Task C1: sentry-go 백엔드 연동

**Files:**
- Modify: `apps/server/go.mod`
- Create: `apps/server/internal/infra/sentry/sentry.go`
- Modify: `apps/server/cmd/server/main.go`
- Modify: `apps/server/internal/apperror/handler.go`

**변경사항:**
1. `sentry.Init()` in main.go
2. `sentry.CaptureException()` for 5xx in WriteError
3. Sentry middleware (flush on request end)

### Task C2: @sentry/react 프론트엔드 연동

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/components/error/GlobalErrorBoundary.tsx`

**변경사항:**
1. `Sentry.init()` in main.tsx
2. React 19 `onCaughtError` / `onUncaughtError` hook
3. GlobalErrorBoundary에서 `Sentry.captureException()`

### Task C3: OTel zerolog Hook + trace_id 응답 포함

**Files:**
- Modify: `apps/server/go.mod`
- Create: `apps/server/internal/infra/otel/otel.go`
- Create: `apps/server/internal/infra/otel/log_hook.go`
- Modify: `apps/server/cmd/server/main.go`
- Modify: `apps/server/internal/apperror/handler.go`

**변경사항:**
1. OTel TracerProvider + OTLP exporter 초기화
2. zerolog Hook으로 trace_id/span_id 자동 삽입
3. WriteError에서 에러 응답에 trace_id 포함
4. Sentry에 trace_id 태그 연결
