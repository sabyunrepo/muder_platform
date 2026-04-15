package payment

import (
	"context"
	"errors"
	"net/http"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/eventbus"
)

// PaymentService defines payment domain operations.
type PaymentService interface {
	ListPackages(ctx context.Context, platform string) ([]PackageResponse, error)
	CreatePayment(ctx context.Context, userID uuid.UUID, req CreatePaymentReq) (*PaymentResponse, error)
	ConfirmPayment(ctx context.Context, userID uuid.UUID, req ConfirmPaymentReq) (*PaymentResponse, error)
	GetPaymentHistory(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]PaymentResponse, int64, error)
}

// paymentService implements PaymentService.
type paymentService struct {
	queries      *db.Queries
	provider     PaymentProvider
	providerName string
	bus          *eventbus.Bus
	logger       zerolog.Logger
}

// NewService creates a new payment service.
func NewService(queries *db.Queries, provider PaymentProvider, providerName string, bus *eventbus.Bus, logger zerolog.Logger) PaymentService {
	return &paymentService{
		queries:      queries,
		provider:     provider,
		providerName: providerName,
		bus:          bus,
		logger:       logger.With().Str("domain", "payment").Logger(),
	}
}

func (s *paymentService) ListPackages(ctx context.Context, platform string) ([]PackageResponse, error) {
	packages, err := s.queries.ListActivePackages(ctx, platform)
	if err != nil {
		s.logger.Error().Err(err).Str("platform", platform).Msg("failed to list packages")
		return nil, apperror.Internal("failed to list packages")
	}

	result := make([]PackageResponse, len(packages))
	for i, p := range packages {
		result[i] = PackageResponse{
			ID:         p.ID,
			Platform:   p.Platform,
			Name:       p.Name,
			PriceKRW:   int(p.PriceKrw),
			BaseCoins:  int(p.BaseCoins),
			BonusCoins: int(p.BonusCoins),
			TotalCoins: int(p.BaseCoins) + int(p.BonusCoins),
		}
	}
	return result, nil
}

