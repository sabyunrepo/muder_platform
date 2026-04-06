package payment

import (
	"context"
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

// NewPaymentProvider creates a provider based on config (Factory pattern)
func NewPaymentProvider(providerName string) PaymentProvider {
	switch providerName {
	// case "toss": return NewTossProvider(...)
	// case "stripe": return NewStripeProvider(...)
	default:
		return NewMockProvider()
	}
}
