# Phase 7.6: 결제 + 수익/통계 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 코인 기반 결제, 테마 구매/환불, 제작자 수익/정산, 통계 대시보드 구현

**Architecture:** 3 도메인 분리 (payment/coin/creator) + EventBus 느슨한 결합 + Strategy(Provider) + State Machine. 보안 원칙 S1~S10 준수.

**Tech Stack:** Go 1.25, sqlc, pgx, chi, zerolog, React 19, Zustand, React Query, Tailwind CSS, recharts

**설계 문서:** `docs/plans/2026-04-06-phase76-payment-design.md`

---

## Task 1: DB 마이그레이션 + sqlc 쿼리

**Files:**
- Create: `apps/server/db/migrations/00008_payment.sql`
- Create: `apps/server/db/queries/payment.sql`
- Create: `apps/server/db/queries/coin.sql`
- Create: `apps/server/db/queries/creator.sql`
- Modify: `apps/server/db/sqlc.yaml` (새 쿼리 파일 등록)

**Step 1: 마이그레이션 파일 작성**

```sql
-- +goose Up

-- 코인 패키지 (운영 DB 관리)
CREATE TABLE coin_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(10) NOT NULL CHECK (platform IN ('WEB', 'MOBILE')),
    name VARCHAR(100) NOT NULL,
    price_krw INT NOT NULL CHECK (price_krw > 0),
    base_coins INT NOT NULL CHECK (base_coins > 0),
    bonus_coins INT NOT NULL DEFAULT 0 CHECK (bonus_coins >= 0),
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 초기 패키지 데이터 (웹 3종 + 모바일 3종)
INSERT INTO coin_packages (platform, name, price_krw, base_coins, bonus_coins, sort_order) VALUES
    ('WEB', '400 코인', 5000, 400, 0, 1),
    ('WEB', '840 코인', 10000, 800, 40, 2),
    ('WEB', '2,650 코인', 30000, 2400, 250, 3),
    ('MOBILE', '400 코인', 5500, 400, 0, 1),
    ('MOBILE', '800 코인', 11000, 800, 0, 2),
    ('MOBILE', '2,450 코인', 33000, 2400, 50, 3);

-- 결제 기록
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    package_id UUID NOT NULL REFERENCES coin_packages(id),
    payment_key VARCHAR(200) UNIQUE,
    idempotency_key UUID NOT NULL UNIQUE,
    provider VARCHAR(20) NOT NULL DEFAULT 'mock',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','CONFIRMED','REFUNDED','FAILED','CANCELLED')),
    amount_krw INT NOT NULL,
    base_coins INT NOT NULL,
    bonus_coins INT NOT NULL,
    refunded_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key);

-- 코인 이력 원장
CREATE TABLE coin_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL
        CHECK (type IN ('CHARGE','PURCHASE','REFUND','ADMIN_GRANT','ADMIN_REVOKE')),
    base_amount INT NOT NULL DEFAULT 0,
    bonus_amount INT NOT NULL DEFAULT 0,
    balance_after_base BIGINT NOT NULL,
    balance_after_bonus BIGINT NOT NULL,
    reference_type VARCHAR(20),
    reference_id VARCHAR(100),
    description VARCHAR(300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_coin_tx_user_created ON coin_transactions(user_id, created_at DESC);

-- 테마 구매
CREATE TABLE theme_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    theme_id UUID NOT NULL REFERENCES themes(id),
    coin_price INT NOT NULL,
    base_coins_used INT NOT NULL,
    bonus_coins_used INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED'
        CHECK (status IN ('COMPLETED','REFUNDED')),
    has_played BOOLEAN NOT NULL DEFAULT false,
    refundable_until TIMESTAMPTZ NOT NULL,
    refunded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, theme_id)
);
CREATE INDEX idx_purchases_theme ON theme_purchases(theme_id);
CREATE INDEX idx_purchases_refundable ON theme_purchases(status, refundable_until);
CREATE INDEX idx_purchases_user ON theme_purchases(user_id, created_at DESC);

-- 제작자 수익 (건별)
CREATE TABLE creator_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id),
    theme_id UUID NOT NULL REFERENCES themes(id),
    purchase_id UUID NOT NULL REFERENCES theme_purchases(id) UNIQUE,
    total_coins INT NOT NULL,
    creator_share_coins INT NOT NULL,
    platform_share_coins INT NOT NULL,
    settled BOOLEAN NOT NULL DEFAULT false,
    settlement_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_earnings_creator_settled ON creator_earnings(creator_id, settled);
CREATE INDEX idx_earnings_created ON creator_earnings(created_at);

-- 정산 (주별)
CREATE TABLE settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_id UUID NOT NULL REFERENCES users(id),
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    total_coins INT NOT NULL,
    total_krw INT NOT NULL,
    tax_type VARCHAR(20) NOT NULL CHECK (tax_type IN ('INDIVIDUAL','BUSINESS')),
    tax_rate NUMERIC(5,2) NOT NULL,
    tax_amount INT NOT NULL,
    net_amount INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'CALCULATED'
        CHECK (status IN ('CALCULATED','APPROVED','PAID_OUT','CANCELLED')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    paid_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_settlements_creator ON settlements(creator_id);
CREATE INDEX idx_settlements_status ON settlements(status);

-- creator_earnings FK (settlements 테이블 생성 후)
ALTER TABLE creator_earnings
    ADD CONSTRAINT fk_earnings_settlement FOREIGN KEY (settlement_id) REFERENCES settlements(id);

-- users 테이블 확장 [S5]
ALTER TABLE users
    ADD COLUMN coin_balance_base BIGINT NOT NULL DEFAULT 0 CHECK (coin_balance_base >= 0),
    ADD COLUMN coin_balance_bonus BIGINT NOT NULL DEFAULT 0 CHECK (coin_balance_bonus >= 0);

-- themes 테이블 확장
ALTER TABLE themes
    ADD COLUMN coin_price INT NOT NULL DEFAULT 0 CHECK (coin_price >= 0 AND coin_price <= 100000);

-- +goose Down
ALTER TABLE themes DROP COLUMN IF EXISTS coin_price;
ALTER TABLE users DROP COLUMN IF EXISTS coin_balance_bonus;
ALTER TABLE users DROP COLUMN IF EXISTS coin_balance_base;
ALTER TABLE creator_earnings DROP CONSTRAINT IF EXISTS fk_earnings_settlement;
DROP TABLE IF EXISTS settlements;
DROP TABLE IF EXISTS creator_earnings;
DROP TABLE IF EXISTS theme_purchases;
DROP TABLE IF EXISTS coin_transactions;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS coin_packages;
```

