package ws

import (
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// TODO Phase 6: validate against CORS origins from config.
		return true
	},
}

// PlayerIDFromContext extracts the player ID set by auth middleware.
// Phase 6 will implement JWT middleware; for now accept a query param.
type PlayerIDExtractor func(r *http.Request) (uuid.UUID, error)

// DefaultPlayerIDExtractor reads "player_id" query param (dev only).
func DefaultPlayerIDExtractor(r *http.Request) (uuid.UUID, error) {
	raw := r.URL.Query().Get("player_id")
	if raw == "" {
		return uuid.Nil, ErrMissingPlayerID
	}
	return uuid.Parse(raw)
}

// UpgradeHandler returns an http.HandlerFunc that upgrades HTTP to WebSocket
// and registers the client with the Hub.
func UpgradeHandler(hub *Hub, extractPlayerID PlayerIDExtractor, logger zerolog.Logger) http.HandlerFunc {
	log := logger.With().Str("component", "ws.upgrade").Logger()

	return func(w http.ResponseWriter, r *http.Request) {
		playerID, err := extractPlayerID(r)
		if err != nil {
			log.Warn().Err(err).Msg("invalid player ID on upgrade")
			http.Error(w, "invalid player_id", http.StatusBadRequest)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Error().Err(err).Msg("websocket upgrade failed")
			return
		}

		client := NewClient(playerID, conn, hub, logger)
		hub.Register(client)

		go client.WritePump()
		go client.ReadPump()
	}
}
