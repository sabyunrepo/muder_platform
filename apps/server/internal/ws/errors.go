package ws

import "errors"

var (
	ErrMissingPlayerID = errors.New("ws: missing player_id")
	ErrSessionNotFound = errors.New("ws: session not found")
	ErrPlayerNotFound  = errors.New("ws: player not found")
	ErrSendBufferFull  = errors.New("ws: send buffer full, dropping message")
)