// CreatePayment creates a new payment. [S1] Price is resolved server-side from the package.
// [S6] The package price/coins are snapshotted at creation time.
func (s *paymentService) CreatePayment(ctx context.Context, userID uuid.UUID, req CreatePaymentReq) (*PaymentResponse, error) {
	// 1. Look up the package — server-side price resolution [S1].
	pkg, err := s.queries.GetPackageByID(ctx, req.PackageID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("package not found")
		}
		s.logger.Error().Err(err).Msg("failed to get package")
		return nil, apperror.Internal("failed to create payment")
	}

	// 2. Idempotency check.
	existing, err := s.queries.GetPaymentByIdempotencyKey(ctx, req.IdempotencyKey)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		s.logger.Error().Err(err).Msg("failed to check idempotency key")
		return nil, apperror.Internal("failed to create payment")
	}
	if err == nil {
		// Existing payment found — check for mismatch [S1].
		if existing.PackageID != req.PackageID {
			return nil, apperror.New(
				apperror.ErrPaymentIdempotencyMismatch,
				http.StatusUnprocessableEntity,
				"idempotency key already used for a different package",
			)
		}
		// Same package — return existing payment (idempotent response).
		return toPaymentResponse(existing), nil
	}

	// 3. Call the payment provider.
	providerResult, err := s.provider.CreatePayment(ctx, CreatePaymentRequest{
		UserID:         userID,
		PackageID:      req.PackageID,
		IdempotencyKey: req.IdempotencyKey,
		AmountKRW:      int(pkg.PriceKrw),
		BaseCoins:      int(pkg.BaseCoins),
		BonusCoins:     int(pkg.BonusCoins),
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("provider create payment failed")
		return nil, apperror.New(apperror.ErrPaymentProviderError, http.StatusBadGateway, "payment provider error")
	}

	// 4. Persist payment with price snapshot [S6].
	p, err := s.queries.CreatePayment(ctx, db.CreatePaymentParams{
		UserID:         userID,
		PackageID:      req.PackageID,
		IdempotencyKey: req.IdempotencyKey,
		Provider:       s.providerName,
		AmountKrw:      pkg.PriceKrw,
		BaseCoins:      pkg.BaseCoins,
		BonusCoins:     pkg.BonusCoins,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to persist payment")
		return nil, apperror.Internal("failed to create payment")
	}

	s.logger.Info().
		Stringer("payment_id", p.ID).
		Stringer("user_id", userID).
		Str("payment_key", maskPaymentKey(providerResult.PaymentKey)).
		Msg("payment created")

	return toPaymentResponse(p), nil
}

func (s *paymentService) ConfirmPayment(ctx context.Context, userID uuid.UUID, req ConfirmPaymentReq) (*PaymentResponse, error) {
	// 1. Fetch the payment.
	p, err := s.queries.GetPaymentByID(ctx, req.PaymentID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("payment not found")
		}
		s.logger.Error().Err(err).Msg("failed to get payment")
		return nil, apperror.Internal("failed to confirm payment")
	}

	// 2. Ownership check [S7].
	if p.UserID != userID {
		return nil, apperror.Forbidden("payment does not belong to this user")
	}

	// 3. Status guard.
	if p.Status != StatusPending {
		return nil, apperror.New(
			apperror.ErrPaymentInvalidStatus,
			http.StatusConflict,
			"payment is not in PENDING status",
		)
	}

	// 4. Confirm with provider.
	_, err = s.provider.ConfirmPayment(ctx, req.PaymentKey)
	if err != nil {
		s.logger.Error().Err(err).
			Str("payment_key", maskPaymentKey(req.PaymentKey)).
			Msg("provider confirm payment failed")
		return nil, apperror.New(apperror.ErrPaymentProviderError, http.StatusBadGateway, "payment provider error")
	}

	// 5. Update DB.
	confirmed, err := s.queries.ConfirmPayment(ctx, db.ConfirmPaymentParams{
		ID:         req.PaymentID,
		PaymentKey: pgtype.Text{String: req.PaymentKey, Valid: true},
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrPaymentInvalidStatus, http.StatusConflict, "payment already processed")
		}
		s.logger.Error().Err(err).Msg("failed to confirm payment in DB")
		return nil, apperror.Internal("failed to confirm payment")
	}

	// 6. Publish event for coin crediting.
	if err := s.bus.Publish(ctx, eventbus.PaymentConfirmed{
		UserID:     userID,
		PaymentID:  confirmed.ID,
		BaseCoins:  int(confirmed.BaseCoins),
		BonusCoins: int(confirmed.BonusCoins),
	}); err != nil {
		s.logger.Error().Err(err).
			Stringer("payment_id", confirmed.ID).
			Msg("failed to publish PaymentConfirmed event")
		// Event failure is logged but does not fail the confirmation response.
		// TODO(phase8): Implement reconciliation job - query CONFIRMED payments
		// without matching CHARGE coin_transaction and credit missing coins.
		// See: docs/plans/2026-04-06-phase76-payment-design.md [M5]
	}

	s.logger.Info().
		Stringer("payment_id", confirmed.ID).
		Stringer("user_id", userID).
		Str("payment_key", maskPaymentKey(req.PaymentKey)).
		Msg("payment confirmed")

	return toPaymentResponse(confirmed), nil
}

func (s *paymentService) GetPaymentHistory(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]PaymentResponse, int64, error) {
	payments, err := s.queries.ListPaymentsByUser(ctx, db.ListPaymentsByUserParams{
		UserID: userID,
		Limit:  limit,
		Offset: offset,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list payments")
		return nil, 0, apperror.Internal("failed to list payments")
	}

	total, err := s.queries.CountPaymentsByUser(ctx, userID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count payments")
		return nil, 0, apperror.Internal("failed to list payments")
	}

	result := make([]PaymentResponse, len(payments))
	for i, p := range payments {
		result[i] = *toPaymentResponse(p)
	}
	return result, total, nil
}

// toPaymentResponse converts a db.Payment to a PaymentResponse.
func toPaymentResponse(p db.Payment) *PaymentResponse {
	resp := &PaymentResponse{
		ID:         p.ID,
		PackageID:  p.PackageID,
		Status:     p.Status,
		AmountKRW:  int(p.AmountKrw),
		BaseCoins:  int(p.BaseCoins),
		BonusCoins: int(p.BonusCoins),
		CreatedAt:  p.CreatedAt,
	}
	if p.PaymentKey.Valid {
		key := p.PaymentKey.String
		resp.PaymentKey = &key
	}
	if p.ConfirmedAt.Valid {
		t := p.ConfirmedAt.Time
		resp.ConfirmedAt = &t
	}
	return resp
}

// maskPaymentKey returns the last 4 characters of a payment key for logging [S10].
func maskPaymentKey(key string) string {
	if len(key) <= 4 {
		return "****"
	}
	return "****" + key[len(key)-4:]
}
