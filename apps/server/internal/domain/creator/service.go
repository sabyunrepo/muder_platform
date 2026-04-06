package creator

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/eventbus"
)

// CreatorService defines creator earnings and settlement operations.
type CreatorService interface {
	GetDashboard(ctx context.Context, creatorID uuid.UUID) (*DashboardResponse, error)
	GetThemeStats(ctx context.Context, creatorID, themeID uuid.UUID, from, to time.Time) ([]DailyStatResponse, error)
	ListEarnings(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]EarningResponse, int64, error)
	ListSettlements(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]SettlementResponse, int64, error)
	// EventBus handlers.
	HandleThemePurchased(ctx context.Context, event eventbus.Event) error
	HandleThemeRefunded(ctx context.Context, event eventbus.Event) error
}

// creatorService implements CreatorService.
type creatorService struct {
	queries *db.Queries
	logger  zerolog.Logger
}

// NewService creates a new creator service.
func NewService(queries *db.Queries, logger zerolog.Logger) CreatorService {
	return &creatorService{
		queries: queries,
		logger:  logger.With().Str("domain", "creator").Logger(),
	}
}

// creatorSharePercent is the creator's revenue share (70%).
const creatorSharePercent = 70

func (s *creatorService) GetDashboard(ctx context.Context, creatorID uuid.UUID) (*DashboardResponse, error) {
	row, err := s.queries.GetCreatorDashboard(ctx, creatorID)
	if err != nil {
		s.logger.Error().Err(err).Str("creator_id", creatorID.String()).Msg("failed to get dashboard")
		return nil, fmt.Errorf("failed to get creator dashboard: %w", err)
	}
	return &DashboardResponse{
		TotalEarnings:     row.TotalEarnings,
		UnsettledEarnings: row.Unsettled,
		TotalSales:        row.TotalSales,
	}, nil
}

func (s *creatorService) GetThemeStats(ctx context.Context, creatorID, themeID uuid.UUID, from, to time.Time) ([]DailyStatResponse, error) {
	rows, err := s.queries.GetThemeDailyStats(ctx, themeID, creatorID, from, to)
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to get theme stats")
		return nil, fmt.Errorf("failed to get theme stats: %w", err)
	}
	result := make([]DailyStatResponse, 0, len(rows))
	for _, r := range rows {
		result = append(result, DailyStatResponse{
			Date:          r.StatDate.Format("2006-01-02"),
			SalesCount:    r.SalesCount,
			DailyEarnings: r.DailyEarnings,
		})
	}
	return result, nil
}

func (s *creatorService) ListEarnings(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]EarningResponse, int64, error) {
	rows, err := s.queries.ListEarningsByCreator(ctx, creatorID, limit, offset)
	if err != nil {
		s.logger.Error().Err(err).Str("creator_id", creatorID.String()).Msg("failed to list earnings")
		return nil, 0, fmt.Errorf("failed to list earnings: %w", err)
	}
	total, err := s.queries.CountEarningsByCreator(ctx, creatorID)
	if err != nil {
		s.logger.Error().Err(err).Str("creator_id", creatorID.String()).Msg("failed to count earnings")
		return nil, 0, fmt.Errorf("failed to count earnings: %w", err)
	}
	result := make([]EarningResponse, 0, len(rows))
	for _, r := range rows {
		result = append(result, EarningResponse{
			ID:                 r.ID,
			ThemeID:            r.ThemeID,
			ThemeTitle:         r.ThemeTitle,
			TotalCoins:         r.TotalCoins,
			CreatorShareCoins:  r.CreatorShareCoins,
			PlatformShareCoins: r.PlatformShareCoins,
			Settled:            r.Settled,
			CreatedAt:          r.CreatedAt,
		})
	}
	return result, total, nil
}

func (s *creatorService) ListSettlements(ctx context.Context, creatorID uuid.UUID, limit, offset int32) ([]SettlementResponse, int64, error) {
	rows, err := s.queries.ListSettlementsByCreator(ctx, creatorID, limit, offset)
	if err != nil {
		s.logger.Error().Err(err).Str("creator_id", creatorID.String()).Msg("failed to list settlements")
		return nil, 0, fmt.Errorf("failed to list settlements: %w", err)
	}
	total, err := s.queries.CountSettlementsByCreator(ctx, creatorID)
	if err != nil {
		s.logger.Error().Err(err).Str("creator_id", creatorID.String()).Msg("failed to count settlements")
		return nil, 0, fmt.Errorf("failed to count settlements: %w", err)
	}
	result := make([]SettlementResponse, 0, len(rows))
	for _, r := range rows {
		result = append(result, toSettlementResponse(r))
	}
	return result, total, nil
}

func (s *creatorService) HandleThemePurchased(ctx context.Context, event eventbus.Event) error {
	e, ok := event.(eventbus.ThemePurchased)
	if !ok {
		return fmt.Errorf("unexpected event type: %T", event)
	}

	creatorShare := int32(e.TotalCoins) * creatorSharePercent / 100
	platformShare := int32(e.TotalCoins) - creatorShare

	_, err := s.queries.CreateEarning(ctx, db.CreateEarningParams{
		CreatorID:          e.CreatorID,
		ThemeID:            e.ThemeID,
		PurchaseID:         e.PurchaseID,
		TotalCoins:         int32(e.TotalCoins),
		CreatorShareCoins:  creatorShare,
		PlatformShareCoins: platformShare,
	})
	if err != nil {
		s.logger.Error().Err(err).
			Str("purchase_id", e.PurchaseID.String()).
			Str("creator_id", e.CreatorID.String()).
			Msg("failed to create earning")
		return fmt.Errorf("failed to create earning: %w", err)
	}

	s.logger.Info().
		Str("purchase_id", e.PurchaseID.String()).
		Str("creator_id", e.CreatorID.String()).
		Int32("creator_share", creatorShare).
		Int32("platform_share", platformShare).
		Msg("earning created")
	return nil
}

func (s *creatorService) HandleThemeRefunded(ctx context.Context, event eventbus.Event) error {
	e, ok := event.(eventbus.ThemeRefunded)
	if !ok {
		return fmt.Errorf("unexpected event type: %T", event)
	}

	err := s.queries.DeleteEarningByPurchase(ctx, e.PurchaseID)
	if err != nil {
		s.logger.Error().Err(err).
			Str("purchase_id", e.PurchaseID.String()).
			Msg("failed to delete earning on refund")
		return fmt.Errorf("failed to delete earning: %w", err)
	}

	s.logger.Info().
		Str("purchase_id", e.PurchaseID.String()).
		Str("creator_id", e.CreatorID.String()).
		Msg("earning deleted due to refund")
	return nil
}

// toSettlementResponse converts a DB Settlement to a response DTO.
func toSettlementResponse(s db.Settlement) SettlementResponse {
	resp := SettlementResponse{
		ID:          s.ID,
		PeriodStart: s.PeriodStart,
		PeriodEnd:   s.PeriodEnd,
		TotalCoins:  s.TotalCoins,
		TotalKRW:    s.TotalKRW,
		TaxType:     s.TaxType,
		TaxRate:     s.TaxRate,
		TaxAmount:   s.TaxAmount,
		NetAmount:   s.NetAmount,
		Status:      s.Status,
		CreatedAt:   s.CreatedAt,
	}
	if s.ApprovedAt.Valid {
		t := s.ApprovedAt.Time
		resp.ApprovedAt = &t
	}
	if s.PaidOutAt.Valid {
		t := s.PaidOutAt.Time
		resp.PaidOutAt = &t
	}
	return resp
}
