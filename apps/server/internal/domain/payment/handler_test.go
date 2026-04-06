package payment

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/middleware"
)

// ---------------------------------------------------------------------------
// Mock PaymentService
// ---------------------------------------------------------------------------

type mockPaymentSvc struct {
	listPackagesFn    func(ctx context.Context, platform string) ([]PackageResponse, error)
	createPaymentFn   func(ctx context.Context, userID uuid.UUID, req CreatePaymentReq) (*PaymentResponse, error)
	confirmPaymentFn  func(ctx context.Context, userID uuid.UUID, req ConfirmPaymentReq) (*PaymentResponse, error)
	getPaymentHistFn  func(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]PaymentResponse, int64, error)
}

func (m *mockPaymentSvc) ListPackages(ctx context.Context, platform string) ([]PackageResponse, error) {
	if m.listPackagesFn != nil {
		return m.listPackagesFn(ctx, platform)
	}
	return nil, nil
}

func (m *mockPaymentSvc) CreatePayment(ctx context.Context, userID uuid.UUID, req CreatePaymentReq) (*PaymentResponse, error) {
	if m.createPaymentFn != nil {
		return m.createPaymentFn(ctx, userID, req)
	}
	return nil, nil
}

func (m *mockPaymentSvc) ConfirmPayment(ctx context.Context, userID uuid.UUID, req ConfirmPaymentReq) (*PaymentResponse, error) {
	if m.confirmPaymentFn != nil {
		return m.confirmPaymentFn(ctx, userID, req)
	}
	return nil, nil
}

func (m *mockPaymentSvc) GetPaymentHistory(ctx context.Context, userID uuid.UUID, limit, offset int32) ([]PaymentResponse, int64, error) {
	if m.getPaymentHistFn != nil {
		return m.getPaymentHistFn(ctx, userID, limit, offset)
	}
	return nil, 0, nil
}

// ---------------------------------------------------------------------------
// Mock PaymentProvider
// ---------------------------------------------------------------------------

type mockPaymentProv struct {
	handleWebhookFn func(ctx context.Context, headers http.Header, body []byte) (*WebhookEvent, error)
}

func (m *mockPaymentProv) CreatePayment(_ context.Context, _ CreatePaymentRequest) (*PaymentResult, error) {
	return nil, nil
}
func (m *mockPaymentProv) ConfirmPayment(_ context.Context, _ string) (*PaymentResult, error) {
	return nil, nil
}
func (m *mockPaymentProv) RefundPayment(_ context.Context, _, _ string) error { return nil }
func (m *mockPaymentProv) HandleWebhook(ctx context.Context, headers http.Header, body []byte) (*WebhookEvent, error) {
	if m.handleWebhookFn != nil {
		return m.handleWebhookFn(ctx, headers, body)
	}
	return &WebhookEvent{}, nil
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func withUserID(r *http.Request, userID uuid.UUID) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	return r.WithContext(ctx)
}

func jsonBody(t *testing.T, v any) *bytes.Reader {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("failed to marshal json body: %v", err)
	}
	return bytes.NewReader(b)
}

