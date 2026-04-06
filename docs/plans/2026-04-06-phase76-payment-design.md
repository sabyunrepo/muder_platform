# Phase 7.6: 결제 + 수익/통계 — 설계 문서

> 승인일: 2026-04-06 | 보안 리뷰 반영: 2026-04-06

## 요구사항 요약

| 항목 | 결정 |
|------|------|
| PG 연동 | Provider 인터페이스 + Mock (실제 PG 나중) |
| 코인 모델 | 하이브리드 (잔액 컬럼 + 이력 테이블) |
| 보너스 코인 | base/bonus 분리 저장, 보너스 먼저 소진 |
| 패키지 | DB 테이블 관리 (이벤트 보너스 대응) |
| 웹/모바일 | 플랫폼별 패키지 구분 (가격·보너스 차등) |
| 테마 가격 | 제작자 자유 설정 (100 ~ 100,000코인) |
| 환불 | 구매 후 7일 이내 + 미플레이 시에만 가능 |
| 정산 주기 | 매주 월요일, 7일 유예 경과 건만 |
| 최소 정산 | 10,000원 미달 시 이월 |
| 수익 분배 | 제작자 70% / 플랫폼 30% |
| 세금 | 개인 3.3%, 사업자 10% |
| 통계 범위 | 제작자 대시보드 + Admin 관리 + 플레이어 이력 |

### 코인 패키지

| | 웹 | 모바일 |
|---|---|---|
| 5,000원 / 5,500원 | 400코인 | 400코인 |
| 10,000원 / 11,000원 | 800 + 40보너스 = 840 | 800코인 |
| 30,000원 / 33,000원 | 2,400 + 250보너스 = 2,650 | 2,400 + 50보너스 = 2,450 |

기본 환율: 1코인 ≈ 12.5원 (5,000원 = 400코인 기준)

---

## 아키텍처: 3 도메인 + 디자인 패턴

### 도메인 분리

```
domain/payment/     ← Strategy + Factory (PG Provider 교체)
domain/coin/        ← Repository + Observer (코인 경제)
domain/creator/     ← Template Method + Observer (수익·정산·통계)
```

### 패턴 매핑

| 패턴 | 적용 위치 | 효과 |
|------|----------|------|
| Strategy | PaymentProvider | PG사 교체 (Mock→Toss→Stripe) |
| Factory | Provider 생성 | 설정 기반 자동 선택 |
| Observer | 도메인 간 이벤트 | 결합도 제거, 도메인 독립 추가/제거 |
| Repository | CoinRepository | 데이터 접근 추상화, 테스트 용이 |
| Template Method | 정산 파이프라인 | 고정 흐름 + 세부 단계 교체 |
| State Machine | 결제/정산 상태 | 상태 전이 검증 |

### Provider 인터페이스

```go
type PaymentProvider interface {
    CreatePayment(ctx context.Context, req CreatePaymentRequest) (*PaymentResult, error)
    ConfirmPayment(ctx context.Context, paymentKey string) (*PaymentResult, error)
    RefundPayment(ctx context.Context, paymentKey string, reason string) error
    // 보안: headers 포함 — HMAC-SHA256 서명 검증 필수
    HandleWebhook(ctx context.Context, headers http.Header, body []byte) (*WebhookEvent, error)
}
```

### 보안 원칙

**[S1] 서버 사이드 금액 결정**: `POST /payments/create`는 `package_id`만 수신.
금액/코인은 서버가 `coin_packages` 테이블에서 조회. 클라이언트가 보낸 금액은 절대 신뢰하지 않음.

**[S2] 웹훅 서명 검증**: `HandleWebhook`은 `http.Header`에서 HMAC-SHA256 서명 검증 후 파싱.
서명 불일치 시 401 반환. 타임스탬프 5분 초과 시 거부 (리플레이 방지).
웹훅 엔드포인트는 JWT 미들웨어 제외, PG 서명으로 인증.

**[S3] 자전 거래 방지**: `creator_id == user_id`인 테마 구매 차단.
서비스 레이어 + creator_earnings 생성 시 이중 검증.

**[S4] 환불 조건 3중 검증**:
1. 7일 이내 (`refundable_until > NOW()`, 서버 TIMESTAMPTZ 기준)
2. 미플레이 (`session_players`에 해당 theme의 game_session 참여 기록 없음)
3. 미환불 (`status = 'COMPLETED'`)
→ 하나라도 실패 시 환불 거부

**[S5] DB 레벨 무결성 가드레일**:
- `CHECK (coin_balance_base >= 0)`, `CHECK (coin_balance_bonus >= 0)` — 음수 잔액 원천 차단
- 무료 테마(0코인) 환불 요청 거부

