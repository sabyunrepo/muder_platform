package creator

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/db"
)

// Settlement pipeline constants.
const (
	// CoinToKRWNumerator / CoinToKRWDenominator = 12.5 KRW per coin (integer arithmetic).
	CoinToKRWNumerator         = 125
	CoinToKRWDenominator       = 10
	MinSettlementKRW     int64 = 10000
	IndividualTaxRate          = 0.033
	BusinessTaxRate            = 0.10
	SettlementLockKey          = "settlement:weekly"
	SettlementLockTTL          = 10 * time.Minute
)

// SettlementPipeline runs weekly settlement batch processing.
type SettlementPipeline struct {
	queries *db.Queries
	pool    *pgxpool.Pool
	redis   *redis.Client
	logger  zerolog.Logger
}

// NewSettlementPipeline creates a new settlement pipeline.
func NewSettlementPipeline(queries *db.Queries, pool *pgxpool.Pool, rdb *redis.Client, logger zerolog.Logger) *SettlementPipeline {
	return &SettlementPipeline{
		queries: queries,
		pool:    pool,
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
	periodEndTime := now
	periodStartTime := now.AddDate(0, 0, -7)

	var settled, skipped int

	// 3. Process each creator's unsettled earnings.
	for _, row := range unsettled {
		// H1: Integer arithmetic to avoid float64 precision loss. int64 to prevent overflow.
		totalKRW := int64(row.TotalCreatorCoins) * CoinToKRWNumerator / CoinToKRWDenominator

		// Skip if below minimum settlement threshold (carry over to next week).
		if totalKRW < MinSettlementKRW {
			p.logger.Debug().
				Str("creator_id", row.CreatorID.String()).
				Int64("total_krw", totalKRW).
				Msg("below minimum settlement, carrying over")
			skipped++
			continue
		}

		// Tax calculation (default: individual 3.3%).
		taxType := "INDIVIDUAL"
		taxRate := IndividualTaxRate
		// Tax truncation policy: truncate toward zero (floor).
		// Example: 10,012 KRW × 3.3% = 330.396 → 330 KRW
		// This is intentional — we never overcharge tax.
		taxAmount := int64(float64(totalKRW) * taxRate)
		netAmount := totalKRW - taxAmount

		// C1: Wrap CreateSettlement + SettleEarnings in a per-creator transaction.
		if err := func() error {
			tx, txErr := p.pool.BeginTx(ctx, pgx.TxOptions{})
			if txErr != nil {
				return fmt.Errorf("begin tx: %w", txErr)
			}
			defer tx.Rollback(ctx) //nolint:errcheck

			qtx := p.queries.WithTx(tx)

			var taxRateNumeric pgtype.Numeric
			if encErr := taxRateNumeric.Scan(strconv.FormatFloat(taxRate, 'f', 6, 64)); encErr != nil {
				return fmt.Errorf("encode tax rate: %w", encErr)
			}
			settlement, createErr := qtx.CreateSettlement(ctx, db.CreateSettlementParams{
				CreatorID:   row.CreatorID,
				PeriodStart: pgtype.Date{Time: periodStartTime, Valid: true},
				PeriodEnd:   pgtype.Date{Time: periodEndTime, Valid: true},
				TotalCoins:  int32(row.TotalCreatorCoins),
				TotalKrw:    int32(totalKRW),
				TaxType:     taxType,
				TaxRate:     taxRateNumeric,
				TaxAmount:   int32(taxAmount),
				NetAmount:   int32(netAmount),
			})
			if createErr != nil {
				return fmt.Errorf("create settlement: %w", createErr)
			}

			if settleErr := qtx.SettleEarnings(ctx, db.SettleEarningsParams{
				CreatorID:    row.CreatorID,
				SettlementID: pgtype.UUID{Bytes: settlement.ID, Valid: true},
			}); settleErr != nil {
				return fmt.Errorf("settle earnings: %w", settleErr)
			}

			if commitErr := tx.Commit(ctx); commitErr != nil {
				return fmt.Errorf("commit: %w", commitErr)
			}

			p.logger.Info().
				Str("creator_id", row.CreatorID.String()).
				Str("settlement_id", settlement.ID.String()).
				Int64("total_krw", totalKRW).
				Int64("net_amount", netAmount).
				Msg("settlement created")
			return nil
		}(); err != nil {
			p.logger.Error().Err(err).
				Str("creator_id", row.CreatorID.String()).
				Msg("failed to process settlement")
			continue
		}

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
// C2: Both operations are wrapped in a single transaction to prevent data inconsistency.
func (p *SettlementPipeline) CancelAndRestore(ctx context.Context, settlementID uuid.UUID) error {
	tx, err := p.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		p.logger.Error().Err(err).Str("settlement_id", settlementID.String()).Msg("failed to begin transaction")
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	qtx := p.queries.WithTx(tx)

	// Cancel the settlement record.
	if _, err := qtx.CancelSettlement(ctx, settlementID); err != nil {
		p.logger.Error().Err(err).Str("settlement_id", settlementID.String()).Msg("failed to cancel settlement")
		return fmt.Errorf("failed to cancel settlement: %w", err)
	}

	// Restore earnings to unsettled state.
	if err := qtx.UnsettleEarningsBySettlement(ctx, pgtype.UUID{Bytes: settlementID, Valid: true}); err != nil {
		p.logger.Error().Err(err).Str("settlement_id", settlementID.String()).Msg("failed to unsettle earnings")
		return fmt.Errorf("failed to unsettle earnings: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		p.logger.Error().Err(err).Str("settlement_id", settlementID.String()).Msg("failed to commit cancel transaction")
		return fmt.Errorf("failed to commit cancel transaction: %w", err)
	}

	p.logger.Info().Str("settlement_id", settlementID.String()).Msg("settlement cancelled and earnings restored")
	return nil
}
