package voice

import (
	"context"
	"fmt"
	"time"

	"github.com/livekit/protocol/auth"
	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"github.com/rs/zerolog"

	"github.com/google/uuid"
)

// VoiceProvider defines the interface for voice chat backend operations.
type VoiceProvider interface {
	GenerateToken(ctx context.Context, params TokenParams) (string, error)
	CreateRoom(ctx context.Context, name string) error
	DestroyRoom(ctx context.Context, name string) error
}

// TokenParams holds the parameters required to generate a voice room token.
type TokenParams struct {
	SessionID  uuid.UUID
	PlayerID   uuid.UUID
	RoomName   string
	PlayerName string
	TTL        time.Duration
}

// livekitProvider is the LiveKit implementation of VoiceProvider.
type livekitProvider struct {
	apiKey    string
	apiSecret string
	url       string
	client    *lksdk.RoomServiceClient
}

// NewLiveKitProvider creates a new LiveKit-backed VoiceProvider.
func NewLiveKitProvider(url, apiKey, apiSecret string) VoiceProvider {
	client := lksdk.NewRoomServiceClient(url, apiKey, apiSecret)
	return &livekitProvider{
		apiKey:    apiKey,
		apiSecret: apiSecret,
		url:       url,
		client:    client,
	}
}

// GenerateToken creates a signed JWT for a player to join a LiveKit room.
func (p *livekitProvider) GenerateToken(_ context.Context, params TokenParams) (string, error) {
	at := auth.NewAccessToken(p.apiKey, p.apiSecret)
	at.SetIdentity(params.PlayerID.String())
	at.SetValidFor(params.TTL)
	at.SetVideoGrant(&auth.VideoGrant{
		RoomJoin: true,
		Room:     params.RoomName,
	})

	token, err := at.ToJWT()
	if err != nil {
		return "", fmt.Errorf("voice: failed to generate token: %w", err)
	}
	return token, nil
}

// CreateRoom ensures a LiveKit room exists (idempotent).
func (p *livekitProvider) CreateRoom(ctx context.Context, name string) error {
	_, err := p.client.CreateRoom(ctx, &livekit.CreateRoomRequest{
		Name: name,
	})
	if err != nil {
		return fmt.Errorf("voice: failed to create room %q: %w", name, err)
	}
	return nil
}

// DestroyRoom deletes a LiveKit room.
func (p *livekitProvider) DestroyRoom(ctx context.Context, name string) error {
	_, err := p.client.DeleteRoom(ctx, &livekit.DeleteRoomRequest{
		Room: name,
	})
	if err != nil {
		return fmt.Errorf("voice: failed to destroy room %q: %w", name, err)
	}
	return nil
}

// mockProvider is the development/test implementation of VoiceProvider.
type mockProvider struct {
	logger zerolog.Logger
}

// NewMockProvider creates a mock VoiceProvider for development and testing.
func NewMockProvider(logger zerolog.Logger) VoiceProvider {
	return &mockProvider{
		logger: logger.With().Str("provider", "voice-mock").Logger(),
	}
}

// GenerateToken returns a deterministic mock token for testing.
//
// SECURITY: do not log the token value itself — even mock tokens mirror the
// real LiveKit JWT shape, and leaking them here would normalize the pattern
// for production providers. player_id + room uniquely identify the request.
func (m *mockProvider) GenerateToken(_ context.Context, params TokenParams) (string, error) {
	token := fmt.Sprintf("mock-token-%s", params.PlayerID.String())
	m.logger.Debug().
		Str("room", params.RoomName).
		Str("player_id", params.PlayerID.String()).
		Msg("mock: generated token")
	return token, nil
}

// CreateRoom logs the room creation without performing any real operation.
func (m *mockProvider) CreateRoom(_ context.Context, name string) error {
	m.logger.Debug().Str("room", name).Msg("mock: create room")
	return nil
}

// DestroyRoom logs the room destruction without performing any real operation.
func (m *mockProvider) DestroyRoom(_ context.Context, name string) error {
	m.logger.Debug().Str("room", name).Msg("mock: destroy room")
	return nil
}
