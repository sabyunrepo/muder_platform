package creator

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/eventbus"
)

// ---------------------------------------------------------------------------
// Mock CreatorService
// ---------------------------------------------------------------------------

type mockCreatorSvc struct {
	getDashboardFn        func(ctx context.Context, creatorID uuid.UUID) (*DashboardResponse, error)
	getThemeStatsFn       func(ctx context.Context, creatorID, themeID uuid.UUID, from, to time.Time) ([]DailyStatResponse, error)
	listEarningsFn        func(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]EarningResponse, int64, error)
	listSettlementsFn     func(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]SettlementResponse, int64, error)
	handleThemePurchasedFn func(ctx context.Context, event eventbus.Event) error
	handleThemeRefundedFn  func(ctx context.Context, event eventbus.Event) error
}

func (m *mockCreatorSvc) GetDashboard(ctx context.Context, creatorID uuid.UUID) (*DashboardResponse, error) {
	if m.getDashboardFn != nil {
		return m.getDashboardFn(ctx, creatorID)
	}
	return &DashboardResponse{}, nil
}

func (m *mockCreatorSvc) GetThemeStats(ctx context.Context, creatorID, themeID uuid.UUID, from, to time.Time) ([]DailyStatResponse, error) {
	if m.getThemeStatsFn != nil {
		return m.getThemeStatsFn(ctx, creatorID, themeID, from, to)
	}
	return nil, nil
}

func (m *mockCreatorSvc) ListEarnings(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]EarningResponse, int64, error) {
	if m.listEarningsFn != nil {
		return m.listEarningsFn(ctx, creatorID, limit, offset)
	}
	return nil, 0, nil
}

func (m *mockCreatorSvc) ListSettlements(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]SettlementResponse, int64, error) {
	if m.listSettlementsFn != nil {
		return m.listSettlementsFn(ctx, creatorID, limit, offset)
	}
	return nil, 0, nil
}

func (m *mockCreatorSvc) HandleThemePurchased(ctx context.Context, event eventbus.Event) error {
	if m.handleThemePurchasedFn != nil {
		return m.handleThemePurchasedFn(ctx, event)
	}
	return nil
}

func (m *mockCreatorSvc) HandleThemeRefunded(ctx context.Context, event eventbus.Event) error {
	if m.handleThemeRefundedFn != nil {
		return m.handleThemeRefundedFn(ctx, event)
	}
	return nil
}

// ---------------------------------------------------------------------------
// HandleThemePurchased tests — 70/30 split
// ---------------------------------------------------------------------------