**[S6] 가격 스냅샷**: `payments` 테이블에 생성 시점의 가격/코인 스냅샷 저장.
`POST /payments/confirm`은 `payments` 테이블 값 사용, 현재 `coin_packages` 값 무시.

**[S7] 유저 스코프 쿼리**: `/payments/history`, `/coins/*` 등 "내" 엔드포인트는
`user_id`를 JWT 컨텍스트에서만 추출. 요청 파라미터로 `user_id` 수신 금지.

**[S8] 정산 취소 복구**: `settlement.status = CANCELLED` 시
관련 `creator_earnings.settled = false, settlement_id = NULL`로 복구 → 다음 배치에 재포함.

**[S9] 환불 남용 방지**: 30일 내 3회 환불 초과 시 이후 환불은 Admin 수동 승인 필요.

**[S10] 결제 PII 로깅**: `payment_key`는 마지막 4자리만 로깅.
웹훅 바디는 INFO 이상에서 로깅 금지. 에러 응답에 내부 키 노출 금지.

### EventBus (도메인 간 느슨한 결합)

```go
type EventBus interface {
    Publish(ctx context.Context, event Event) error
    Subscribe(eventType string, handler EventHandler)
}
```

이벤트 흐름:
- `PaymentConfirmed` → CoinService 코인 충전
- `ThemePurchased` → CreatorService 수익 기록
- `ThemeRefunded` → CoinService 코인 반환 + CreatorService 수익 취소

### 도메인 간 의존성

```
payment/ ──publish──→ EventBus ←──subscribe── coin/
                         ↑                      │
                         │                   publish
                         │                      ↓
                    creator/ ←──subscribe── EventBus
```

---

## DB 스키마: 00008_payment.sql

### 신규 7개 테이블

**coin_packages** — 코인 패키지 (DB 관리, 이벤트 보너스 대응)
- id UUID PK, platform(WEB/MOBILE), name, price_krw, base_coins, bonus_coins
- sort_order, is_active, created_at, updated_at

**payments** — 결제 기록
- id UUID PK, user_id FK, package_id FK
- payment_key UNIQUE (PG사), idempotency_key UNIQUE (멱등성)
- provider, status(PENDING/CONFIRMED/REFUNDED/FAILED/CANCELLED)
- amount_krw, base_coins, bonus_coins
- refunded_at, confirmed_at, created_at, updated_at

**coin_transactions** — 코인 이력 원장
- id BIGSERIAL PK, user_id FK
- type(CHARGE/PURCHASE/REFUND/ADMIN_GRANT/ADMIN_REVOKE)
- base_amount, bonus_amount, balance_after_base, balance_after_bonus
- reference_type, reference_id, description, created_at

**theme_purchases** — 테마 구매
- id UUID PK, user_id FK, theme_id FK
- coin_price, base_coins_used, bonus_coins_used
- status(COMPLETED/REFUNDED), refundable_until(구매+7일, TIMESTAMPTZ)
- has_played BOOLEAN DEFAULT false — 게임 세션 참여 시 true로 변경 [S4]
- UNIQUE(user_id, theme_id)

**creator_earnings** — 제작자 수익 (건별)
- id UUID PK, creator_id FK, theme_id FK, purchase_id FK UNIQUE
- total_coins, creator_share_coins(70%), platform_share_coins(30%)
- settled, settlement_id FK

**settlements** — 정산 (주별)
- id UUID PK, creator_id FK, period_start, period_end
- total_coins, total_krw, tax_type(INDIVIDUAL/BUSINESS), tax_rate, tax_amount, net_amount
- status(CALCULATED/APPROVED/PAID_OUT/CANCELLED)
- approved_by FK, approved_at, paid_out_at

### 기존 테이블 확장

- `users` + `coin_balance_base BIGINT DEFAULT 0 CHECK (>= 0)`, `coin_balance_bonus BIGINT DEFAULT 0 CHECK (>= 0)` [S5]
- `themes` + `coin_price INT DEFAULT 0 CHECK (0..100000)`

### 코인 소진 순서

보너스 먼저 소진 → 기본 코인 후소진. 환불 시 원래 비율대로 복구.

### 상태 머신

```
결제: PENDING → CONFIRMED → REFUNDED
                         → FAILED / CANCELLED

정산: CALCULATED → APPROVED → PAID_OUT
                           → CANCELLED
```

---

## API 엔드포인트: 22개

