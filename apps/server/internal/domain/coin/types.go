package coin

import (
	"time"

	"github.com/google/uuid"
)

// BalanceResponse represents the user's coin balance.
type BalanceResponse struct {
	BaseCoins  int64 `json:"base_coins"`
	BonusCoins int64 `json:"bonus_coins"`
	TotalCoins int64 `json:"total_coins"`
}

// TransactionResponse represents a single coin transaction.
type TransactionResponse struct {
	ID                int64     `json:"id"`
	Type              string    `json:"type"`
	BaseAmount        int       `json:"base_amount"`
	BonusAmount       int       `json:"bonus_amount"`
	BalanceAfterBase  int64     `json:"balance_after_base"`
	BalanceAfterBonus int64     `json:"balance_after_bonus"`
	ReferenceType     *string   `json:"reference_type"`
	ReferenceID       *string   `json:"reference_id"`
	Description       *string   `json:"description"`
	CreatedAt         time.Time `json:"created_at"`
}

// TransactionListResponse wraps a paginated list of transactions.
type TransactionListResponse struct {
	Items []TransactionResponse `json:"items"`
	Total int64                 `json:"total"`
}

// PurchaseThemeReq is the request body for purchasing a theme.
type PurchaseThemeReq struct {
	ThemeID uuid.UUID `json:"theme_id" validate:"required"`
}

// RefundThemeReq is the request body for refunding a theme purchase.
type RefundThemeReq struct {
	PurchaseID uuid.UUID `json:"purchase_id" validate:"required"`
}

// PurchaseResponse represents a completed theme purchase.
type PurchaseResponse struct {
	ID              uuid.UUID `json:"id"`
	ThemeID         uuid.UUID `json:"theme_id"`
	CoinPrice       int       `json:"coin_price"`
	BaseCoinsUsed   int       `json:"base_coins_used"`
	BonusCoinsUsed  int       `json:"bonus_coins_used"`
	RefundableUntil time.Time `json:"refundable_until"`
	HasPlayed       bool      `json:"has_played"`
	CreatedAt       time.Time `json:"created_at"`
}

// PurchasedThemeResponse represents a purchased theme in the user's library.
type PurchasedThemeResponse struct {
	ID              uuid.UUID `json:"id"`
	ThemeID         uuid.UUID `json:"theme_id"`
	ThemeTitle      string    `json:"theme_title"`
	ThemeSlug       string    `json:"theme_slug"`
	CoinPrice       int       `json:"coin_price"`
	Status          string    `json:"status"`
	HasPlayed       bool      `json:"has_played"`
	RefundableUntil time.Time `json:"refundable_until"`
	CreatedAt       time.Time `json:"created_at"`
}

// PurchasedThemeListResponse wraps a paginated list of purchased themes.
type PurchasedThemeListResponse struct {
	Items []PurchasedThemeResponse `json:"items"`
	Total int64                    `json:"total"`
}