**Step 2: sqlc 쿼리 파일 작성 — payment.sql**

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Coin Packages
-- ═══════════════════════════════════════════════════════════════════

-- name: ListActivePackages :many
SELECT * FROM coin_packages
WHERE is_active = true AND platform = $1
ORDER BY sort_order;

-- name: GetPackageByID :one
SELECT * FROM coin_packages WHERE id = $1;

-- name: CreatePackage :one
INSERT INTO coin_packages (platform, name, price_krw, base_coins, bonus_coins, sort_order, is_active)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: UpdatePackage :one
UPDATE coin_packages SET
    name = $2, price_krw = $3, base_coins = $4, bonus_coins = $5,
    sort_order = $6, is_active = $7, updated_at = NOW()
WHERE id = $1 RETURNING *;

-- ═══════════════════════════════════════════════════════════════════
-- Payments
-- ═══════════════════════════════════════════════════════════════════

-- name: CreatePayment :one
INSERT INTO payments (user_id, package_id, idempotency_key, provider, amount_krw, base_coins, bonus_coins)
VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *;

-- name: GetPaymentByID :one
SELECT * FROM payments WHERE id = $1;

-- name: GetPaymentByIdempotencyKey :one
SELECT * FROM payments WHERE idempotency_key = $1;

-- name: ConfirmPayment :one
UPDATE payments SET status = 'CONFIRMED', payment_key = $2, confirmed_at = NOW(), updated_at = NOW()
WHERE id = $1 AND status = 'PENDING' RETURNING *;

-- name: FailPayment :exec
UPDATE payments SET status = 'FAILED', updated_at = NOW()
WHERE id = $1 AND status = 'PENDING';

