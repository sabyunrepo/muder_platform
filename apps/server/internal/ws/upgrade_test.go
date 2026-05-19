package ws

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

func setupTestServer(t *testing.T, cfg UpgradeConfig) (*httptest.Server, *Hub) {
	t.Helper()
	logger := zerolog.Nop()
	router := NewRouter(logger)
	hub := NewHub(router, NoopPubSub{}, logger)
	handler := UpgradeHandler(hub, DefaultPlayerIDExtractor, cfg, logger)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws/game", handler)
	srv := httptest.NewServer(mux)
	t.Cleanup(func() {
		hub.Stop()
		srv.Close()
	})
	return srv, hub
}

func wsURL(srv *httptest.Server, path string) string {
	return "ws" + strings.TrimPrefix(srv.URL, "http") + path
}

func setupJWTTestServer(t *testing.T, secret []byte, cfg UpgradeConfig) (*httptest.Server, *Hub) {
	t.Helper()
	logger := zerolog.Nop()
	router := NewRouter(logger)
	hub := NewHub(router, NoopPubSub{}, logger)
	handler := UpgradeHandler(hub, JWTPlayerIDExtractor(secret), cfg, logger)

	mux := http.NewServeMux()
	mux.HandleFunc("/ws/game", handler)
	srv := httptest.NewServer(mux)
	t.Cleanup(func() {
		hub.Stop()
		srv.Close()
	})
	return srv, hub
}

func mintUpgradeToken(t *testing.T, userID uuid.UUID, secret []byte, tokenType string) string {
	t.Helper()
	claims := jwt.MapClaims{
		"sub": userID.String(),
		"exp": jwt.NewNumericDate(time.Now().Add(time.Hour)),
		"iat": jwt.NewNumericDate(time.Now()),
	}
	if tokenType != "" {
		claims["type"] = tokenType
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(secret)
	if err != nil {
		t.Fatalf("mint token: %v", err)
	}
	return token
}

func TestUpgrade_Success(t *testing.T) {
	srv, hub := setupTestServer(t, UpgradeConfig{DevMode: true})

	playerID := uuid.New()
	url := wsURL(srv, "/ws/game") + "?player_id=" + playerID.String()

	conn, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.Close()

	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("expected 101, got %d", resp.StatusCode)
	}

	// Should receive a "connected" message.
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read connected message: %v", err)
	}

	var env Envelope
	if err := json.Unmarshal(msg, &env); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}
	if env.Type != TypeConnected {
		t.Errorf("expected type %q, got %q", TypeConnected, env.Type)
	}

	var payload ConnectedPayload
	if err := json.Unmarshal(env.Payload, &payload); err != nil {
		t.Fatalf("failed to unmarshal payload: %v", err)
	}
	if payload.PlayerID != playerID {
		t.Errorf("expected playerID %s, got %s", playerID, payload.PlayerID)
	}

	// Hub should have 1 client.
	time.Sleep(50 * time.Millisecond)
	if got := hub.ClientCount(); got != 1 {
		t.Errorf("ClientCount() = %d, want 1", got)
	}
}

