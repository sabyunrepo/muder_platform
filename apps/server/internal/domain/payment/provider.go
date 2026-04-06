package payment

import (
	"context"
	"fmt"
	"net/http"
)

// PaymentProvider defines the Strategy interface for payment gateways
type PaymentProvider interface {
	CreatePayment(ctx context.Context, req CreatePaymentRequest) (*PaymentResult, error)
	ConfirmPayment(ctx context.Context, paymentKey string) (*PaymentResult, error)
	RefundPayment(ctx context.Context, paymentKey string, reason string) error
	// HandleWebhook: headers 포함 — HMAC-SHA256 서명 검증 [S2]
	HandleWebhook(ctx context.Context, headers http.Header, body []byte) (*WebhookEvent, error)
}

// NewPaymentProvider creates a provider based on config (Factory pattern).
// H2: isDev guard prevents mock provider from being used in production.
func NewPaymentProvider(providerName string, isDev bool) (PaymentProvider, error) {
	switch providerName {
	case "mock":
		if !isDev {
			return nil, fmt.Errorf("mock provider not allowed in production")
		}
		return NewMockProvider(), nil
	// case "toss": return NewTossProvider(...), nil
	// case "stripe": return NewStripeProvider(...), nil
	default:
		return nil, fmt.Errorf("unknown payment provider: %s", providerName)
	}
}