-- name: ListPaymentsByUser :many
SELECT * FROM payments
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPaymentsByUser :one
SELECT COUNT(*) FROM payments WHERE user_id = $1;
```

**Step 3: sqlc 쿼리 파일 작성 — coin.sql**

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Coin Balance
-- ═══════════════════════════════════════════════════════════════════

-- name: GetUserForCoinUpdate :one
SELECT id, coin_balance_base, coin_balance_bonus FROM users WHERE id = $1 FOR UPDATE;

-- name: UpdateCoinBalance :exec
UPDATE users SET
    coin_balance_base = coin_balance_base + $2,
    coin_balance_bonus = coin_balance_bonus + $3
WHERE id = $1;

-- name: GetCoinBalance :one
SELECT coin_balance_base, coin_balance_bonus FROM users WHERE id = $1;

-- ═══════════════════════════════════════════════════════════════════
-- Coin Transactions
-- ═══════════════════════════════════════════════════════════════════

-- name: CreateCoinTransaction :one
INSERT INTO coin_transactions (user_id, type, base_amount, bonus_amount, balance_after_base, balance_after_bonus, reference_type, reference_id, description)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;

-- name: ListCoinTransactions :many
SELECT * FROM coin_transactions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListCoinTransactionsByType :many
SELECT * FROM coin_transactions
WHERE user_id = $1 AND type = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: CountCoinTransactions :one
SELECT COUNT(*) FROM coin_transactions WHERE user_id = $1;

-- ═══════════════════════════════════════════════════════════════════
-- Theme Purchases
-- ═══════════════════════════════════════════════════════════════════

-- name: CreateThemePurchase :one
INSERT INTO theme_purchases (user_id, theme_id, coin_price, base_coins_used, bonus_coins_used, refundable_until)
VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days') RETURNING *;

-- name: GetThemePurchase :one
SELECT * FROM theme_purchases WHERE id = $1;

-- name: GetThemePurchaseByUserTheme :one
SELECT * FROM theme_purchases WHERE user_id = $1 AND theme_id = $2;

-- name: GetThemePurchaseForRefund :one
SELECT * FROM theme_purchases WHERE id = $1 AND user_id = $2 FOR UPDATE;

-- name: RefundThemePurchase :one
UPDATE theme_purchases SET status = 'REFUNDED', refunded_at = NOW()
WHERE id = $1 AND status = 'COMPLETED' RETURNING *;

-- name: MarkThemePlayed :exec
UPDATE theme_purchases SET has_played = true
WHERE user_id = $1 AND theme_id = $2 AND status = 'COMPLETED';

-- name: ListPurchasedThemes :many
SELECT tp.*, t.title, t.slug, t.thumbnail_url
FROM theme_purchases tp
JOIN themes t ON t.id = tp.theme_id
WHERE tp.user_id = $1 AND tp.status = 'COMPLETED'
ORDER BY tp.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountPurchasedThemes :one
SELECT COUNT(*) FROM theme_purchases WHERE user_id = $1 AND status = 'COMPLETED';

-- name: CountRecentRefunds :one
SELECT COUNT(*) FROM theme_purchases
WHERE user_id = $1 AND status = 'REFUNDED'
AND refunded_at > NOW() - INTERVAL '30 days';
```

**Step 4: sqlc 쿼리 파일 작성 — creator.sql**

```sql
-- ═══════════════════════════════════════════════════════════════════
-- Creator Earnings
-- ═══════════════════════════════════════════════════════════════════

-- name: CreateEarning :one
INSERT INTO creator_earnings (creator_id, theme_id, purchase_id, total_coins, creator_share_coins, platform_share_coins)
VALUES ($1, $2, $3, $4, $5, $6) RETURNING *;

-- name: DeleteEarningByPurchase :exec
DELETE FROM creator_earnings WHERE purchase_id = $1;

-- name: ListEarningsByCreator :many
SELECT ce.*, t.title AS theme_title
FROM creator_earnings ce
JOIN themes t ON t.id = ce.theme_id
WHERE ce.creator_id = $1
ORDER BY ce.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountEarningsByCreator :one
SELECT COUNT(*) FROM creator_earnings WHERE creator_id = $1;

-- name: GetCreatorDashboard :one
SELECT
    COALESCE(SUM(creator_share_coins), 0)::bigint AS total_earnings,
    COALESCE(SUM(CASE WHEN settled = false THEN creator_share_coins ELSE 0 END), 0)::bigint AS unsettled_earnings,
    COUNT(*)::bigint AS total_sales
FROM creator_earnings WHERE creator_id = $1;

-- name: GetThemeDailyStats :many
SELECT
    DATE(ce.created_at) AS stat_date,
    COUNT(*) AS sales_count,
    SUM(ce.total_coins) AS total_coins,
    SUM(ce.creator_share_coins) AS creator_coins
FROM creator_earnings ce
WHERE ce.theme_id = $1 AND ce.creator_id = $2
    AND ce.created_at >= $3 AND ce.created_at < $4
GROUP BY DATE(ce.created_at)
ORDER BY stat_date;

-- name: CollectUnsettledEarnings :many
SELECT ce.creator_id,
    SUM(ce.creator_share_coins)::bigint AS total_creator_coins,
    SUM(ce.platform_share_coins)::bigint AS total_platform_coins,
    COUNT(*) AS earning_count
FROM creator_earnings ce
JOIN theme_purchases tp ON tp.id = ce.purchase_id
WHERE ce.settled = false
    AND tp.created_at < NOW() - INTERVAL '7 days'
GROUP BY ce.creator_id
HAVING SUM(ce.creator_share_coins) > 0;

-- name: SettleEarnings :exec
UPDATE creator_earnings SET settled = true, settlement_id = $2
WHERE creator_id = $1 AND settled = false
AND purchase_id IN (
    SELECT tp.id FROM theme_purchases tp
    WHERE tp.created_at < NOW() - INTERVAL '7 days'
);

-- name: UnsetleEarningsBySettlement :exec
UPDATE creator_earnings SET settled = false, settlement_id = NULL
WHERE settlement_id = $1;

-- ═══════════════════════════════════════════════════════════════════
-- Settlements
-- ═══════════════════════════════════════════════════════════════════

-- name: CreateSettlement :one
INSERT INTO settlements (creator_id, period_start, period_end, total_coins, total_krw, tax_type, tax_rate, tax_amount, net_amount)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *;

-- name: GetSettlement :one
SELECT * FROM settlements WHERE id = $1;

-- name: ApproveSettlement :one
UPDATE settlements SET status = 'APPROVED', approved_by = $2, approved_at = NOW(), updated_at = NOW()
WHERE id = $1 AND status = 'CALCULATED' RETURNING *;

-- name: PayoutSettlement :one
UPDATE settlements SET status = 'PAID_OUT', paid_out_at = NOW(), updated_at = NOW()
WHERE id = $1 AND status = 'APPROVED' RETURNING *;

-- name: CancelSettlement :one
UPDATE settlements SET status = 'CANCELLED', updated_at = NOW()
WHERE id = $1 AND status IN ('CALCULATED', 'APPROVED') RETURNING *;

-- name: ListSettlementsByCreator :many
SELECT * FROM settlements
WHERE creator_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountSettlementsByCreator :one
SELECT COUNT(*) FROM settlements WHERE creator_id = $1;

-- name: ListSettlementsByStatus :many
SELECT s.*, u.nickname AS creator_nickname
FROM settlements s
JOIN users u ON u.id = s.creator_id
WHERE ($1::varchar = '' OR s.status = $1)
ORDER BY s.created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountSettlementsByStatus :one
SELECT COUNT(*) FROM settlements WHERE ($1::varchar = '' OR status = $1);

-- name: GetPlatformRevenue :one
SELECT
    COALESCE(SUM(total_coins), 0)::bigint AS total_coins,
    COALESCE(SUM(total_krw), 0)::bigint AS total_krw,
    COALESCE(SUM(CASE WHEN status = 'PAID_OUT' THEN net_amount ELSE 0 END), 0)::bigint AS total_paid_out,
    COUNT(*)::bigint AS settlement_count
FROM settlements;
```

