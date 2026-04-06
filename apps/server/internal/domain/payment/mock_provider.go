package payment

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

type mockProvider struct{}

func NewMockProvider() PaymentProvider {
	return &mockProvider{}
}

func (p *mockProvider) CreatePayment(ctx context.Context, req CreatePaymentRequest) (*PaymentResult, error) {
	// Mock: 즉시 payment key 생성
	return &PaymentResult{
		PaymentKey: fmt.Sprintf("mock_pay_%s", uuid.New().String()[:8]),
		Status:     StatusPending,
	}, nil
}

func (p *mockProvider) ConfirmPayment(ctx context.Context, paymentKey string) (*PaymentResult, error) {
	// Mock: 즉시 확인 성공
	now := time.Now()
	return &PaymentResult{
		PaymentKey:  paymentKey,
		Status:      StatusConfirmed,
		ConfirmedAt: &now,
	}, nil
}

func (p *mockProvider) RefundPayment(ctx context.Context, paymentKey string, reason string) error {
	// Mock: 즉시 환불 성공
	return nil
}

func (p *mockProvider) HandleWebhook(ctx context.Context, headers http.Header, body []byte) (*WebhookEvent, error) {
	// Mock: 서명 검증 스킵, 테스트용 이벤트 반환
	return &WebhookEvent{
		PaymentKey: "mock_webhook",
		EventType:  StatusConfirmed,
		Timestamp:  time.Now(),
	}, nil
}