func decodeJSON(t *testing.T, rec *httptest.ResponseRecorder, dst any) {
	t.Helper()
	if err := json.NewDecoder(rec.Body).Decode(dst); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestListPackages_WEB(t *testing.T) {
	svc := &mockPaymentSvc{
		listPackagesFn: func(_ context.Context, platform string) ([]PackageResponse, error) {
			if platform != "WEB" {
				t.Errorf("expected platform WEB, got %s", platform)
			}
			return []PackageResponse{
				{ID: uuid.New(), Platform: "WEB", Name: "Basic", PriceKRW: 5000, BaseCoins: 500, BonusCoins: 50, TotalCoins: 550},
			}, nil
		},
	}
	h := NewHandler(svc, &mockPaymentProv{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/payments/packages?platform=WEB", nil)
	rec := httptest.NewRecorder()
	h.ListPackages(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var resp []PackageResponse
	decodeJSON(t, rec, &resp)
	if len(resp) != 1 {
		t.Fatalf("expected 1 package, got %d", len(resp))
	}
	if resp[0].Platform != "WEB" {
		t.Errorf("expected platform WEB, got %s", resp[0].Platform)
	}
}

func TestListPackages_InvalidPlatform(t *testing.T) {
	h := NewHandler(&mockPaymentSvc{}, &mockPaymentProv{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/payments/packages?platform=INVALID", nil)
	rec := httptest.NewRecorder()
	h.ListPackages(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", rec.Code)
	}
}

func TestCreatePayment_Success(t *testing.T) {
	userID := uuid.New()
	packageID := uuid.New()
	paymentID := uuid.New()
	now := time.Now().Truncate(time.Second)

	svc := &mockPaymentSvc{
		createPaymentFn: func(_ context.Context, uID uuid.UUID, req CreatePaymentReq) (*PaymentResponse, error) {
			if uID != userID {
				t.Errorf("expected userID %s, got %s", userID, uID)
			}
			if req.PackageID != packageID {
				t.Errorf("expected packageID %s, got %s", packageID, req.PackageID)
			}
			return &PaymentResponse{
				ID:        paymentID,
				PackageID: packageID,
				Status:    StatusPending,
				AmountKRW: 5000,
				BaseCoins: 500,
				BonusCoins: 50,
				CreatedAt: now,
			}, nil
		},
	}
	h := NewHandler(svc, &mockPaymentProv{})

	body := jsonBody(t, CreatePaymentReq{PackageID: packageID, IdempotencyKey: uuid.New()})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/create", body)
	req.Header.Set("Content-Type", "application/json")
	req = withUserID(req, userID)

	rec := httptest.NewRecorder()
	h.CreatePayment(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("expected status 201, got %d", rec.Code)
	}

	var resp PaymentResponse
	decodeJSON(t, rec, &resp)
	if resp.Status != StatusPending {
		t.Errorf("expected status PENDING, got %s", resp.Status)
	}
}

func TestCreatePayment_IdempotencyMismatch(t *testing.T) {
	userID := uuid.New()

	svc := &mockPaymentSvc{
		createPaymentFn: func(_ context.Context, _ uuid.UUID, _ CreatePaymentReq) (*PaymentResponse, error) {
			return nil, apperror.New(
				apperror.ErrPaymentIdempotencyMismatch,
				http.StatusUnprocessableEntity,
				"idempotency key already used for a different package",
			)
		},
	}
	h := NewHandler(svc, &mockPaymentProv{})

	body := jsonBody(t, CreatePaymentReq{PackageID: uuid.New(), IdempotencyKey: uuid.New()})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/create", body)
	req.Header.Set("Content-Type", "application/json")
	req = withUserID(req, userID)

	rec := httptest.NewRecorder()
	h.CreatePayment(rec, req)

	if rec.Code != http.StatusUnprocessableEntity {
		t.Errorf("expected status 422, got %d", rec.Code)
	}

	var errResp apperror.AppError
	decodeJSON(t, rec, &errResp)
	if errResp.Code != apperror.ErrPaymentIdempotencyMismatch {
		t.Errorf("expected error code %s, got %s", apperror.ErrPaymentIdempotencyMismatch, errResp.Code)
	}
}

func TestConfirmPayment_Success(t *testing.T) {
	userID := uuid.New()
	paymentID := uuid.New()
	now := time.Now().Truncate(time.Second)

	svc := &mockPaymentSvc{
		confirmPaymentFn: func(_ context.Context, uID uuid.UUID, req ConfirmPaymentReq) (*PaymentResponse, error) {
			if uID != userID {
				t.Errorf("expected userID %s, got %s", userID, uID)
			}
			return &PaymentResponse{
				ID:          paymentID,
				Status:      StatusConfirmed,
				ConfirmedAt: &now,
				CreatedAt:   now,
			}, nil
		},
	}
	h := NewHandler(svc, &mockPaymentProv{})

	body := jsonBody(t, ConfirmPaymentReq{PaymentID: paymentID, PaymentKey: "key_abc123"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/confirm", body)
	req.Header.Set("Content-Type", "application/json")
	req = withUserID(req, userID)

	rec := httptest.NewRecorder()
	h.ConfirmPayment(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var resp PaymentResponse
	decodeJSON(t, rec, &resp)
	if resp.Status != StatusConfirmed {
		t.Errorf("expected status CONFIRMED, got %s", resp.Status)
	}
}

func TestConfirmPayment_Unauthorized(t *testing.T) {
	svc := &mockPaymentSvc{
		confirmPaymentFn: func(_ context.Context, _ uuid.UUID, _ ConfirmPaymentReq) (*PaymentResponse, error) {
			return nil, apperror.Forbidden("payment does not belong to this user")
		},
	}
	h := NewHandler(svc, &mockPaymentProv{})

	body := jsonBody(t, ConfirmPaymentReq{PaymentID: uuid.New(), PaymentKey: "key_abc123"})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/confirm", body)
	req.Header.Set("Content-Type", "application/json")
	req = withUserID(req, uuid.New())

	rec := httptest.NewRecorder()
	h.ConfirmPayment(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Errorf("expected status 403, got %d", rec.Code)
	}
}

func TestGetPaymentHistory(t *testing.T) {
	userID := uuid.New()
	now := time.Now().Truncate(time.Second)

	svc := &mockPaymentSvc{
		getPaymentHistFn: func(_ context.Context, uID uuid.UUID, limit, offset int32) ([]PaymentResponse, int64, error) {
			if uID != userID {
				t.Errorf("expected userID %s, got %s", userID, uID)
			}
			return []PaymentResponse{
				{ID: uuid.New(), Status: StatusConfirmed, AmountKRW: 5000, CreatedAt: now},
				{ID: uuid.New(), Status: StatusPending, AmountKRW: 10000, CreatedAt: now},
			}, 2, nil
		},
	}
	h := NewHandler(svc, &mockPaymentProv{})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/payments/history", nil)
	req = withUserID(req, userID)

	rec := httptest.NewRecorder()
	h.GetPaymentHistory(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	var resp struct {
		Data  []PaymentResponse `json:"data"`
		Total int64             `json:"total"`
	}
	decodeJSON(t, rec, &resp)
	if len(resp.Data) != 2 {
		t.Errorf("expected 2 items, got %d", len(resp.Data))
	}
	if resp.Total != 2 {
		t.Errorf("expected total 2, got %d", resp.Total)
	}
}

func TestHandleWebhook(t *testing.T) {
	prov := &mockPaymentProv{
		handleWebhookFn: func(_ context.Context, _ http.Header, body []byte) (*WebhookEvent, error) {
			if len(body) == 0 {
				t.Error("expected non-empty webhook body")
			}
			return &WebhookEvent{PaymentKey: "key_123", EventType: "CONFIRMED"}, nil
		},
	}
	h := NewHandler(&mockPaymentSvc{}, prov)

	payload := `{"payment_key":"key_123","event_type":"CONFIRMED"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/payments/webhook", bytes.NewBufferString(payload))
	req.Header.Set("Content-Type", "application/json")

	rec := httptest.NewRecorder()
	h.HandleWebhook(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}
}