### payment/ (5)
- `GET  /api/v1/payments/packages` — 패키지 목록 (platform 필터)
- `POST /api/v1/payments/create` — 결제 생성 (idempotency_key)
- `POST /api/v1/payments/confirm` — 결제 확인 (payment_key)
- `POST /api/v1/payments/webhook` — PG 웹훅 수신
- `GET  /api/v1/payments/history` — 내 결제 내역

### coin/ (5)
- `GET  /api/v1/coins/balance` — 내 잔액 (base + bonus)
- `GET  /api/v1/coins/transactions` — 코인 이력 (타입 필터)
- `POST /api/v1/coins/purchase-theme` — 테마 구매
- `POST /api/v1/coins/refund-theme` — 테마 환불 (7일 이내)
- `GET  /api/v1/coins/purchased-themes` — 구매한 테마 목록

### creator/ (4)
- `GET /api/v1/creator/dashboard` — 대시보드 요약
- `GET /api/v1/creator/themes/:id/stats` — 테마별 일별 통계
- `GET /api/v1/creator/earnings` — 수익 내역
- `GET /api/v1/creator/settlements` — 정산 내역

### admin/ (8, 기존 admin 도메인에 추가)
- `GET   /api/v1/admin/settlements` — 전체 정산 목록
- `PATCH /api/v1/admin/settlements/:id/approve` — 정산 승인
- `PATCH /api/v1/admin/settlements/:id/payout` — 지급 완료
- `GET   /api/v1/admin/revenue` — 플랫폼 매출 요약
- `POST  /api/v1/admin/coins/grant` — 코인 수동 지급
- `PATCH /api/v1/admin/packages/:id` — 패키지 수정
- `POST  /api/v1/admin/packages` — 패키지 추가
- `POST  /api/v1/admin/settlements/run` — 정산 배치 수동 실행

---

## 프론트엔드

### Feature 구조

```
features/
├── payment/          # 패키지, 결제, 결제이력
│   ├── api.ts, constants.ts
│   └── components/ (CoinPackageList, PaymentModal, CoinBalance, PaymentHistory, CoinTransactions)
├── coin/             # 구매, 환불, 구매목록
│   ├── api.ts
│   └── components/ (PurchaseThemeModal, RefundModal, PurchasedThemes)
├── creator/          # 대시보드, 통계, 수익, 정산
│   ├── api.ts
│   └── components/ (CreatorDashboard, ThemeStats, EarningsList, SettlementList)
└── admin/ (기존 추가)
    └── components/ (AdminSettlements, AdminRevenue, AdminCoinGrant, AdminPackages)
```

### 라우트

```
/shop              → CoinPackageList + CoinBalance
/shop/history      → PaymentHistory + CoinTransactions
/my-themes         → PurchasedThemes
/creator           → CreatorDashboard
/creator/:id/stats → ThemeStats
/creator/earnings  → EarningsList
/creator/settlements → SettlementList
/admin/settlements → AdminSettlements
/admin/revenue     → AdminRevenue
/admin/packages    → AdminPackages
```

### 기존 컴포넌트 수정

- Nav: CoinBalance 위젯 추가
- ThemeCard (lobby): 가격 표시 + 구매 버튼
- RoomPage: 구매 여부 체크 → 미구매 시 PurchaseThemeModal
- EditorOverviewTab: coin_price 입력 필드 (100~100,000)

---

## 이벤트 흐름

### 코인 충전

```
POST /payments/create { package_id, idempotency_key }  ← 금액 수신 안 함 [S1]
  → PaymentService:
      1. coin_packages에서 package_id로 가격/코인 조회 [S1]
      2. idempotency_key 중복 체크 (같은 키+다른 파라미터 → 422) [S1]
      3. payments 테이블에 스냅샷 저장 (amount_krw, base_coins, bonus_coins) [S6]
      4. MockProvider.CreatePayment() → status=PENDING

POST /payments/confirm { payment_key }
  → PaymentService:
      1. payments 테이블에서 스냅샷된 코인 값 사용 (coin_packages 재조회 안 함) [S6]
      2. MockProvider.ConfirmPayment() → status=CONFIRMED
  → EventBus(PaymentConfirmed)
  → CoinService: TX { UPDATE users balance += coins, INSERT coin_transactions(CHARGE) }
```

### 테마 구매

```
POST /coins/purchase-theme { theme_id }
  → CoinService:
      1. theme.creator_id == user_id 체크 → 거부 [S3]
      2. TX { SELECT users FOR UPDATE, 보너스먼저소진,
         UPDATE users balance -= coins, INSERT coin_transactions(PURCHASE),
         INSERT theme_purchases(refundable_until=NOW()+7d, has_played=false) }
  → EventBus(ThemePurchased)
  → CreatorService:
      1. creator_id != purchaser_id 재검증 [S3]
      2. INSERT creator_earnings(70%/30%)
```

