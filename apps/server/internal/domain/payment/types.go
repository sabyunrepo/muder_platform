package payment

import (
	"time"

	"github.com/google/uuid"
)

// Payment status constants
const (
	StatusPending   = "PENDING"
	StatusConfirmed = "CONFIRMED"
	StatusRefunded  = "REFUNDED"
	StatusFailed    = "FAILED"
	StatusCancelled = "CANCELLED"
)

// validTransitions: 현재 상태 → 허용되는 다음 상태들
var validTransitions = map[string][]string{
	StatusPending:   {StatusConfirmed, StatusFailed, StatusCancelled},
	StatusConfirmed: {StatusRefunded},
}

func IsValidTransition(from, to string) bool {
	for _, allowed := range validTransitions[from] {
		if allowed == to {
			return true
		}
	}
	return false
}

// Provider request/response types
type CreatePaymentRequest struct {
	UserID         uuid.UUID
	PackageID      uuid.UUID
	IdempotencyKey uuid.UUID
	AmountKRW      int
	BaseCoins      int
	BonusCoins     int
}

type PaymentResult struct {
	PaymentKey  string
	Status      string
	ConfirmedAt *time.Time
}

type WebhookEvent struct {
	PaymentKey string
	EventType  string // "CONFIRMED", "FAILED", "REFUNDED"
	Timestamp  time.Time
}

// API response types (JSON)
type PackageResponse struct {
	ID         uuid.UUID `json:"id"`
	Platform   string    `json:"platform"`
	Name       string    `json:"name"`
	PriceKRW   int       `json:"price_krw"`
	BaseCoins  int       `json:"base_coins"`
	BonusCoins int       `json:"bonus_coins"`
	TotalCoins int       `json:"total_coins"`
}

type PaymentResponse struct {
	ID          uuid.UUID  `json:"id"`
	PackageID   uuid.UUID  `json:"package_id"`
	PaymentKey  *string    `json:"payment_key"`
	Status      string     `json:"status"`
	AmountKRW   int        `json:"amount_krw"`
	BaseCoins   int        `json:"base_coins"`
	BonusCoins  int        `json:"bonus_coins"`
	ConfirmedAt *time.Time `json:"confirmed_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// API request types
type CreatePaymentReq struct {
	PackageID      uuid.UUID `json:"package_id" validate:"required"`
	IdempotencyKey uuid.UUID `json:"idempotency_key" validate:"required"`
}

type ConfirmPaymentReq struct {
	PaymentID  uuid.UUID `json:"payment_id" validate:"required"`
	PaymentKey string    `json:"payment_key" validate:"required"`
}
