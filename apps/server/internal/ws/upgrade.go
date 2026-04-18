package ws

import (
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/mmp-platform/server/internal/apperror"
	"github.com/rs/zerolog"
)

// UpgradeConfig holds settings for the WebSocket upgrade handler.
type UpgradeConfig struct {
	// AllowedOrigins is a comma-separated list of allowed origins.
	// Empty or "*" allows all (dev only).
	AllowedOrigins string
	// DevMode enables insecure defaults (query-param auth).
	DevMode bool
}

// newUpgrader creates a websocket.Upgrader with origin checking.
func newUpgrader(cfg UpgradeConfig) websocket.Upgrader {
	origins := parseOrigins(cfg.AllowedOrigins)
	return websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			if cfg.DevMode && (len(origins) == 0 || origins["*"]) {
				return true
			}
			origin := r.Header.Get("Origin")
			if origin == "" {
				return false
			}
			return origins[origin]
		},
	}
}

func parseOrigins(raw string) map[string]bool {
	m := make(map[string]bool)
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			m[o] = true
		}
	}
	return m
}

// PlayerIDExtractor extracts the player ID from the upgrade request.
// Phase 6 will implement JWT middleware; for now accept a query param in dev.
type PlayerIDExtractor func(r *http.Request) (uuid.UUID, error)

// DefaultPlayerIDExtractor reads "player_id" query param (dev mode only).
func DefaultPlayerIDExtractor(r *http.Request) (uuid.UUID, error) {
	raw := r.URL.Query().Get("player_id")
	if raw == "" {
		return uuid.Nil, ErrMissingPlayerID
	}
	return uuid.Parse(raw)
}

// JWTPlayerIDExtractor returns a PlayerIDExtractor that validates a JWT token
// from the "token" query parameter and extracts the user ID from the subject claim.
// This is used for WebSocket connections where Authorization headers are not available.
func JWTPlayerIDExtractor(secret []byte) PlayerIDExtractor {
	return func(r *http.Request) (uuid.UUID, error) {
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			return uuid.Nil, ErrMissingPlayerID
		}

		token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, ErrQueryAuthNotAllowed
			}
			return secret, nil
		})
		if err != nil || !token.Valid {
			return uuid.Nil, ErrQueryAuthNotAllowed
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			return uuid.Nil, ErrQueryAuthNotAllowed
		}

		sub, _ := claims.GetSubject()
		return uuid.Parse(sub)
	}
}

// UpgradeHandler returns an http.HandlerFunc that upgrades HTTP to WebSocket
// and registers the client with the Hub.
func UpgradeHandler(hub ClientHub, extractPlayerID PlayerIDExtractor, cfg UpgradeConfig, logger zerolog.Logger) http.HandlerFunc {
	log := logger.With().Str("component", "ws.upgrade").Logger()
	up := newUpgrader(cfg)

	if !cfg.DevMode {
		// Guard: query-param auth is only allowed in dev mode.
		origExtractor := extractPlayerID
		extractPlayerID = func(r *http.Request) (uuid.UUID, error) {
			if r.URL.Query().Has("player_id") {
				return uuid.Nil, ErrQueryAuthNotAllowed
			}
			return origExtractor(r)
		}
	}

	return func(w http.ResponseWriter, r *http.Request) {
		playerID, err := extractPlayerID(r)
		if err != nil {
			log.Warn().Err(err).Msg("invalid player ID on upgrade")
			apperror.WriteError(w, r, apperror.Unauthorized("unauthorized").Wrap(err))
			return
		}

		conn, err := up.Upgrade(w, r, nil)
		if err != nil {
			log.Error().Err(err).Msg("websocket upgrade failed")
			return
		}

		client := NewClient(playerID, conn, hub, logger)
		hub.Register(client)

		// Send connected confirmation with baseline seq for reconnection.
		client.SendMessage(MustEnvelope(TypeConnected, ConnectedPayload{
			PlayerID: playerID,
			Seq:      0,
		}))

		go client.WritePump()
		go client.ReadPump()
	}
}