**Step 5: sqlc 코드 생성 실행**

Run: `cd apps/server && task db:sqlc`
Expected: Go 코드 생성 성공 (apps/server/internal/db/ 아래 새 파일들)

**Step 6: 커밋**

```bash
git add apps/server/db/ apps/server/internal/db/
git commit -m "feat(phase7.6): add payment DB migration + sqlc queries

- 00008_payment.sql: 6 new tables + users/themes extension
- payment.sql: 11 queries (packages, payments)
- coin.sql: 14 queries (balance, transactions, purchases)
- creator.sql: 16 queries (earnings, settlements, stats)"
```

---

## Task 2: EventBus 인프라 + 에러 코드

**Files:**
- Create: `apps/server/internal/eventbus/eventbus.go`
- Create: `apps/server/internal/eventbus/events.go`
- Modify: `apps/server/internal/apperror/codes.go`

**Step 1: EventBus 구현**

```go
// apps/server/internal/eventbus/eventbus.go
package eventbus

import (
    "context"
    "sync"

    "github.com/rs/zerolog"
)

type Event interface {
    EventType() string
}

type Handler func(ctx context.Context, event Event) error

type Bus struct {
    handlers map[string][]Handler
    mu       sync.RWMutex
    logger   zerolog.Logger
}

func New(logger zerolog.Logger) *Bus {
    return &Bus{
        handlers: make(map[string][]Handler),
        logger:   logger.With().Str("component", "eventbus").Logger(),
    }
}

func (b *Bus) Subscribe(eventType string, handler Handler) {
    b.mu.Lock()
    defer b.mu.Unlock()
    b.handlers[eventType] = append(b.handlers[eventType], handler)
}

func (b *Bus) Publish(ctx context.Context, event Event) error {
    b.mu.RLock()
    handlers := b.handlers[event.EventType()]
    b.mu.RUnlock()

    for _, h := range handlers {
        if err := h(ctx, event); err != nil {
            b.logger.Error().Err(err).Str("event", event.EventType()).Msg("handler failed")
            return err
        }
    }
    return nil
}
```

**Step 2: 이벤트 타입 정의**

```go
// apps/server/internal/eventbus/events.go
package eventbus

import "github.com/google/uuid"

const (
    TypePaymentConfirmed = "payment.confirmed"
    TypeThemePurchased   = "theme.purchased"
    TypeThemeRefunded    = "theme.refunded"
    TypeGameStarted      = "game.started"
)

type PaymentConfirmed struct {
    UserID    uuid.UUID
    PaymentID uuid.UUID
    BaseCoins int
    BonusCoins int
}

func (e PaymentConfirmed) EventType() string { return TypePaymentConfirmed }

type ThemePurchased struct {
    PurchaseID uuid.UUID
    UserID     uuid.UUID
    CreatorID  uuid.UUID
    ThemeID    uuid.UUID
    TotalCoins int
}

func (e ThemePurchased) EventType() string { return TypeThemePurchased }

type ThemeRefunded struct {
    PurchaseID uuid.UUID
    UserID     uuid.UUID
    CreatorID  uuid.UUID
}

func (e ThemeRefunded) EventType() string { return TypeThemeRefunded }

type GameStarted struct {
    SessionID uuid.UUID
    ThemeID   uuid.UUID
    PlayerIDs []uuid.UUID
}

func (e GameStarted) EventType() string { return TypeGameStarted }
```

