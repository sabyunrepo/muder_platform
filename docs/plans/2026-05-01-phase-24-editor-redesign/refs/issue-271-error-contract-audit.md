# Issue #271 — MMP Error Contract v1 감사

## 목표

Phase 24 이후 에디터/런타임 API가 늘어나는 상황에서 프론트와 백엔드가 같은 에러 계약을 보도록 정리한다. 이번 문서는 바로 구현을 바꾸기 전, 현재 코드와 표준 사이의 차이를 확인하고 PR-2 이후 구현 범위를 자르는 감사 결과다.

## 외부 기준

- RFC 9457 Problem Details for HTTP APIs
  - `application/problem+json` 응답과 `type`, `title`, `status`, `detail`, `instance` 표준 필드를 기준으로 한다.
  - API별 추가 정보는 확장 멤버로 제공할 수 있어야 한다.
  - `detail`은 내부 스택/DB 오류가 아니라 클라이언트가 문제를 해결하는 데 도움이 되는 설명이어야 한다.
- Google AIP-193 Errors
  - 기계가 읽는 식별자와 사람용 메시지를 분리한다.
  - 동적 정보는 메시지 문자열 파싱이 아니라 구조화된 metadata/detail로 전달한다.
  - 오류 메시지는 짧고 실행 가능한 안내여야 하며, 권한/존재 여부 같은 민감 정보 노출 정책을 분명히 한다.

## 현재 코드 감사

### 백엔드 HTTP 에러

대상 파일:

- `apps/server/internal/apperror/apperror.go`
- `apps/server/internal/apperror/handler.go`
- `apps/server/internal/apperror/codes.go`
- `apps/server/internal/httputil/handler.go`
- `apps/server/internal/middleware/requestid.go`
- `apps/server/api/openapi.yaml`

확인 결과:

- `AppError`는 이미 RFC 9457 계열 필드(`type`, `title`, `status`, `detail`, `instance`)와 MMP 확장 필드(`code`, `params`, `errors`, `extensions`)를 가진다.
- `WriteError`는 `Content-Type: application/problem+json`을 내려주고, production 5xx `detail`을 raw 내부 메시지로 노출하지 않도록 마스킹한다.
- `Internal` 원인은 `json:"-"`로 숨기고 Sentry/logging에만 보낸다.
- `trace_id`는 OpenTelemetry span이 유효할 때만 응답 body에 포함된다.
- `RequestID` 미들웨어는 `X-Request-ID`를 생성/반환하지만 `WriteError` body에는 `request_id` 또는 `correlation_id`로 포함되지 않는다.
- `codes.go`는 const 목록만 있고 domain/severity/retryable/user_action/default message 같은 registry metadata는 없다.
- OpenAPI `ProblemDetail` schema는 기본 필드와 `code`만 문서화되어 있고 `params`, `errors`, `extensions`, `trace_id`, 향후 `severity`, `retryable`, `user_action`, `request_id`가 빠져 있다.
- OpenAPI 공통 오류 response content type이 `application/json`으로 되어 있어 실제 `application/problem+json`과 어긋난다.

### 프론트 HTTP 에러

대상 파일:

- `packages/shared/src/api/types.ts`
- `apps/web/src/services/api.ts`
- `apps/web/src/lib/api-error.ts`
- `apps/web/src/lib/error-messages.ts`
- `apps/web/src/lib/show-error-toast.ts`
- `apps/web/src/components/error/*`

확인 결과:

- shared `ApiError`는 RFC 9457 계열 타입과 `code`, `params`, `errors`, `trace_id`, `debug`를 가진다.
- API client는 실패 응답 body가 `ApiError` shape이면 `ApiHttpError`로 던진다.
- 네트워크 실패는 프론트 자체 `NETWORK_ERROR`로 감싼다.
- `showErrorToast`는 401 redirect, 4xx 5초 toast, 5xx 무한 toast + Sentry 캡처를 한다.
- `error-messages.ts`는 코드별 한국어 메시지를 직접 관리하지만 백엔드 `codes.go`와 동기화 검증이 없다.
- `ApiError` 타입에는 `extensions`가 없어 백엔드 `WithExtensions` 응답을 타입 차원에서 잃는다.
- `severity`, `retryable`, `user_action`, `request_id` 기반 복구 전략은 아직 없다.
- 일부 feature code는 `status === 409`, `code === MEDIA_REFERENCE_IN_USE` 같은 개별 분기를 직접 가진다. 이것 자체는 문제는 아니지만 중앙 recovery map 없이 늘어나면 사용자 메시지와 복구 UX가 분산된다.

### WebSocket 에러

대상 파일:

- `apps/server/internal/ws/message.go`
- `apps/server/internal/ws/reading_handler.go`
- `apps/server/internal/ws/envelope_registry.go`

확인 결과:

- WS error envelope는 `{ type: "error", payload: { code: number, message: string } }` 형태다.
- reading handler는 `apperror.AppError`를 WS numeric code와 string code가 섞인 message로 변환한다.
- HTTP ProblemDetail과 WS error envelope는 같은 wire shape를 쓰지 않는다. 이는 괜찮지만, WS payload 안에도 `app_code`, `user_message`, `retryable`, `request_id` 같은 최소 계약을 둘지 결정이 필요하다.

## 갭과 영향

### 1. Backend `extensions` 주석과 실제 wire shape 불일치

`WithExtensions` 주석은 RFC 9457 extension members가 top-level에 노출된다고 설명하지만, 실제 `problemResponse`는 `extensions`라는 nested object로 내려준다.

