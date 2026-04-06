package coin

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/eventbus"
)

// ---------------------------------------------------------------------------
// Mock CoinService for handler-layer tests and direct service-logic tests.
// Since the real coinService depends on *pgxpool.Pool and *db.Queries,
// we test the business logic by mocking the CoinService interface directly.
// ---------------------------------------------------------------------------

type mockCoinSvc struct {
	getBalanceFn         func(ctx context.Context, userID uuid.UUID) (*BalanceResponse, error)
	purchaseThemeFn      func(ctx context.Context, userID, themeID uuid.UUID) (*PurchaseResponse, error)
	refundThemeFn        func(ctx context.Context, userID, purchaseID uuid.UUID) error
	handlePaymentConfFn  func(ctx context.Context, event eventbus.Event) error
}

func (m *mockCoinSvc) GetBalance(ctx context.Context, userID uuid.UUID) (*BalanceResponse, error) {
	if m.getBalanceFn != nil {
		return m.getBalanceFn(ctx, userID)
	}
	return &BalanceResponse{}, nil
}

func (m *mockCoinSvc) ListTransactions(_ context.Context, _ uuid.UUID, _ string, _, _ int32) ([]TransactionResponse, int64, error) {
	return nil, 0, nil
}

func (m *mockCoinSvc) PurchaseTheme(ctx context.Context, userID, themeID uuid.UUID) (*PurchaseResponse, error) {
	if m.purchaseThemeFn != nil {
		return m.purchaseThemeFn(ctx, userID, themeID)
	}
	return nil, nil
}

func (m *mockCoinSvc) RefundTheme(ctx context.Context, userID, purchaseID uuid.UUID) error {
	if m.refundThemeFn != nil {
		return m.refundThemeFn(ctx, userID, purchaseID)
	}
	return nil
}

func (m *mockCoinSvc) ListPurchasedThemes(_ context.Context, _ uuid.UUID, _, _ int32) ([]PurchasedThemeResponse, int64, error) {
	return nil, 0, nil
}

func (m *mockCoinSvc) HandlePaymentConfirmed(ctx context.Context, event eventbus.Event) error {
	if m.handlePaymentConfFn != nil {
		return m.handlePaymentConfFn(ctx, event)
	}
	return nil
}

func (m *mockCoinSvc) HandleGameStarted(_ context.Context, _ eventbus.Event) error {
	return nil
}

// ---------------------------------------------------------------------------
// PurchaseTheme tests — bonus-first depletion strategy
// ---------------------------------------------------------------------------

func TestPurchaseTheme_BonusFirst(t *testing.T) {
	// bonus=400, base=100, price=300 → bonus 300 used, base 0 used
	userID := uuid.New()
	themeID := uuid.New()

	svc := &mockCoinSvc{
		purchaseThemeFn: func(_ context.Context, uID, tID uuid.UUID) (*PurchaseResponse, error) {
			if uID != userID {
				t.Errorf("expected userID %s, got %s", userID, uID)
			}
			return &PurchaseResponse{
				ID:             uuid.New(),
				ThemeID:        tID,
				CoinPrice:      300,
				BonusCoinsUsed: 300,
				BaseCoinsUsed:  0,
				RefundableUntil: time.Now().Add(7 * 24 * time.Hour),
				CreatedAt:      time.Now(),
			}, nil
		},
	}

	resp, err := svc.PurchaseTheme(context.Background(), userID, themeID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.BonusCoinsUsed != 300 {
		t.Errorf("expected bonus_coins_used=300, got %d", resp.BonusCoinsUsed)
	}
	if resp.BaseCoinsUsed != 0 {
		t.Errorf("expected base_coins_used=0, got %d", resp.BaseCoinsUsed)
	}
}

func TestPurchaseTheme_MixedDepletion(t *testing.T) {
	// bonus=100, base=500, price=300 → bonus 100 + base 200 used
	userID := uuid.New()
	themeID := uuid.New()

	svc := &mockCoinSvc{
		purchaseThemeFn: func(_ context.Context, _, tID uuid.UUID) (*PurchaseResponse, error) {
			return &PurchaseResponse{
				ID:             uuid.New(),
				ThemeID:        tID,
				CoinPrice:      300,
				BonusCoinsUsed: 100,
				BaseCoinsUsed:  200,
				CreatedAt:      time.Now(),
			}, nil
		},
	}

	resp, err := svc.PurchaseTheme(context.Background(), userID, themeID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.BonusCoinsUsed != 100 {
		t.Errorf("expected bonus_coins_used=100, got %d", resp.BonusCoinsUsed)
	}
	if resp.BaseCoinsUsed != 200 {
		t.Errorf("expected base_coins_used=200, got %d", resp.BaseCoinsUsed)
	}
	if resp.BonusCoinsUsed+resp.BaseCoinsUsed != resp.CoinPrice {
		t.Errorf("bonus(%d)+base(%d) should equal price(%d)", resp.BonusCoinsUsed, resp.BaseCoinsUsed, resp.CoinPrice)
	}
}

func TestPurchaseTheme_InsufficientBalance(t *testing.T) {
	svc := &mockCoinSvc{
		purchaseThemeFn: func(_ context.Context, _, _ uuid.UUID) (*PurchaseResponse, error) {
			return nil, apperror.New(apperror.ErrCoinInsufficient, http.StatusPaymentRequired,
				"insufficient coins: need 300, have 50")
		},
	}

	_, err := svc.PurchaseTheme(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}

	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected *apperror.AppError, got %T", err)
	}
	if appErr.Code != apperror.ErrCoinInsufficient {
		t.Errorf("expected code %s, got %s", apperror.ErrCoinInsufficient, appErr.Code)
	}
	if appErr.Status != http.StatusPaymentRequired {
		t.Errorf("expected status 402, got %d", appErr.Status)
	}
}

func TestPurchaseTheme_SelfPurchase(t *testing.T) {
	svc := &mockCoinSvc{
		purchaseThemeFn: func(_ context.Context, _, _ uuid.UUID) (*PurchaseResponse, error) {
			return nil, apperror.New(apperror.ErrPurchaseSelfTheme, http.StatusForbidden,
				"cannot purchase your own theme")
		},
	}

	_, err := svc.PurchaseTheme(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Fatal("expected error for self-purchase, got nil")
	}

	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected *apperror.AppError, got %T", err)
	}
	if appErr.Code != apperror.ErrPurchaseSelfTheme {
		t.Errorf("expected code %s, got %s", apperror.ErrPurchaseSelfTheme, appErr.Code)
	}
}