**Step 3: 에러 코드 추가**

`apps/server/internal/apperror/codes.go`에 Payment/Coin/Creator 에러 코드 19개 추가 (설계 문서 에러 코드 테이블 참조)

**Step 4: 커밋**

```bash
git add apps/server/internal/eventbus/ apps/server/internal/apperror/codes.go
git commit -m "feat(phase7.6): add EventBus infrastructure + payment error codes

- Synchronous in-process EventBus (publish/subscribe)
- 4 event types: PaymentConfirmed, ThemePurchased, ThemeRefunded, GameStarted
- 19 payment/coin/refund/settlement error codes"
```

---

## Task 3: PaymentProvider (Strategy 패턴)

**Files:**
- Create: `apps/server/internal/domain/payment/provider.go`
- Create: `apps/server/internal/domain/payment/mock_provider.go`
- Create: `apps/server/internal/domain/payment/types.go`

**Step 1: Provider 인터페이스 + 타입 정의**

types.go: CreatePaymentRequest, PaymentResult, WebhookEvent, PaymentStatus 상수, 상태 전이 맵 (validTransitions)
provider.go: PaymentProvider 인터페이스 (CreatePayment, ConfirmPayment, RefundPayment, HandleWebhook)
             + NewPaymentProvider Factory 함수

**Step 2: MockProvider 구현**

mock_provider.go: 즉시 성공하는 Mock 구현체. CreatePayment → paymentKey 생성, ConfirmPayment → 성공, HandleWebhook → 서명 검증 스킵 (Mock이므로)

**Step 3: 커밋**

```bash
git add apps/server/internal/domain/payment/
git commit -m "feat(phase7.6): add PaymentProvider Strategy pattern + MockProvider"
```

---

## Task 4: PaymentService + Handler

**Files:**
- Create: `apps/server/internal/domain/payment/service.go`
- Create: `apps/server/internal/domain/payment/handler.go`

**Step 1: PaymentService 구현**

인터페이스:
- ListPackages(ctx, platform) → []PackageResponse
- CreatePayment(ctx, userID, packageID, idempotencyKey) → *PaymentResponse [S1, S6]
- ConfirmPayment(ctx, userID, paymentID, paymentKey) → *PaymentResponse
- GetPaymentHistory(ctx, userID, limit, offset) → ([]PaymentResponse, total)

핵심 로직:
- CreatePayment: package에서 금액 조회 (클라이언트 금액 무시) [S1], idempotency 중복 체크 (같은 키+다른 packageID → 422) [S1], payments 스냅샷 저장 [S6]
- ConfirmPayment: payments 테이블 스냅샷 값 사용 [S6], EventBus.Publish(PaymentConfirmed)

**Step 2: PaymentHandler 구현**

5개 핸들러 메서드 (기존 social/handler.go 패턴 따름):
- ListPackages, CreatePayment, ConfirmPayment, HandleWebhook, GetPaymentHistory
- 웹훅 엔드포인트: JWT 미들웨어 제외, Provider.HandleWebhook으로 서명 검증 위임 [S2]

**Step 3: 핸들러 테스트 작성**

httptest + mock service로 5개 엔드포인트 테스트

**Step 4: 커밋**

```bash
git add apps/server/internal/domain/payment/
git commit -m "feat(phase7.6): add PaymentService + handlers (5 endpoints)

- Server-side price resolution [S1]
- Price snapshot at creation [S6]
- Webhook signature delegation [S2]
- Idempotency mismatch detection [S1]"
```

---

## Task 5: CoinService + Handler

**Files:**
- Create: `apps/server/internal/domain/coin/service.go`
- Create: `apps/server/internal/domain/coin/handler.go`
- Create: `apps/server/internal/domain/coin/types.go`

**Step 1: CoinService 구현**

인터페이스:
- GetBalance(ctx, userID) → *BalanceResponse
- ListTransactions(ctx, userID, txType, limit, offset) → ([]TransactionResponse, total)
- PurchaseTheme(ctx, userID, themeID) → *PurchaseResponse [S3, S4]
- RefundTheme(ctx, userID, purchaseID) → error [S4, S5, S9]
- ListPurchasedThemes(ctx, userID, limit, offset) → ([]PurchasedThemeResponse, total)
- HandlePaymentConfirmed(ctx, event) → error (EventBus 구독용)
- HandleGameStarted(ctx, event) → error (has_played 마킹)

