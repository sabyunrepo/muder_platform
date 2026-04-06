package creator

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
)

// Settlement pipeline constants.
const (
	CoinToKRWRate     = 12.5
	MinSettlementKRW  = 10000
	IndividualTaxRate = 0.033
	BusinessTaxRate   = 0.10
	SettlementLockKey = "settlement:weekly"
	SettlementLockTTL = 10 * time.Minute
)

// SettlementPipeline runs weekly settlement batch processing.
type SettlementPipeline struct {
	queries *db.Queries
	redis   *redis.Client
	logger  zerolog.Logger
}

// NewSettlementPipeline creates a new settlement pipeline.
func NewSettlementPipeline(queries *db.Queries, rdb *redis.Client, logger zerolog.Logger) *SettlementPipeline {
	return &SettlementPipeline{
		queries: queries,
		redis:   rdb,
		logger:  logger.With().Str("component", "settlement_pipeline").Logger(),
	}
}

// RunWeekly executes the weekly settlement batch.
// It collects unsettled earnings older than 7 days, groups by creator,
// calculates tax, and creates settlement records.
func (p *SettlementPipeline) RunWeekly(ctx context.Context) error {
	// 1. Acquire advisory lock to prevent duplicate runs.
	locked, err := p.redis.SetNX(ctx, SettlementLockKey, "running", SettlementLockTTL).Result()
	if err != nil {
		p.logger.Error().Err(err).Msg("failed to acquire settlement lock")
		return fmt.Errorf("failed to acquire settlement lock: %w", err)
	}
	if !locked {
		p.logger.Warn().Msg("settlement already running, skipping")
		return fmt.Errorf("settlement already running")
	}
	defer func() {
		if delErr := p.redis.Del(ctx, SettlementLockKey).Err(); delErr != nil {
			p.logger.Error().Err(delErr).Msg("failed to release settlement lock")
		}
	}()

	p.logger.Info().Msg("starting weekly settlement")

	// 2. Collect unsettled earnings grouped by creator.
	unsettled, err := p.queries.CollectUnsettledEarnings(ctx)
	if err != nil {
		p.logger.Error().Err(err).Msg("failed to collect unsettled earnings")
		return fmt.Errorf("failed to collect unsettled earnings: %w", err)
	}

	if len(unsettled) == 0 {
		p.logger.Info().Msg("no unsettled earnings found")
		return nil
	}

	now := time.Now()
	periodEnd := now.Format("2006-01-02")
	periodStart := now.AddDate(0, 0, -7).Format("2006-01-02")

	var settled, skipped int

	// 3. Process each creator's unsettled earnings.
	for _, row := range unsettled {
		totalKRW := int32(float64(row.TotalCreatorCoins) * CoinToKRWRate)

		// Skip if below minimum settlement threshold (carry over to next week).
		if int(totalKRW) < MinSettlementKRW {
			p.logger.Debug().
				Str("creator_id", row.CreatorID.String()).
				Int32("total_krw", totalKRW).
				Msg("below minimum settlement, carrying over")
			skipped++
			continue
		}

		// Tax calculation (default: individual 3.3%).
		taxType := "INDIVIDUAL"
		taxRate := IndividualTaxRate
		taxAmount := int32(float64(totalKRW) * taxRate)
		netAmount := totalKRW - taxAmount

		// Create settlement record.
		settlement, err := p.queries.CreateSettlement(ctx, db.CreateSettlementParams{
			CreatorID:   row.CreatorID,
			PeriodStart: periodStart,
			PeriodEnd:   periodEnd,
			TotalCoins:  int32(row.TotalCreatorCoins),
			TotalKRW:    totalKRW,
			TaxType:     taxType,
			TaxRate:     taxRate,
			TaxAmount:   taxAmount,
			NetAmount:   netAmount,
		})
		if err != nil {
			p.logger.Error().Err(err).
				Str("creator_id", row.CreatorID.String()).
				Msg("failed to create settlement")
			continue
		}

		// Mark related earnings as settled.
		if err := p.queries.SettleEarnings(ctx, row.CreatorID, settlement.ID); err != nil {
			p.logger.Error().Err(err).
				Str("creator_id", row.CreatorID.String()).
				Str("settlement_id", settlement.ID.String()).
				Msg("failed to settle earnings")
			continue
		}

		p.logger.Info().
			Str("creator_id", row.CreatorID.String()).
			Str("settlement_id", settlement.ID.String()).
			Int32("total_krw", totalKRW).
			Int32("net_amount", netAmount).
			Msg("settlement created")
		settled++
	}

	p.logger.Info().
		Int("settled", settled).
		Int("skipped", skipped).
		Int("total_creators", len(unsettled)).
		Msg("weekly settlement completed")
	return nil
}

// CancelAndRestore cancels a settlement and restores earnings to unsettled state [S8].
func (p *SettlementPipeline) CancelAndRestore(ctx context.Context, settlementID uuid.UUID) error {
	// Cancel the settlement record.
	_, err := p.queries.CancelSettlement(ctx, settlementID)
	if err != nil {
		p.logger.Error().Err(err).Str("settlement_id", settlementID.String()).Msg("failed to cancel settlement")
		return fmt.Errorf("failed to cancel settlement: %w", err)
	}

	// Restore earnings to unsettled state.
	if err := p.queries.UnsettleEarningsBySettlement(ctx, settlementID); err != nil {
		p.logger.Error().Err(err).Str("settlement_id", settlementID.String()).Msg("failed to unsettle earnings")
		return fmt.Errorf("failed to unsettle earnings: %w", err)
	}

	p.logger.Info().Str("settlement_id", settlementID.String()).Msg("settlement cancelled and earnings restored")
	return nil
}