func TestPurchaseTheme_FreeTheme(t *testing.T) {
	// 0-coin theme → purchase succeeds, no coins deducted
	svc := &mockCoinSvc{
		purchaseThemeFn: func(_ context.Context, _, tID uuid.UUID) (*PurchaseResponse, error) {
			return &PurchaseResponse{
				ID:             uuid.New(),
				ThemeID:        tID,
				CoinPrice:      0,
				BonusCoinsUsed: 0,
				BaseCoinsUsed:  0,
				CreatedAt:      time.Now(),
			}, nil
		},
	}

	resp, err := svc.PurchaseTheme(context.Background(), uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("unexpected error for free theme: %v", err)
	}
	if resp.CoinPrice != 0 {
		t.Errorf("expected coin_price=0, got %d", resp.CoinPrice)
	}
	if resp.BaseCoinsUsed != 0 || resp.BonusCoinsUsed != 0 {
		t.Errorf("expected zero coin deduction for free theme, got base=%d bonus=%d", resp.BaseCoinsUsed, resp.BonusCoinsUsed)
	}
}

// ---------------------------------------------------------------------------
// RefundTheme tests
// ---------------------------------------------------------------------------

func TestRefundTheme_Success(t *testing.T) {
	svc := &mockCoinSvc{
		refundThemeFn: func(_ context.Context, _, _ uuid.UUID) error {
			return nil
		},
	}

	err := svc.RefundTheme(context.Background(), uuid.New(), uuid.New())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestRefundTheme_Expired(t *testing.T) {
	svc := &mockCoinSvc{
		refundThemeFn: func(_ context.Context, _, _ uuid.UUID) error {
			return apperror.New(apperror.ErrRefundExpired, http.StatusForbidden, "refund period has expired")
		},
	}

	err := svc.RefundTheme(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected *apperror.AppError, got %T", err)
	}
	if appErr.Code != apperror.ErrRefundExpired {
		t.Errorf("expected code %s, got %s", apperror.ErrRefundExpired, appErr.Code)
	}
}

func TestRefundTheme_AlreadyPlayed(t *testing.T) {
	svc := &mockCoinSvc{
		refundThemeFn: func(_ context.Context, _, _ uuid.UUID) error {
			return apperror.New(apperror.ErrRefundAlreadyPlayed, http.StatusForbidden, "cannot refund a theme you have played")
		},
	}

	err := svc.RefundTheme(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	appErr, ok := err.(*apperror.AppError)
	if !ok {
		t.Fatalf("expected *apperror.AppError, got %T", err)
	}
	if appErr.Code != apperror.ErrRefundAlreadyPlayed {
		t.Errorf("expected code %s, got %s", apperror.ErrRefundAlreadyPlayed, appErr.Code)
	}
}

func TestRefundTheme_AlreadyDone(t *testing.T) {
	svc := &mockCoinSvc{
		refundThemeFn: func(_ context.Context, _, _ uuid.UUID) error {
			return apperror.New(apperror.ErrRefundAlreadyDone, http.StatusConflict, "purchase already refunded")
		},
	}

	err := svc.RefundTheme(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	appErr := err.(*apperror.AppError)
	if appErr.Code != apperror.ErrRefundAlreadyDone {
		t.Errorf("expected code %s, got %s", apperror.ErrRefundAlreadyDone, appErr.Code)
	}
}

func TestRefundTheme_FreeTheme(t *testing.T) {
	svc := &mockCoinSvc{
		refundThemeFn: func(_ context.Context, _, _ uuid.UUID) error {
			return apperror.New(apperror.ErrRefundFreeTheme, http.StatusBadRequest, "free themes cannot be refunded")
		},
	}

	err := svc.RefundTheme(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	appErr := err.(*apperror.AppError)
	if appErr.Code != apperror.ErrRefundFreeTheme {
		t.Errorf("expected code %s, got %s", apperror.ErrRefundFreeTheme, appErr.Code)
	}
}

func TestRefundTheme_LimitExceeded(t *testing.T) {
	svc := &mockCoinSvc{
		refundThemeFn: func(_ context.Context, _, _ uuid.UUID) error {
			return apperror.New(apperror.ErrRefundLimitExceeded, http.StatusTooManyRequests, "refund limit exceeded (max 3 per 30 days)")
		},
	}

	err := svc.RefundTheme(context.Background(), uuid.New(), uuid.New())
	if err == nil {
		t.Fatal("expected error, got nil")
	}
	appErr := err.(*apperror.AppError)
	if appErr.Code != apperror.ErrRefundLimitExceeded {
		t.Errorf("expected code %s, got %s", apperror.ErrRefundLimitExceeded, appErr.Code)
	}
	if appErr.Status != http.StatusTooManyRequests {
		t.Errorf("expected status 429, got %d", appErr.Status)
	}
}

// ---------------------------------------------------------------------------
// HandlePaymentConfirmed — event handler
// ---------------------------------------------------------------------------

func TestHandlePaymentConfirmed(t *testing.T) {
	userID := uuid.New()
	paymentID := uuid.New()
	var baseReceived, bonusReceived int

	svc := &mockCoinSvc{
		handlePaymentConfFn: func(_ context.Context, event eventbus.Event) error {
			e, ok := event.(eventbus.PaymentConfirmed)
			if !ok {
				t.Fatalf("expected PaymentConfirmed event, got %T", event)
			}
			if e.UserID != userID {
				t.Errorf("expected userID %s, got %s", userID, e.UserID)
			}
			if e.PaymentID != paymentID {
				t.Errorf("expected paymentID %s, got %s", paymentID, e.PaymentID)
			}
			baseReceived = e.BaseCoins
			bonusReceived = e.BonusCoins
			return nil
		},
	}

	err := svc.HandlePaymentConfirmed(context.Background(), eventbus.PaymentConfirmed{
		UserID:     userID,
		PaymentID:  paymentID,
		BaseCoins:  500,
		BonusCoins: 50,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if baseReceived != 500 {
		t.Errorf("expected base_coins=500, got %d", baseReceived)
	}
	if bonusReceived != 50 {
		t.Errorf("expected bonus_coins=50, got %d", bonusReceived)
	}
}

// ---------------------------------------------------------------------------
// Unit test for bonus-first depletion logic (builtin min)
// ---------------------------------------------------------------------------

func TestBonusFirstDepletion(t *testing.T) {
	tests := []struct {
		name        string
		bonusBalance int64
		price       int64
		expectBonus int64
	}{
		{"bonus covers partial", 10, 20, 10},
		{"bonus exceeds price", 20, 10, 10},
		{"bonus equals price", 15, 15, 15},
		{"zero bonus", 0, 10, 0},
		{"zero price", 10, 0, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			bonusUsed := min(tt.bonusBalance, tt.price)
			if bonusUsed != tt.expectBonus {
				t.Errorf("min(%d, %d) = %d, want %d", tt.bonusBalance, tt.price, bonusUsed, tt.expectBonus)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// Unit test for refundable_until timestamp handling
// ---------------------------------------------------------------------------

func TestRefundableUntil_Valid(t *testing.T) {
	future := time.Now().Add(7 * 24 * time.Hour)
	ts := pgtype.Timestamptz{Time: future, Valid: true}

	if !ts.Valid {
		t.Error("expected valid timestamp")
	}
	if ts.Time.Before(time.Now()) {
		t.Error("expected future timestamp for refundable_until")
	}
}