핵심 로직:
- PurchaseTheme: creator_id != user_id [S3], 보너스 먼저 소진, SELECT FOR UPDATE
- RefundTheme: 3중 검증 (7일 + 미플레이 + 미환불) [S4], 무료 테마 거부 [S5], 30일 3회 제한 [S9]
- HandlePaymentConfirmed: TX { balance 업데이트 + 이력 기록 }
- HandleGameStarted: MarkThemePlayed 호출

**Step 2: CoinHandler 구현**

5개 핸들러 메서드, user_id는 JWT 컨텍스트에서만 추출 [S7]

**Step 3: 서비스 테스트**

보너스 소진 순서, 환불 3중 검증, 자전 거래 차단, 잔액 부족, 30일 환불 제한 테스트

**Step 4: 커밋**

```bash
git add apps/server/internal/domain/coin/
git commit -m "feat(phase7.6): add CoinService + handlers (5 endpoints)

- Self-purchase prevention [S3]
- Refund triple-check (7d + unplayed + status) [S4]
- Free theme refund block [S5]
- Refund rate limit 3/30d [S9]
- Bonus-first depletion with FOR UPDATE"
```

---

## Task 6: CreatorService + Handler

**Files:**
- Create: `apps/server/internal/domain/creator/service.go`
- Create: `apps/server/internal/domain/creator/handler.go`
- Create: `apps/server/internal/domain/creator/types.go`
- Create: `apps/server/internal/domain/creator/settlement.go`

**Step 1: CreatorService 구현**

인터페이스:
- GetDashboard(ctx, creatorID) → *DashboardResponse
- GetThemeStats(ctx, creatorID, themeID, from, to) → []DailyStatResponse
- ListEarnings(ctx, creatorID, limit, offset) → ([]EarningResponse, total)
- ListSettlements(ctx, creatorID, limit, offset) → ([]SettlementResponse, total)
- HandleThemePurchased(ctx, event) → error (EventBus 구독)
- HandleThemeRefunded(ctx, event) → error (EventBus 구독)

**Step 2: SettlementPipeline 구현 (Template Method)**

settlement.go:
- RunWeeklySettlement(ctx) error — Redis advisory lock으로 중복 방지
- collectEarnings → calculateFees → applyMinimum → createSettlements
- 세금: 개인 3.3%, 사업자 10%
- 코인→원화 환산: total_coins * 12.5

**Step 3: Admin 핸들러 추가**

기존 admin 도메인에 정산 관리 8개 엔드포인트 핸들러 추가:
- ListSettlements, ApproveSettlement, PayoutSettlement, GetRevenue
- GrantCoins, UpdatePackage, CreatePackage, RunSettlement
- 정산 취소 시 earnings 복구 [S8]

**Step 4: 커밋**

```bash
git add apps/server/internal/domain/creator/ apps/server/internal/domain/admin/
git commit -m "feat(phase7.6): add CreatorService + settlement pipeline + admin handlers

- Creator dashboard, theme stats, earnings, settlements
- Weekly settlement pipeline (Template Method)
- Tax calculation (individual 3.3%, business 10%)
- Settlement cancellation with earnings recovery [S8]
- Admin: 8 endpoints (settlements, revenue, packages, coin grant)"
```

---

## Task 7: main.go DI 조립 + 라우트 등록

**Files:**
- Modify: `apps/server/cmd/server/main.go`

**Step 1: 서비스 초기화 + EventBus 연결**

```go
// EventBus
bus := eventbus.New(logger)

// Payment
paymentProvider := payment.NewPaymentProvider(cfg)
paymentSvc := payment.NewService(queries, paymentProvider, bus, logger)
paymentHandler := payment.NewHandler(paymentSvc)

// Coin
coinSvc := coin.NewService(pool, queries, bus, logger)
coinHandler := coin.NewHandler(coinSvc)

// Creator
creatorSvc := creator.NewService(queries, redisClient, bus, logger)
creatorHandler := creator.NewHandler(creatorSvc)

// EventBus 구독 연결
bus.Subscribe(eventbus.TypePaymentConfirmed, coinSvc.HandlePaymentConfirmed)
bus.Subscribe(eventbus.TypeThemePurchased, creatorSvc.HandleThemePurchased)
bus.Subscribe(eventbus.TypeThemeRefunded, creatorSvc.HandleThemeRefunded)
bus.Subscribe(eventbus.TypeGameStarted, coinSvc.HandleGameStarted)
```

**Step 2: 라우트 등록**

```go
// Public
r.Get("/api/v1/payments/packages", paymentHandler.ListPackages)
r.Post("/api/v1/payments/webhook", paymentHandler.HandleWebhook)  // JWT 제외 [S2]

// Authed
r.Route("/api/v1", func(r chi.Router) {
    r.Use(middleware.Auth)

    r.Route("/payments", func(r chi.Router) { ... })   // 4 endpoints
    r.Route("/coins", func(r chi.Router) { ... })       // 5 endpoints
    r.Route("/creator", func(r chi.Router) {            // RequireRole("CREATOR","ADMIN")
        ... // 4 endpoints
    })
    r.Route("/admin", func(r chi.Router) {              // RequireRole("ADMIN")
        ... // 8 endpoints (기존 + 신규)
    })
})
```