영향:

- 프론트/문서가 top-level 확장 멤버를 기대하면 런타임에서 값을 못 읽는다.
- 반대로 지금 wire shape를 이미 쓰고 있다면 top-level로 바꾸는 것은 breaking change가 될 수 있다.

권장:

- MMP v1에서는 `extensions` nested object를 유지하고 문서/주석을 실제 wire shape에 맞춘다.
- RFC 9457 extension member로 top-level을 꼭 써야 하는 경우는 v2 migration으로 분리한다.

### 2. Correlation ID 이름과 위치 불일치

현재 서버는 `X-Request-ID` header를 제공하고, OTel span이 있으면 body에 `trace_id`를 넣는다. 프론트는 `trace_id`만 표시한다.

영향:

- OTel span이 없는 일반 요청 실패에서는 사용자가 전달할 짧은 오류 ID가 없다.
- 운영자는 `X-Request-ID`, `trace_id`, Sentry event를 연결해 찾아야 해서 디버깅 흐름이 흔들린다.

권장:

- HTTP body에는 `request_id`를 추가한다.
- `trace_id`는 관측성용으로 유지한다.
- 프론트 오류 UI는 `request_id ?? trace_id`의 앞 8자를 표시한다.

### 3. Error code registry 부재

현재 error code는 const 문자열 목록이고, 프론트 메시지는 별도 TS map이다.

영향:

- 백엔드에 새 코드가 추가되어도 프론트 메시지가 빠지는 것을 자동으로 잡기 어렵다.
- 사용자에게 표시할 메시지, 복구 버튼, 재시도 가능 여부가 기능별로 흩어진다.

권장:

- PR-2에서 백엔드 `ErrorDefinition` registry를 추가한다.
- PR-3에서 프론트 `recoveryMap`을 추가하되, 초기에는 registry code subset을 수동 mirror하고 테스트로 누락을 잡는다.
- generated shared source는 지금은 과하다. OpenAPI/코드 생성 정리 시점에 별도 검토한다.

### 4. OpenAPI와 실제 응답 불일치

OpenAPI 공통 오류 response는 `application/json`이며 `ProblemDetail` schema도 실제 확장 필드를 모두 담지 않는다.

영향:

- API 문서와 클라이언트 타입 생성 결과가 실제 응답과 달라질 수 있다.
- CodeRabbit/자동검증보다 운영 중 프론트에서 먼저 깨질 가능성이 있다.

권장:

- PR-2에서 OpenAPI 오류 content type을 `application/problem+json`으로 정리한다.
- `ProblemDetail`에 MMP extension field를 문서화한다.

### 5. WS 에러는 HTTP ProblemDetail과 동일화하지 말고 매핑 계약만 둔다

WS는 실시간 게임 메시지라 HTTP shape를 그대로 넣으면 payload가 무거워지고 기존 클라이언트와 충돌한다.

영향:

- 단기적으로는 기존 numeric code 호환성을 유지해야 한다.
- 다만 message 문자열에 app code를 섞는 방식은 장기적으로 안전하지 않다.

권장:

- PR-4 이후 WS payload를 확장 가능한 형태로 바꾼다.
- 예: `{ code: 4004, app_code: "READING_SECTION_NOT_FOUND", message: "...", request_id: "...", retryable: false }`.

## PR 분해

### PR-1: 감사 문서화

현재 PR 범위. 코드 변경 없이 감사 문서와 이슈 진행 기록만 남긴다.

완료 조건:

- 현재 HTTP/FE/WS 에러 shape와 표준 대비 갭이 문서화된다.
- PR-2 이후 구현 범위가 명확해진다.

### PR-2: Backend Error Registry + ProblemDetail 정합성

범위:

- `ErrorDefinition` registry 추가
- `AppError`/`WriteError`가 registry metadata를 참조하도록 확장
- `request_id`, `severity`, `retryable`, `user_action` 응답 필드 추가
- `extensions` 주석/문서 정합성 수정
- OpenAPI `application/problem+json` 및 schema 갱신
- handler unit test 추가

완료 조건:

- production 5xx masking 유지
- 기존 `code/status/detail` 클라이언트 호환성 유지
- request id가 header와 body에 모두 존재

### PR-3: Frontend Recovery Strategy

범위:

- shared `ApiError` 타입에 `extensions`, `request_id`, `severity`, `retryable`, `user_action` 추가
- `showErrorToast`를 severity/user_action 기반으로 확장
- auth/editor/media 주요 code recovery map 추가
- 사용자에게 내부 detail 대신 해결 행동을 보여준다
- Vitest 추가

완료 조건:

- code별 한국어 메시지 누락을 테스트로 잡는다.
- 5xx는 request/trace short id를 표시한다.
- editor/media 충돌 UX가 중앙 정책과 충돌하지 않는다.

### PR-4: Editor/Media/Session 우선 적용 + WS 경계

범위:

- editor config conflict, media reference-in-use, upload error UX 우선 적용
- session/phase runtime error 우선 적용
- WS error payload 확장 방향 확정 및 호환 테스트

완료 조건:

- 제작자는 “무엇이 문제이고 어떻게 해결할지”를 볼 수 있다.
- 내부 구현 detail, DB/stack/raw JSON은 production UI에 노출되지 않는다.

## 즉시 구현하지 않는 것

- `{Domain}-{Severity}-{Layer}-{Sequence}` 코드 체계 이식
- top-level RFC extension member로 wire shape 변경
- Sentry/OTel 전면 재설계
- Python/Temporal/ErrorPrism 계층 도입
