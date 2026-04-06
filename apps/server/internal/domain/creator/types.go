package creator

import (
	"time"

	"github.com/google/uuid"
)

// DashboardResponse is the creator dashboard summary.
type DashboardResponse struct {
	TotalEarnings     int64 `json:"total_earnings"`
	UnsettledEarnings int64 `json:"unsettled_earnings"`
	TotalSales        int64 `json:"total_sales"`
}

// DailyStatResponse is a single day of theme statistics.
type DailyStatResponse struct {
	Date          string `json:"date"`
	SalesCount    int64  `json:"sales_count"`
	DailyEarnings int64  `json:"daily_earnings"`
}

// EarningResponse is a single earning entry.
type EarningResponse struct {
	ID                 uuid.UUID `json:"id"`
	ThemeID            uuid.UUID `json:"theme_id"`
	ThemeTitle         string    `json:"theme_title"`
	TotalCoins         int32     `json:"total_coins"`
	CreatorShareCoins  int32     `json:"creator_share_coins"`
	PlatformShareCoins int32     `json:"platform_share_coins"`
	Settled            bool      `json:"settled"`
	CreatedAt          time.Time `json:"created_at"`
}

// SettlementResponse is a single settlement entry.
type SettlementResponse struct {
	ID          uuid.UUID  `json:"id"`
	PeriodStart string     `json:"period_start"`
	PeriodEnd   string     `json:"period_end"`
	TotalCoins  int32      `json:"total_coins"`
	TotalKRW    int32      `json:"total_krw"`
	TaxType     string     `json:"tax_type"`
	TaxRate     float64    `json:"tax_rate"`
	TaxAmount   int32      `json:"tax_amount"`
	NetAmount   int32      `json:"net_amount"`
	Status      string     `json:"status"`
	ApprovedAt  *time.Time `json:"approved_at"`
	PaidOutAt   *time.Time `json:"paid_out_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// AdminSettlementResponse extends SettlementResponse with creator info.
type AdminSettlementResponse struct {
	SettlementResponse
	CreatorID       uuid.UUID `json:"creator_id"`
	CreatorNickname string    `json:"creator_nickname"`
}

// RevenueResponse is the platform revenue summary.
type RevenueResponse struct {
	TotalCoins      int64 `json:"total_coins"`
	TotalKRW        int64 `json:"total_krw"`
	TotalTax        int64 `json:"total_tax"`
	TotalNet        int64 `json:"total_net"`
	SettlementCount int64 `json:"settlement_count"`
}

// GrantCoinsReq is the request body for admin coin grants.
// H4: gte=0 prevents negative coin grants.
type GrantCoinsReq struct {
	UserID      uuid.UUID `json:"user_id" validate:"required"`
	BaseCoins   int32     `json:"base_coins" validate:"gte=0"`
	BonusCoins  int32     `json:"bonus_coins" validate:"gte=0"`
	Description string    `json:"description" validate:"required"`
}

// CreatePackageReq is the request body for creating a coin package.
type CreatePackageReq struct {
	Platform   string `json:"platform" validate:"required"`
	Name       string `json:"name" validate:"required"`
	PriceKRW   int32  `json:"price_krw" validate:"required,gt=0"`
	BaseCoins  int32  `json:"base_coins" validate:"required,gt=0"`
	BonusCoins int32  `json:"bonus_coins" validate:"gte=0"`
	SortOrder  int32  `json:"sort_order"`
	IsActive   bool   `json:"is_active"`
}

// UpdatePackageReq is the request body for updating a coin package.
type UpdatePackageReq struct {
	Name       string `json:"name" validate:"required"`
	PriceKRW   int32  `json:"price_krw" validate:"required,gt=0"`
	BaseCoins  int32  `json:"base_coins" validate:"required,gt=0"`
	BonusCoins int32  `json:"bonus_coins" validate:"gte=0"`
	SortOrder  int32  `json:"sort_order"`
	IsActive   bool   `json:"is_active"`
}