**Step 3: 빌드 확인**

Run: `cd apps/server && go build ./cmd/server/`
Expected: 빌드 성공

**Step 4: 커밋**

```bash
git add apps/server/cmd/server/main.go
git commit -m "feat(phase7.6): wire payment/coin/creator DI + routes in main.go

- EventBus subscription wiring
- 22 new API endpoints registered
- Webhook route excluded from JWT middleware [S2]"
```

---

## Task 8: Go 백엔드 테스트

**Files:**
- Create: `apps/server/internal/eventbus/eventbus_test.go`
- Create: `apps/server/internal/domain/payment/handler_test.go`
- Create: `apps/server/internal/domain/coin/service_test.go`
- Create: `apps/server/internal/domain/coin/handler_test.go`
- Create: `apps/server/internal/domain/creator/service_test.go`
- Create: `apps/server/internal/domain/creator/handler_test.go`

**Step 1: EventBus 테스트** — publish/subscribe, 다중 핸들러, 핸들러 에러 전파

**Step 2: CoinService 테스트** (핵심) — 보너스 먼저 소진, 잔액 부족, 자전 거래 차단, 환불 3중 검증, 환불 횟수 제한, 무료 테마 환불 거부

**Step 3: PaymentHandler 테스트** — 패키지 목록, 결제 생성/확인, 멱등성 충돌

**Step 4: CreatorService 테스트** — 수익 기록, 대시보드 집계, 정산 파이프라인, 정산 취소 복구

**Step 5: 전체 테스트 실행**

Run: `cd apps/server && go test -race ./internal/...`
Expected: 전체 PASS

**Step 6: 커밋**

```bash
git add apps/server/internal/
git commit -m "test(phase7.6): add payment/coin/creator backend tests (~50 tests)

- EventBus: pub/sub, error propagation
- CoinService: depletion order, refund checks, self-purchase block
- PaymentHandler: CRUD, idempotency
- CreatorService: earnings, settlement pipeline, cancellation"
```

---

## Task 9: 프론트엔드 — API + 상태 + 타입

**Files:**
- Create: `apps/web/src/features/payment/api.ts`
- Create: `apps/web/src/features/payment/constants.ts`
- Create: `apps/web/src/features/coin/api.ts`
- Create: `apps/web/src/features/creator/api.ts`
- Modify: `apps/web/src/services/api.ts` (필요 시)

**Step 1: 타입 + React Query hooks 작성**

각 feature의 api.ts에 Response/Request 타입 + useQuery/useMutation hooks:
- payment: 5 hooks (usePackages, useCreatePayment, useConfirmPayment, usePaymentHistory 등)
- coin: 7 hooks (useBalance, useTransactions, usePurchaseTheme, useRefundTheme, usePurchasedThemes 등)
- creator: 4 hooks (useDashboard, useThemeStats, useEarnings, useSettlements)

**Step 2: 커밋**

```bash
git add apps/web/src/features/payment/ apps/web/src/features/coin/ apps/web/src/features/creator/
git commit -m "feat(phase7.6): add payment/coin/creator React Query hooks + types"
```

---

## Task 10: 프론트엔드 — Payment UI

**Files:**
- Create: `apps/web/src/features/payment/components/CoinPackageList.tsx`
- Create: `apps/web/src/features/payment/components/PaymentModal.tsx`
- Create: `apps/web/src/features/payment/components/CoinBalance.tsx`
- Create: `apps/web/src/features/payment/components/PaymentHistory.tsx`
- Create: `apps/web/src/features/payment/components/CoinTransactions.tsx`
- Modify: `apps/web/src/shared/components/Nav.tsx` (CoinBalance 위젯)

**Step 1: CoinPackageList** — 웹/모바일 구분, 보너스 표시, 가격 카드 그리드
**Step 2: PaymentModal** — 패키지 선택 → 결제 생성 → Mock 즉시 확인
**Step 3: CoinBalance** — Nav에 삽입할 잔액 위젯 (base + bonus 표시)
**Step 4: PaymentHistory + CoinTransactions** — 테이블 + 페이지네이션 + 타입 필터

**Step 5: 커밋**

```bash
git add apps/web/src/features/payment/ apps/web/src/shared/
git commit -m "feat(phase7.6): add payment UI (shop, balance widget, history)"
```

---

## Task 11: 프론트엔드 — Coin UI (구매/환불)