### 환불

```
POST /coins/refund-theme
  → CoinService: TX {
      1. refundable_until > NOW() 체크 [S4]
      2. has_played == false 체크 [S4] — 플레이한 테마 환불 불가
      3. status == 'COMPLETED' 체크
      4. 무료 테마(coin_price == 0) 거부 [S5]
      5. 30일 내 환불 횟수 체크 (3회 초과 시 거부) [S9]
      6. UPDATE theme_purchases(REFUNDED), UPDATE users balance += coins,
         INSERT coin_transactions(REFUND) }
  → EventBus(ThemeRefunded)
  → CreatorService: DELETE creator_earnings
```

### 테마 플레이 마킹

```
게임 세션 시작 시 (game:start 이벤트):
  → 해당 session의 모든 player에 대해
    UPDATE theme_purchases SET has_played = true
    WHERE user_id = player.id AND theme_id = session.theme_id
```

### 정산 배치 (매주 월요일)

```
1. CollectEarnings: settled=false AND purchase.created_at < now()-7d
2. GROUP BY creator_id
3. CalculateFees: 세금 적용 (개인 3.3%, 사업자 10%)
4. ApplyMinimum: < 10,000원 스킵 (이월)
5. CreateSettlement: CALCULATED → Admin 승인 → APPROVED → PAID_OUT
```

---

## 에러 코드

| 코드 | HTTP | 설명 | 보안 |
|------|------|------|------|
| PAYMENT_DUPLICATE | 409 | 중복 결제 (idempotency_key) | |
| PAYMENT_IDEMPOTENCY_MISMATCH | 422 | 같은 키에 다른 파라미터 | S1 |
| PAYMENT_NOT_FOUND | 404 | 결제 건 없음 | |
| PAYMENT_INVALID_STATUS | 409 | 상태 전이 불가 | |
| PAYMENT_PROVIDER_ERROR | 502 | PG사 오류 | |
| PAYMENT_WEBHOOK_INVALID | 401 | 웹훅 서명 검증 실패 | S2 |
| COIN_INSUFFICIENT | 400 | 잔액 부족 | |
| COIN_BALANCE_MISMATCH | 500 | 이력 불일치 (내부 알림) | |
| PURCHASE_ALREADY_OWNED | 409 | 이미 구매한 테마 | |
| PURCHASE_SELF_THEME | 403 | 자기 테마 구매 불가 | S3 |
| PURCHASE_NOT_FOUND | 404 | 구매 기록 없음 | |
| REFUND_EXPIRED | 400 | 7일 초과 | S4 |
| REFUND_ALREADY_PLAYED | 400 | 플레이한 테마 환불 불가 | S4 |
| REFUND_ALREADY_DONE | 409 | 이미 환불됨 | |
| REFUND_FREE_THEME | 400 | 무료 테마 환불 불가 | S5 |
| REFUND_LIMIT_EXCEEDED | 429 | 30일 내 3회 초과, Admin 승인 필요 | S9 |
| SETTLEMENT_INVALID_STATUS | 409 | 정산 상태 전이 불가 | |
| THEME_PRICE_NOT_SET | 400 | 가격 미설정 | |
| THEME_PRICE_OUT_OF_RANGE | 400 | 100~100,000 범위 초과 | |

## 동시성 보호

| 상황 | 전략 |
|------|------|
| 코인 잔액 변경 | SELECT ... FOR UPDATE (users row lock) |
| 중복 결제 | idempotency_key UNIQUE |
| 중복 구매 | (user_id, theme_id) UNIQUE |
| 정산 배치 중복 | Redis advisory lock |
| 환불 race condition | theme_purchases row lock + status 체크 |

---

## 테스트

### Go (~50 테스트)
- Service: CoinService 잔액 계산, 소진 순서 (mockgen CoinRepository)
- Service: 환불 기간 검증, 상태 전이 (mockgen)
- Service: 정산 파이프라인 4단계 (세금 경계값)
- Handler: 22 엔드포인트 (httptest + mock service)
- EventBus: 이벤트 발행→구독 연결 (인메모리)
- Provider: MockProvider 상태 전이

### 프론트엔드 (~30 테스트)
- CoinPackageList 렌더링 (웹/모바일 구분)
- PurchaseThemeModal 잔액 부족
- RefundModal D-day / 만료
- CoinBalance 업데이트
- CreatorDashboard 데이터 표시
- AdminSettlements 승인 플로우
