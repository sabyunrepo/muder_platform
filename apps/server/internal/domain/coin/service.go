package coin

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/eventbus"
)

// CoinService defines coin-related domain operations.
type CoinService interface {
	GetBalance(ctx context.Context, userID uuid.UUID) (*BalanceResponse, error)
	ListTransactions(ctx context.Context, userID uuid.UUID, txType string, limit, offset int32) ([]TransactionResponse, int64, error)
	PurchaseTheme(ctx context.Context, userID uuid.UUID, themeID uuid.UUID) (*PurchaseResponse, error)
	RefundTheme(ctx context.Context, userID uuid.UUID, purchaseID uuid.UUID) error
	ListPurchasedThemes(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]PurchasedThemeResponse, int64, error)
	HandlePaymentConfirmed(ctx context.Context, event eventbus.Event) error
	HandleGameStarted(ctx context.Context, event eventbus.Event) error
}

// coinService implements CoinService.
type coinService struct {
	pool    *pgxpool.Pool
	queries *db.Queries
	bus     *eventbus.Bus
	logger  zerolog.Logger
}

// NewService creates a new coin service.
func NewService(pool *pgxpool.Pool, queries *db.Queries, bus *eventbus.Bus, logger zerolog.Logger) CoinService {
	return &coinService{
		pool:    pool,
		queries: queries,
		bus:     bus,
		logger:  logger.With().Str("domain", "coin").Logger(),
	}
}

// GetBalance returns the user's current coin balance.
func (s *coinService) GetBalance(ctx context.Context, userID uuid.UUID) (*BalanceResponse, error) {
	bal, err := s.queries.GetCoinBalance(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("user not found")
		}
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to get coin balance")
		return nil, apperror.Internal("failed to get coin balance")
	}

	return &BalanceResponse{
		BaseCoins:  bal.CoinBalanceBase,
		BonusCoins: bal.CoinBalanceBonus,
		TotalCoins: bal.CoinBalanceBase + bal.CoinBalanceBonus,
	}, nil
}

// ListTransactions returns a paginated list of the user's coin transactions.
func (s *coinService) ListTransactions(ctx context.Context, userID uuid.UUID, txType string, limit, offset int32) ([]TransactionResponse, int64, error) {
	var (
		txns []db.CoinTransaction
		err  error
	)

	if txType == "" {
		txns, err = s.queries.ListCoinTransactions(ctx, db.ListCoinTransactionsParams{
			UserID: userID,
			Limit:  limit,
			Offset: offset,
		})
	} else {
		txns, err = s.queries.ListCoinTransactionsByType(ctx, db.ListCoinTransactionsByTypeParams{
			UserID: userID,
			Type:   txType,
			Limit:  limit,
			Offset: offset,
		})
	}
	if err != nil {
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to list coin transactions")
		return nil, 0, apperror.Internal("failed to list transactions")
	}

	total, err := s.queries.CountCoinTransactions(ctx, userID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to count coin transactions")
		return nil, 0, apperror.Internal("failed to count transactions")
	}

	items := make([]TransactionResponse, len(txns))
	for i, t := range txns {
		items[i] = TransactionResponse{
			ID:                t.ID,
			Type:              t.Type,
			BaseAmount:        int(t.BaseAmount),
			BonusAmount:       int(t.BonusAmount),
			BalanceAfterBase:  t.BalanceAfterBase,
			BalanceAfterBonus: t.BalanceAfterBonus,
			ReferenceType:     t.ReferenceType,
			ReferenceID:       t.ReferenceID,
			Description:       t.Description,
			CreatedAt:         t.CreatedAt,
		}
	}
	return items, total, nil
}