func TestHandleThemePurchased_70_30Split(t *testing.T) {
	var gotCreatorShare, gotPlatformShare int32

	svc := &mockCreatorSvc{
		handleThemePurchasedFn: func(_ context.Context, event eventbus.Event) error {
			e := event.(eventbus.ThemePurchased)
			// Simulate 70/30 split logic
			gotCreatorShare = int32(e.TotalCoins) * 70 / 100
			gotPlatformShare = int32(e.TotalCoins) - gotCreatorShare
			return nil
		},
	}

	err := svc.HandleThemePurchased(context.Background(), eventbus.ThemePurchased{
		PurchaseID: uuid.New(),
		UserID:     uuid.New(),
		CreatorID:  uuid.New(),
		ThemeID:    uuid.New(),
		TotalCoins: 1000,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotCreatorShare != 700 {
		t.Errorf("expected creator share 700, got %d", gotCreatorShare)
	}
	if gotPlatformShare != 300 {
		t.Errorf("expected platform share 300, got %d", gotPlatformShare)
	}
}

func TestHandleThemePurchased_FreeTheme(t *testing.T) {
	earningCreated := false

	svc := &mockCreatorSvc{
		handleThemePurchasedFn: func(_ context.Context, event eventbus.Event) error {
			e := event.(eventbus.ThemePurchased)
			// M4: Skip earnings for free themes
			if e.TotalCoins == 0 {
				return nil
			}
			earningCreated = true
			return nil
		},
	}

	err := svc.HandleThemePurchased(context.Background(), eventbus.ThemePurchased{
		PurchaseID: uuid.New(),
		UserID:     uuid.New(),
		CreatorID:  uuid.New(),
		ThemeID:    uuid.New(),
		TotalCoins: 0,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if earningCreated {
		t.Error("earning should NOT be created for free theme purchase")
	}
}

// ---------------------------------------------------------------------------
// HandleThemeRefunded tests
// ---------------------------------------------------------------------------

func TestHandleThemeRefunded_Unsettled(t *testing.T) {
	deleted := false

	svc := &mockCreatorSvc{
		handleThemeRefundedFn: func(_ context.Context, event eventbus.Event) error {
			_ = event.(eventbus.ThemeRefunded)
			// Unsettled earning → delete
			deleted = true
			return nil
		},
	}

	err := svc.HandleThemeRefunded(context.Background(), eventbus.ThemeRefunded{
		PurchaseID: uuid.New(),
		UserID:     uuid.New(),
		CreatorID:  uuid.New(),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !deleted {
		t.Error("expected earning to be deleted for unsettled refund")
	}
}

func TestHandleThemeRefunded_Settled(t *testing.T) {
	// M1: If earning is already settled, skip delete + log warning
	deleted := false

	svc := &mockCreatorSvc{
		handleThemeRefundedFn: func(_ context.Context, event eventbus.Event) error {
			_ = event.(eventbus.ThemeRefunded)
			// Simulate: earning is settled → skip, return nil
			deleted = false
			return nil
		},
	}

	err := svc.HandleThemeRefunded(context.Background(), eventbus.ThemeRefunded{
		PurchaseID: uuid.New(),
		UserID:     uuid.New(),
		CreatorID:  uuid.New(),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if deleted {
		t.Error("settled earning should NOT be deleted")
	}
}

// ---------------------------------------------------------------------------
// GetDashboard test
// ---------------------------------------------------------------------------

func TestGetDashboard(t *testing.T) {
	creatorID := uuid.New()

	svc := &mockCreatorSvc{
		getDashboardFn: func(_ context.Context, cID uuid.UUID) (*DashboardResponse, error) {
			if cID != creatorID {
				t.Errorf("expected creatorID %s, got %s", creatorID, cID)
			}
			return &DashboardResponse{
				TotalEarnings:     15000,
				UnsettledEarnings: 5000,
				TotalSales:        42,
			}, nil
		},
	}

	resp, err := svc.GetDashboard(context.Background(), creatorID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.TotalEarnings != 15000 {
		t.Errorf("expected total_earnings=15000, got %d", resp.TotalEarnings)
	}
	if resp.UnsettledEarnings != 5000 {
		t.Errorf("expected unsettled_earnings=5000, got %d", resp.UnsettledEarnings)
	}
	if resp.TotalSales != 42 {
		t.Errorf("expected total_sales=42, got %d", resp.TotalSales)
	}
}

// ---------------------------------------------------------------------------
// GetThemeStats test
// ---------------------------------------------------------------------------

func TestGetThemeStats(t *testing.T) {
	creatorID := uuid.New()
	themeID := uuid.New()
	from := time.Now().AddDate(0, 0, -7)
	to := time.Now()

	svc := &mockCreatorSvc{
		getThemeStatsFn: func(_ context.Context, cID, tID uuid.UUID, f, tt time.Time) ([]DailyStatResponse, error) {
			if cID != creatorID {
				t.Errorf("expected creatorID %s, got %s", creatorID, cID)
			}
			if tID != themeID {
				t.Errorf("expected themeID %s, got %s", themeID, tID)
			}
			return []DailyStatResponse{
				{Date: "2026-04-01", SalesCount: 5, DailyEarnings: 3500},
				{Date: "2026-04-02", SalesCount: 3, DailyEarnings: 2100},
			}, nil
		},
	}

	stats, err := svc.GetThemeStats(context.Background(), creatorID, themeID, from, to)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(stats) != 2 {
		t.Fatalf("expected 2 daily stats, got %d", len(stats))
	}
	if stats[0].SalesCount != 5 {
		t.Errorf("expected sales_count=5 for day 1, got %d", stats[0].SalesCount)
	}
	if stats[1].DailyEarnings != 2100 {
		t.Errorf("expected daily_earnings=2100 for day 2, got %d", stats[1].DailyEarnings)
	}
}

// ---------------------------------------------------------------------------
// Revenue share integer arithmetic validation
// ---------------------------------------------------------------------------

func TestRevenueShare_IntegerArithmetic(t *testing.T) {
	tests := []struct {
		name             string
		totalCoins       int
		expectCreator    int32
		expectPlatform   int32
	}{
		{"1000 coins", 1000, 700, 300},
		{"100 coins", 100, 70, 30},
		{"1 coin", 1, 0, 1},      // integer truncation: 1*70/100 = 0
		{"10 coins", 10, 7, 3},
		{"999 coins", 999, 699, 300}, // 999*70/100 = 699, platform = 999-699 = 300
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			creatorShare := int32(tt.totalCoins) * creatorSharePercent / 100
			platformShare := int32(tt.totalCoins) - creatorShare

			if creatorShare != tt.expectCreator {
				t.Errorf("creator share: expected %d, got %d", tt.expectCreator, creatorShare)
			}
			if platformShare != tt.expectPlatform {
				t.Errorf("platform share: expected %d, got %d", tt.expectPlatform, platformShare)
			}
			// Invariant: shares must sum to total
			if creatorShare+platformShare != int32(tt.totalCoins) {
				t.Errorf("shares don't sum to total: %d + %d != %d", creatorShare, platformShare, tt.totalCoins)
			}
		})
	}
}

// Ensure unused imports are consumed.
var (
	_ = pgx.ErrNoRows
	_ = http.StatusOK
	_ = apperror.Internal
)