**Files:**
- Create: `apps/web/src/features/coin/components/PurchaseThemeModal.tsx`
- Create: `apps/web/src/features/coin/components/RefundModal.tsx`
- Create: `apps/web/src/features/coin/components/PurchasedThemes.tsx`
- Modify: `apps/web/src/features/lobby/components/ThemeCard.tsx` (가격 + 구매 버튼)
- Modify: `apps/web/src/features/game/components/GamePage.tsx` (구매 여부 체크)
- Modify: `apps/web/src/features/editor/components/OverviewTab.tsx` (coin_price 필드)

**Step 1: PurchaseThemeModal** — 잔액 확인, 보너스 소진 미리보기, 구매 확인
**Step 2: RefundModal** — D-day 표시, 플레이 여부 체크, 환불 확인
**Step 3: PurchasedThemes** — 구매 목록 + 환불 가능 상태 표시
**Step 4: 기존 컴포넌트 수정** — ThemeCard(가격), GamePage(구매체크), OverviewTab(coin_price)

**Step 5: 커밋**

```bash
git add apps/web/src/features/coin/ apps/web/src/features/lobby/ apps/web/src/features/game/ apps/web/src/features/editor/
git commit -m "feat(phase7.6): add coin UI (purchase, refund, theme price)"
```

---

## Task 12: 프론트엔드 — Creator 대시보드

**Files:**
- Create: `apps/web/src/features/creator/components/CreatorDashboard.tsx`
- Create: `apps/web/src/features/creator/components/ThemeStats.tsx`
- Create: `apps/web/src/features/creator/components/EarningsList.tsx`
- Create: `apps/web/src/features/creator/components/SettlementList.tsx`

**Step 1: CreatorDashboard** — 요약 카드 3장 (총 수익, 미정산, 판매 수)
**Step 2: ThemeStats** — recharts 일별 차트 (판매 수 + 수익)
**Step 3: EarningsList** — 수익 내역 테이블 + 페이지네이션
**Step 4: SettlementList** — 정산 내역 + 상태 뱃지 (CALCULATED/APPROVED/PAID_OUT)

**Step 5: 커밋**

```bash
git add apps/web/src/features/creator/
git commit -m "feat(phase7.6): add creator dashboard (stats, earnings, settlements)"
```

---

## Task 13: 프론트엔드 — Admin 확장 + 라우트

**Files:**
- Create: `apps/web/src/features/admin/components/AdminSettlements.tsx`
- Create: `apps/web/src/features/admin/components/AdminRevenue.tsx`
- Create: `apps/web/src/features/admin/components/AdminCoinGrant.tsx`
- Create: `apps/web/src/features/admin/components/AdminPackages.tsx`
- Modify: `apps/web/src/features/admin/api.ts` (admin hooks 추가)
- Modify: `apps/web/src/router.tsx` (새 라우트 등록)

**Step 1: Admin 컴포넌트 4개** — 정산 승인/지급, 매출 요약, 코인 지급, 패키지 관리
**Step 2: 라우트 등록** — /shop, /shop/history, /my-themes, /creator/*, /admin/* 추가
**Step 3: Sidebar 메뉴 업데이트** — 상점/내테마/제작자/관리자 메뉴 추가

**Step 4: 커밋**

```bash
git add apps/web/src/features/admin/ apps/web/src/router.tsx apps/web/src/shared/
git commit -m "feat(phase7.6): add admin payment management + all routes"
```

---

## Task 14: 프론트엔드 테스트

**Files:**
- Create: `apps/web/src/features/payment/components/__tests__/`
- Create: `apps/web/src/features/coin/components/__tests__/`
- Create: `apps/web/src/features/creator/components/__tests__/`

**Step 1: Payment 테스트** — CoinPackageList 렌더링, PaymentModal 플로우
**Step 2: Coin 테스트** — PurchaseThemeModal 잔액 부족, RefundModal D-day/만료/플레이됨
**Step 3: Creator 테스트** — CreatorDashboard 데이터, SettlementList 상태 뱃지

**Step 4: 전체 테스트 실행**

Run: `cd apps/web && pnpm test`
Expected: 전체 PASS

**Step 5: TypeScript 체크**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: 0 errors

**Step 6: 커밋**

```bash
git add apps/web/src/features/
git commit -m "test(phase7.6): add frontend payment/coin/creator tests (~30 tests)"
```

---

## Task 15: 최종 검증 + 코드 리뷰

**Step 1: Go 전체 빌드 + 테스트**

Run: `cd apps/server && go build ./cmd/server/ && go test -race ./internal/...`

**Step 2: 프론트엔드 전체 빌드 + 테스트**

Run: `cd apps/web && pnpm tsc --noEmit && pnpm test`

**Step 3: 코드 리뷰 요청**

superpowers:requesting-code-review 스킬로 보안 원칙 S1~S10 준수 여부 검증

**Step 4: 체크리스트 업데이트**

docs/plans/2026-04-05-rebuild/checklist.md의 Phase 7.6 항목 체크

**Step 5: 최종 커밋**

```bash
git commit -m "feat: complete Phase 7.6 payment + earnings + statistics"
```
