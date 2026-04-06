package eventbus

import "github.com/google/uuid"

// Event type constants.
const (
	TypePaymentConfirmed = "payment.confirmed"
	TypeThemePurchased   = "theme.purchased"
	TypeThemeRefunded    = "theme.refunded"
	TypeGameStarted      = "game.started"
)

// PaymentConfirmed is published when a payment is confirmed by the provider.
type PaymentConfirmed struct {
	UserID     uuid.UUID
	PaymentID  uuid.UUID
	BaseCoins  int
	BonusCoins int
}

func (e PaymentConfirmed) EventType() string { return TypePaymentConfirmed }

// ThemePurchased is published when a user purchases a theme.
type ThemePurchased struct {
	PurchaseID uuid.UUID
	UserID     uuid.UUID
	CreatorID  uuid.UUID
	ThemeID    uuid.UUID
	TotalCoins int
}

func (e ThemePurchased) EventType() string { return TypeThemePurchased }

// ThemeRefunded is published when a theme purchase is refunded.
type ThemeRefunded struct {
	PurchaseID uuid.UUID
	UserID     uuid.UUID
	CreatorID  uuid.UUID
}

func (e ThemeRefunded) EventType() string { return TypeThemeRefunded }

// GameStarted is published when a game session starts.
type GameStarted struct {
	SessionID uuid.UUID
	ThemeID   uuid.UUID
	PlayerIDs []uuid.UUID
}

func (e GameStarted) EventType() string { return TypeGameStarted }
