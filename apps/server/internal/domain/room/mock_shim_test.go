package room

// mock_shim_test.go provides a hand-rolled mockService shim used exclusively
// by service_flag_test.go, which requires white-box access to unexported
// fields of *service (e.g. gameStarter). This shim cannot be replaced by
// gomock because it lives in package room (not room_test) and mocks only the
// StartRoom method needed for the flag-dispatch tests.
//
// TODO(phase-19-residual PR-5a): white-box 테스트가 black-box 로 전환되거나
// Service interface 가 sub-package 로 분리되어 import cycle 이 해소되면
// 이 파일을 제거하고 mocks/mock_service.go 만 사용. PR-5d PoC 에서 재평가.

import (
	"context"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/middleware"
)

// mockService is a minimal hand-rolled stub for the room.Service interface,
// used only in service_flag_test.go for white-box flag-dispatch testing.
type mockService struct {
	createRoomFn    func(ctx context.Context, hostID uuid.UUID, req CreateRoomRequest) (*RoomResponse, error)
	getRoomFn       func(ctx context.Context, roomID uuid.UUID) (*RoomDetailResponse, error)
	getRoomByCodeFn func(ctx context.Context, code string) (*RoomDetailResponse, error)
	listWaitingFn   func(ctx context.Context, limit, offset int32) ([]RoomResponse, error)
	joinRoomFn      func(ctx context.Context, roomID, userID uuid.UUID) error
	leaveRoomFn     func(ctx context.Context, roomID, userID uuid.UUID) error
	startRoomFn     func(ctx context.Context, roomID, hostID uuid.UUID, req StartRoomRequest) error
}

func (m *mockService) CreateRoom(ctx context.Context, hostID uuid.UUID, req CreateRoomRequest) (*RoomResponse, error) {
	if m.createRoomFn != nil {
		return m.createRoomFn(ctx, hostID, req)
	}
	return nil, nil
}

func (m *mockService) GetRoom(ctx context.Context, roomID uuid.UUID) (*RoomDetailResponse, error) {
	if m.getRoomFn != nil {
		return m.getRoomFn(ctx, roomID)
	}
	return nil, nil
}

func (m *mockService) GetRoomByCode(ctx context.Context, code string) (*RoomDetailResponse, error) {
	if m.getRoomByCodeFn != nil {
		return m.getRoomByCodeFn(ctx, code)
	}
	return nil, nil
}

func (m *mockService) ListWaitingRooms(ctx context.Context, limit, offset int32) ([]RoomResponse, error) {
	if m.listWaitingFn != nil {
		return m.listWaitingFn(ctx, limit, offset)
	}
	return nil, nil
}

func (m *mockService) JoinRoom(ctx context.Context, roomID, userID uuid.UUID) error {
	if m.joinRoomFn != nil {
		return m.joinRoomFn(ctx, roomID, userID)
	}
	return nil
}

func (m *mockService) LeaveRoom(ctx context.Context, roomID, userID uuid.UUID) error {
	if m.leaveRoomFn != nil {
		return m.leaveRoomFn(ctx, roomID, userID)
	}
	return nil
}

func (m *mockService) StartRoom(ctx context.Context, roomID, hostID uuid.UUID, req StartRoomRequest) error {
	if m.startRoomFn != nil {
		return m.startRoomFn(ctx, roomID, hostID, req)
	}
	return nil
}

// withAuth injects a user ID into the request context (white-box helpers).
func withAuth(r *http.Request, userID uuid.UUID) *http.Request {
	ctx := context.WithValue(r.Context(), middleware.UserIDKey, userID)
	return r.WithContext(ctx)
}

// withChiParam injects a chi URL parameter into the request context.
func withChiParam(r *http.Request, key, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	return r.WithContext(context.WithValue(r.Context(), chi.RouteCtxKey, rctx))
}
