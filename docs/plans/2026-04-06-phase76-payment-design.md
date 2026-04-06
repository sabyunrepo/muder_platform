# Phase 7.6: 결제 + 수익/통계 — 설계 문서

> 승인일: 2026-04-06

## 요구사항 요약

| 항목 | 결정 |
|------|------|
| PG 연동 | Provider 인터페이스 + Mock (실제 PG 나중) |
| 코인 모델 | 하이브리드 (잔액 컬럼 + 이력 테이블) |
| 보너스 코인 | base/bonus 분리 저장, 보너스 먼저 소진 |
| 패키지 | DB 테이블 관리 (이벤트 보너스 대응) |
| 웹/모바일 | 플랫폼별 패키지 구분 (가격·보너스 차등) |
| 테마 가격 | 제작자 자유 설정 (100 ~ 100,000코인) |
| 환불 | 구매 후 7일 이내 가능 |
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
    HandleWebhook(ctx context.Context, body []byte) (*WebhookEvent, error)
}
```

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
- status(COMPLETED/REFUNDED), refundable_until(구매+7일)
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

- `users` + `coin_balance_base INT DEFAULT 0`, `coin_balance_bonus INT DEFAULT 0`
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
POST /payments/create → PENDING
POST /payments/confirm → CONFIRMED
  → EventBus(PaymentConfirmed)
  → CoinService: TX { UPDATE users balance += coins, INSERT coin_transactions(CHARGE) }
```

### 테마 구매

```
POST /coins/purchase-theme
  → CoinService: TX { SELECT users FOR UPDATE, 보너스먼저소진,
      UPDATE users balance -= coins, INSERT coin_transactions(PURCHASE),
      INSERT theme_purchases(refundable_until=+7d) }
  → EventBus(ThemePurchased)
  → CreatorService: INSERT creator_earnings(70%/30%)
```

### 환불

```
POST /coins/refund-theme
  → CoinService: TX { refundable_until 체크,
      UPDATE theme_purchases(REFUNDED), UPDATE users balance += coins,
      INSERT coin_transactions(REFUND) }
  → EventBus(ThemeRefunded)
  → CreatorService: DELETE creator_earnings
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

| 코드 | HTTP | 설명 |
|------|------|------|
| PAYMENT_DUPLICATE | 409 | 중복 결제 (idempotency_key) |
| PAYMENT_NOT_FOUND | 404 | 결제 건 없음 |
| PAYMENT_INVALID_STATUS | 409 | 상태 전이 불가 |
| PAYMENT_PROVIDER_ERROR | 502 | PG사 오류 |
| COIN_INSUFFICIENT | 400 | 잔액 부족 |
| COIN_BALANCE_MISMATCH | 500 | 이력 불일치 (내부 알림) |
| PURCHASE_ALREADY_OWNED | 409 | 이미 구매한 테마 |
| PURCHASE_NOT_FOUND | 404 | 구매 기록 없음 |
| REFUND_EXPIRED | 400 | 7일 초과 |
| REFUND_ALREADY_DONE | 409 | 이미 환불됨 |
| SETTLEMENT_INVALID_STATUS | 409 | 정산 상태 전이 불가 |
| THEME_PRICE_NOT_SET | 400 | 가격 미설정 |
| THEME_PRICE_OUT_OF_RANGE | 400 | 100~100,000 범위 초과 |

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
