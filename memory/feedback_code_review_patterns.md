---
name: 코드 리뷰 패턴 통합
description: Phase 0~E 전체 코드 리뷰에서 추출된 재사용 가능한 패턴 — Go/React/DB/보안/PWA/오디오
type: feedback
---

Phase 0~7.6 + A/B/C/E 코드 리뷰에서 추출된 핵심 패턴 (2026-04-06 통합)

## Go 백엔드

- `atomic.Bool` 필수: 패키지 레벨 bool 변수는 테스트 병렬 실행 시 race condition
- deep copy: `WithParams()`, `WithErrors()` 등 빌더 메서드는 슬라이스/맵 깊은 복사
- unlock-before-publish: mutex 해제 후 EventBus.Publish() — 구독자 재진입 데드락 방지
- 트랜잭션 원자성: 다단계 금융 연산은 `pool.BeginTx()` 단일 트랜잭션
- TOCTOU: 상태 확인→변경 패턴에 `SELECT FOR UPDATE` row lock
- `:exec` 쿼리 0건=nil: 삭제 전 `GetX()` 존재 확인 필수
- 중복 서브쿼리(3+) → LATERAL JOIN 또는 window function
- soft delete: 모든 쿼리에 `WHERE deleted_at IS NULL`
- 에러 응답: Service 레이어에서 `err.Error()` HTTP 응답 금지, zerolog 로그 + 일반 메시지
- 외부 입력 ID: `uuid.Parse()` 검증 필수
- Mock provider: isDev 가드 필수 (프로덕션 우회 방지)

## React 프론트엔드

- Zustand: 렌더 바디에서 `getState()` 금지 → selector 사용
- 고빈도 setState: 이전 값 비교 후 업데이트 (참조 스래싱 방지)
- useEffect 비동기 cleanup: `let stale = false` 패턴
- useRef + useState 병행: 외부 인스턴스를 훅에 전달 시 useState로 null 체크
- Custom Error: `Object.setPrototypeOf(this, X.prototype)` 필수
- 에러 메시지: 한국어 폴백 (getUserMessage 로캘 일치)
- 401 루프 방지: `pathname.startsWith("/login")` 체크 후 리다이렉트
- **React 19 concurrent**: render body에서 `ref.current = x` 금지 — speculative render replay 시 race window. `useEffect` 또는 `useLayoutEffect` sync 사용 (PR #184 round-3 N-2)
- **Editor 패널 debounce**: `useRef + setTimeout` 보일러플레이트 직접 작성 금지 → `apps/web/src/hooks/useDebouncedMutation.ts` 사용 (Phase 21 E-1, PR #184)
- **React Query optimistic + debounce 합성**: applyOptimistic은 flush 시점에만 호출 (`feedback_optimistic_apply_timing.md`). 두 layer 패턴 사용 시 rollback snapshot은 `pendingSnapshotRef`로 첫 schedule 시점에 캡처 (`feedback_optimistic_rollback_snapshot.md`)
- **컴포넌트 분리 시 DOM 순서 보존 검증**: sub-component 추출 PR은 부모 JSX의 *원본 render 순서*가 분리 후에도 동일하게 유지되는지 명시 검증 — 논리적 종속(예: warning timer가 autoAdvance에 종속) 기준으로만 묶지 말고 시각/UX 순서를 1차 기준으로. 4-agent arch reviewer 프롬프트에 "원본 vs 분리 후 JSX render 순서 1:1 비교" 항목 포함 (PR #191 PhasePanelAdvanceToggle warning timer 위치 회귀 사례, MISTAKES 등재)

## FE-BE 계약 (런타임 에러 40% 원인)

- 새 엔드포인트: BE JSON 태그와 FE 타입 동시 작성, 커밋 전 교차 검증
- 필드명: `"data"` vs 도메인명 — BE 응답 grep으로 확인
- HTTP 메서드: PATCH/POST 일치 검증
- Optional vs Required: FE optional이 BE required면 zero-value 덮어쓰기
- 라우트 등록: 핸들러 작성 후 router/mux 등록 확인

## 데이터베이스/스키마

- sqlc generate 후 `go build ./...` 필수 (시그니처 변경 감지)
- `SELECT *` 금지 → 명시적 컬럼 나열 (스키마 드리프트 방지)
- 금융 데이터: `int64` 정수 연산 (float 반올림 오차 방지)
- 정산 완료 데이터: hard delete 금지 → settled 플래그 확인

## 오디오/미디어

- GainNode: onended에서 disconnect() 필수 (장시간 세션 누수)
- master GainNode 패턴: 실시간 볼륨 반영
- iOS Safari: unlock 리스너에 `{ once: true }` 금지 + visibilitychange 추가
- ctx.state === "suspended" 체크 후 resume() (탭 전환 대응)
- soundId 화이트리스트 검증 + fetch res.ok + MAX_SOUND_BYTES 크기 제한
- bufferCache: LRU eviction (MAX_CACHE_SIZE)

## PWA/성능

- Workbox urlPattern: 함수형 `({url}) => url.pathname.startsWith(...)` (regex는 url.href 매칭)
- CacheFirst: `cacheableResponse: { statuses: [0, 200] }` 필수 (404 영구 캐시 방지)
- 오프라인 폴백 페이지: eager import (lazy chunk 로드 실패)
- CSS 애니메이션: `motion-safe:` prefix 필수 (WCAG 2.3.3)
- width/height 애니메이션 금지 → `transform: scaleX/scaleY` (GPU 가속)
- duration 하드코딩 금지 → 토큰 변수 (`--duration-*`)

## 보안

- HTTP body: `MaxBytesReader(1MB)` (OOM DoS 방지)
- crypto/rand: rejection sampling (`% len(charset)` 바이어스)
- Sentry BeforeSend: Authorization/Cookie 삭제
- Sentry Replay: `maskAllInputs + blockAllMedia`
- OTel: 프로덕션에서 WithInsecure() 금지

## 프로세스

- 에이전트 팀 idle ≠ 완료: SendMessage로 확인 요청
- 병렬 에이전트: 같은 파일 금지 → 파일별 단일 에이전트 할당
- 6전문가 합의: 보안/성능/UX 교차 검증에 효과적