func TestUpgrade_MissingPlayerID(t *testing.T) {
	srv, _ := setupTestServer(t, UpgradeConfig{DevMode: true})

	url := wsURL(srv, "/ws/game") // no player_id
	_, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err == nil {
		t.Fatal("expected dial error for missing player_id")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestUpgrade_InvalidPlayerID(t *testing.T) {
	srv, _ := setupTestServer(t, UpgradeConfig{DevMode: true})

	url := wsURL(srv, "/ws/game") + "?player_id=not-a-uuid"
	_, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err == nil {
		t.Fatal("expected dial error for invalid player_id")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestJWTPlayerIDExtractorRejectsRefreshToken(t *testing.T) {
	secret := []byte("test-secret")
	srv, _ := setupJWTTestServer(t, secret, UpgradeConfig{DevMode: true})

	refreshToken := mintUpgradeToken(t, uuid.New(), secret, "refresh")
	url := wsURL(srv, "/ws/game") + "?token=" + refreshToken

	_, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err == nil {
		t.Fatal("expected dial error for refresh token")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestJWTPlayerIDExtractorAcceptsAccessToken(t *testing.T) {
	secret := []byte("test-secret")
	srv, hub := setupJWTTestServer(t, secret, UpgradeConfig{DevMode: true})

	playerID := uuid.New()
	accessToken := mintUpgradeToken(t, playerID, secret, "")
	url := wsURL(srv, "/ws/game") + "?token=" + accessToken

	conn, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.Close()
	if resp.StatusCode != http.StatusSwitchingProtocols {
		t.Fatalf("expected 101, got %d", resp.StatusCode)
	}

	time.Sleep(50 * time.Millisecond)
	if got := hub.ClientCount(); got != 1 {
		t.Errorf("ClientCount() = %d, want 1", got)
	}
}

func TestUpgrade_QueryAuthBlockedInProd(t *testing.T) {
	srv, _ := setupTestServer(t, UpgradeConfig{
		DevMode:        false,
		AllowedOrigins: "*",
	})

	playerID := uuid.New()
	url := wsURL(srv, "/ws/game") + "?player_id=" + playerID.String()

	_, resp, err := websocket.DefaultDialer.Dial(url, nil)
	if err == nil {
		t.Fatal("expected dial error: query auth should be blocked in prod")
	}
	if resp != nil && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", resp.StatusCode)
	}
}

func TestUpgrade_OriginCheck(t *testing.T) {
	srv, _ := setupTestServer(t, UpgradeConfig{
		DevMode:        false,
		AllowedOrigins: "http://allowed.example.com",
	})

	playerID := uuid.New()
	url := wsURL(srv, "/ws/game") + "?player_id=" + playerID.String()

	// Bad origin should be rejected (401 from query-param guard or 403 from origin check).
	header := http.Header{}
	header.Set("Origin", "http://evil.example.com")
	_, resp, err := websocket.DefaultDialer.Dial(url, header)
	if err == nil {
		t.Fatal("expected dial error for disallowed origin")
	}
	if resp != nil && resp.StatusCode != http.StatusForbidden && resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("expected 403 or 401, got %d", resp.StatusCode)
	}
}

func TestUpgrade_DevAllowsConfiguredLoopbackOrigins(t *testing.T) {
	origins := []string{
		"http://localhost:3000",
		"http://127.0.0.1:3000",
	}
	for _, origin := range origins {
		t.Run(origin, func(t *testing.T) {
			srv, _ := setupTestServer(t, UpgradeConfig{
				DevMode:        true,
				AllowedOrigins: "http://localhost:3000,http://127.0.0.1:3000",
			})

			playerID := uuid.New()
			url := wsURL(srv, "/ws/game") + "?player_id=" + playerID.String()
			header := http.Header{}
			header.Set("Origin", origin)

			conn, resp, err := websocket.DefaultDialer.Dial(url, header)
			if err != nil {
				t.Fatalf("dial failed for %s: %v", origin, err)
			}
			defer conn.Close()

			if resp.StatusCode != http.StatusSwitchingProtocols {
				t.Fatalf("expected 101 for %s, got %d", origin, resp.StatusCode)
			}
		})
	}
}

func TestUpgrade_PingPong(t *testing.T) {
	srv, _ := setupTestServer(t, UpgradeConfig{DevMode: true})

	playerID := uuid.New()
	url := wsURL(srv, "/ws/game") + "?player_id=" + playerID.String()

	conn, _, err := websocket.DefaultDialer.Dial(url, nil)
	if err != nil {
		t.Fatalf("dial failed: %v", err)
	}
	defer conn.Close()

	// Read the "connected" message first.
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, _, err = conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read connected: %v", err)
	}

	// Send an application-level ping, expect pong.
	ping := MustEnvelope(TypePing, nil)
	data, _ := json.Marshal(ping)
	if err := conn.WriteMessage(websocket.TextMessage, data); err != nil {
		t.Fatalf("failed to write ping: %v", err)
	}

	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		t.Fatalf("failed to read pong: %v", err)
	}

	var env Envelope
	if err := json.Unmarshal(msg, &env); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if env.Type != TypePong {
		t.Errorf("expected %q, got %q", TypePong, env.Type)
	}
}