// PurchaseTheme purchases a theme for the user using coins.
// Security: [S3] self-purchase prevention, [S5] free theme handling.
func (s *coinService) PurchaseTheme(ctx context.Context, userID uuid.UUID, themeID uuid.UUID) (*PurchaseResponse, error) {
	// Fetch theme to get price and creator.
	theme, err := s.queries.GetTheme(ctx, themeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Stringer("theme_id", themeID).Msg("failed to get theme")
		return nil, apperror.Internal("failed to get theme")
	}

	// [S3] Creator cannot purchase their own theme.
	if theme.CreatorID == userID {
		return nil, apperror.New(apperror.ErrPurchaseSelfTheme, http.StatusForbidden, "cannot purchase your own theme")
	}

	// Check for existing purchase (unique constraint: user_id + theme_id).
	_, err = s.queries.GetThemePurchaseByUserTheme(ctx, db.GetThemePurchaseByUserThemeParams{
		UserID:  userID,
		ThemeID: themeID,
	})
	if err == nil {
		return nil, apperror.New(apperror.ErrPurchaseAlreadyOwned, http.StatusConflict, "theme already purchased")
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		s.logger.Error().Err(err).Msg("failed to check existing purchase")
		return nil, apperror.Internal("failed to check existing purchase")
	}

	coinPrice := theme.CoinPrice

	// Free theme: create purchase directly without transaction.
	if coinPrice == 0 {
		purchase, err := s.queries.CreateThemePurchase(ctx, db.CreateThemePurchaseParams{
			UserID:         userID,
			ThemeID:        themeID,
			CoinPrice:      0,
			BaseCoinsUsed:  0,
			BonusCoinsUsed: 0,
		})
		if err != nil {
			s.logger.Error().Err(err).Msg("failed to create free theme purchase")
			return nil, apperror.Internal("failed to purchase theme")
		}

		_ = s.bus.Publish(ctx, eventbus.ThemePurchased{
			PurchaseID: purchase.ID,
			UserID:     userID,
			CreatorID:  theme.CreatorID,
			ThemeID:    themeID,
			TotalCoins: 0,
		})

		return s.toPurchaseResponse(purchase), nil
	}

	// Paid theme: use transaction with FOR UPDATE.
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to begin tx for purchase")
		return nil, apperror.Internal("failed to purchase theme")
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	txQueries := s.queries.WithTx(tx)

	// Lock user row for balance update.
	user, err := txQueries.GetUserForCoinUpdate(ctx, userID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to lock user for coin update")
		return nil, apperror.Internal("failed to purchase theme")
	}

	totalBalance := user.CoinBalanceBase + user.CoinBalanceBonus
	price := int64(coinPrice)

	if totalBalance < price {
		return nil, apperror.New(apperror.ErrCoinInsufficient, http.StatusPaymentRequired,
			fmt.Sprintf("insufficient coins: need %d, have %d", price, totalBalance))
	}

	// Bonus-first depletion strategy.
	bonusUsed := min64(user.CoinBalanceBonus, price)
	baseUsed := price - bonusUsed

	// Deduct coins.
	err = txQueries.AddCoinBalance(ctx, db.AddCoinBalanceParams{
		ID:               userID,
		CoinBalanceBase:  -baseUsed,
		CoinBalanceBonus: -bonusUsed,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to deduct coin balance")
		return nil, apperror.Internal("failed to purchase theme")
	}

	balanceAfterBase := user.CoinBalanceBase - baseUsed
	balanceAfterBonus := user.CoinBalanceBonus - bonusUsed

	// Record transaction.
	refType := "THEME"
	refID := themeID.String()
	desc := fmt.Sprintf("Theme purchase: %s", theme.Title)
	_, err = txQueries.CreateCoinTransaction(ctx, db.CreateCoinTransactionParams{
		UserID:            userID,
		Type:              "PURCHASE",
		BaseAmount:        int32(-baseUsed),
		BonusAmount:       int32(-bonusUsed),
		BalanceAfterBase:  balanceAfterBase,
		BalanceAfterBonus: balanceAfterBonus,
		ReferenceType:     &refType,
		ReferenceID:       &refID,
		Description:       &desc,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create coin transaction")
		return nil, apperror.Internal("failed to purchase theme")
	}

	// Create purchase record.
	purchase, err := txQueries.CreateThemePurchase(ctx, db.CreateThemePurchaseParams{
		UserID:         userID,
		ThemeID:        themeID,
		CoinPrice:      coinPrice,
		BaseCoinsUsed:  int32(baseUsed),
		BonusCoinsUsed: int32(bonusUsed),
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create theme purchase")
		return nil, apperror.Internal("failed to purchase theme")
	}

	if err := tx.Commit(ctx); err != nil {
		s.logger.Error().Err(err).Msg("failed to commit purchase tx")
		return nil, apperror.Internal("failed to purchase theme")
	}

	// Publish event (best-effort, outside transaction).
	_ = s.bus.Publish(ctx, eventbus.ThemePurchased{
		PurchaseID: purchase.ID,
		UserID:     userID,
		CreatorID:  theme.CreatorID,
		ThemeID:    themeID,
		TotalCoins: int(coinPrice),
	})

	return s.toPurchaseResponse(purchase), nil
}

// RefundTheme refunds a theme purchase.
// Security: [S4] triple-check (7d + unplayed + COMPLETED), [S5] free theme block, [S9] 3/30d limit.
func (s *coinService) RefundTheme(ctx context.Context, userID uuid.UUID, purchaseID uuid.UUID) error {
	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to begin tx for refund")
		return apperror.Internal("failed to refund theme")
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	txQueries := s.queries.WithTx(tx)

	// Lock purchase row.
	purchase, err := txQueries.GetThemePurchaseForRefund(ctx, db.GetThemePurchaseForRefundParams{
		ID:     purchaseID,
		UserID: userID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.New(apperror.ErrPurchaseNotFound, http.StatusNotFound, "purchase not found")
		}
		s.logger.Error().Err(err).Msg("failed to get purchase for refund")
		return apperror.Internal("failed to refund theme")
	}

	// Validation chain.
	if purchase.Status != "COMPLETED" {
		return apperror.New(apperror.ErrRefundAlreadyDone, http.StatusConflict, "purchase already refunded")
	}
	if purchase.CoinPrice == 0 {
		return apperror.New(apperror.ErrRefundFreeTheme, http.StatusBadRequest, "free themes cannot be refunded")
	}
	if purchase.HasPlayed {
		return apperror.New(apperror.ErrRefundAlreadyPlayed, http.StatusForbidden, "cannot refund a theme you have played")
	}
	if purchase.RefundableUntil.Valid && purchase.RefundableUntil.Time.Before(time.Now()) {
		return apperror.New(apperror.ErrRefundExpired, http.StatusForbidden, "refund period has expired")
	}

	// [S9] Rate limit: max 3 refunds per 30 days.
	recentCount, err := txQueries.CountRecentRefunds(ctx, userID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count recent refunds")
		return apperror.Internal("failed to refund theme")
	}
	if recentCount >= 3 {
		return apperror.New(apperror.ErrRefundLimitExceeded, http.StatusTooManyRequests, "refund limit exceeded (max 3 per 30 days)")
	}

	// Mark as refunded.
	_, err = txQueries.RefundThemePurchase(ctx, purchaseID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update purchase status")
		return apperror.Internal("failed to refund theme")
	}

	// Restore coins.
	baseRefund := int64(purchase.BaseCoinsUsed)
	bonusRefund := int64(purchase.BonusCoinsUsed)

	err = txQueries.AddCoinBalance(ctx, db.AddCoinBalanceParams{
		ID:               userID,
		CoinBalanceBase:  baseRefund,
		CoinBalanceBonus: bonusRefund,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to restore coin balance")
		return apperror.Internal("failed to refund theme")
	}

	// Get updated balance for transaction record.
	user, err := txQueries.GetUserForCoinUpdate(ctx, userID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get updated balance")
		return apperror.Internal("failed to refund theme")
	}

	refType := "THEME"
	refID := purchase.ThemeID.String()
	desc := fmt.Sprintf("Theme refund: purchase %s", purchaseID.String())
	_, err = txQueries.CreateCoinTransaction(ctx, db.CreateCoinTransactionParams{
		UserID:            userID,
		Type:              "REFUND",
		BaseAmount:        int32(baseRefund),
		BonusAmount:       int32(bonusRefund),
		BalanceAfterBase:  user.CoinBalanceBase,
		BalanceAfterBonus: user.CoinBalanceBonus,
		ReferenceType:     &refType,
		ReferenceID:       &refID,
		Description:       &desc,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create refund transaction")
		return apperror.Internal("failed to refund theme")
	}

	if err := tx.Commit(ctx); err != nil {
		s.logger.Error().Err(err).Msg("failed to commit refund tx")
		return apperror.Internal("failed to refund theme")
	}

	// Fetch theme for creator_id (best-effort for event).
	theme, themeErr := s.queries.GetTheme(ctx, purchase.ThemeID)
	if themeErr == nil {
		_ = s.bus.Publish(ctx, eventbus.ThemeRefunded{
			PurchaseID: purchaseID,
			UserID:     userID,
			CreatorID:  theme.CreatorID,
		})
	}

	return nil
}

// ListPurchasedThemes returns a paginated list of themes the user has purchased.
func (s *coinService) ListPurchasedThemes(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]PurchasedThemeResponse, int64, error) {
	rows, err := s.queries.ListPurchasedThemes(ctx, db.ListPurchasedThemesParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to list purchased themes")
		return nil, 0, apperror.Internal("failed to list purchased themes")
	}

	total, err := s.queries.CountPurchasedThemes(ctx, userID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("user_id", userID).Msg("failed to count purchased themes")
		return nil, 0, apperror.Internal("failed to count purchased themes")
	}

	items := make([]PurchasedThemeResponse, len(rows))
	for i, r := range rows {
		var refundableUntil time.Time
		if r.RefundableUntil.Valid {
			refundableUntil = r.RefundableUntil.Time
		}
		items[i] = PurchasedThemeResponse{
			ID:              r.ID,
			ThemeID:         r.ThemeID,
			ThemeTitle:      r.ThemeTitle,
			ThemeSlug:       r.ThemeSlug,
			CoinPrice:       int(r.CoinPrice),
			Status:          r.Status,
			HasPlayed:       r.HasPlayed,
			RefundableUntil: refundableUntil,
			CreatedAt:       r.CreatedAt,
		}
	}
	return items, total, nil
}

// HandlePaymentConfirmed processes a PaymentConfirmed event by crediting coins.
func (s *coinService) HandlePaymentConfirmed(ctx context.Context, event eventbus.Event) error {
	e, ok := event.(eventbus.PaymentConfirmed)
	if !ok {
		return fmt.Errorf("unexpected event type: %T", event)
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to begin tx for payment confirmed")
		return err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	txQueries := s.queries.WithTx(tx)

	// Lock user row.
	user, err := txQueries.GetUserForCoinUpdate(ctx, e.UserID)
	if err != nil {
		s.logger.Error().Err(err).Stringer("user_id", e.UserID).Msg("failed to lock user for coin credit")
		return err
	}

	baseCoins := int64(e.BaseCoins)
	bonusCoins := int64(e.BonusCoins)

	err = txQueries.AddCoinBalance(ctx, db.AddCoinBalanceParams{
		ID:               e.UserID,
		CoinBalanceBase:  baseCoins,
		CoinBalanceBonus: bonusCoins,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to credit coin balance")
		return err
	}

	refType := "PAYMENT"
	refID := e.PaymentID.String()
	desc := fmt.Sprintf("Payment confirmed: %d base + %d bonus coins", e.BaseCoins, e.BonusCoins)
	_, err = txQueries.CreateCoinTransaction(ctx, db.CreateCoinTransactionParams{
		UserID:            e.UserID,
		Type:              "CHARGE",
		BaseAmount:        int32(e.BaseCoins),
		BonusAmount:       int32(e.BonusCoins),
		BalanceAfterBase:  user.CoinBalanceBase + baseCoins,
		BalanceAfterBonus: user.CoinBalanceBonus + bonusCoins,
		ReferenceType:     &refType,
		ReferenceID:       &refID,
		Description:       &desc,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create charge transaction")
		return err
	}

	return tx.Commit(ctx)
}

// HandleGameStarted marks purchased themes as played for all players.
func (s *coinService) HandleGameStarted(ctx context.Context, event eventbus.Event) error {
	e, ok := event.(eventbus.GameStarted)
	if !ok {
		return fmt.Errorf("unexpected event type: %T", event)
	}

	for _, playerID := range e.PlayerIDs {
		err := s.queries.MarkThemePlayed(ctx, db.MarkThemePlayedParams{
			UserID:  playerID,
			ThemeID: e.ThemeID,
		})
		if err != nil {
			s.logger.Error().Err(err).
				Stringer("player_id", playerID).
				Stringer("theme_id", e.ThemeID).
				Msg("failed to mark theme as played")
			// Continue marking other players; don't fail the whole batch.
		}
	}
	return nil
}

// toPurchaseResponse converts a DB ThemePurchase to a PurchaseResponse.
func (s *coinService) toPurchaseResponse(p db.ThemePurchase) *PurchaseResponse {
	var refundableUntil time.Time
	if p.RefundableUntil.Valid {
		refundableUntil = p.RefundableUntil.Time
	}
	return &PurchaseResponse{
		ID:              p.ID,
		ThemeID:         p.ThemeID,
		CoinPrice:       int(p.CoinPrice),
		BaseCoinsUsed:   int(p.BaseCoinsUsed),
		BonusCoinsUsed:  int(p.BonusCoinsUsed),
		RefundableUntil: refundableUntil,
		HasPlayed:       p.HasPlayed,
		CreatedAt:       p.CreatedAt,
	}
}

// min64 returns the smaller of two int64 values.
func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
