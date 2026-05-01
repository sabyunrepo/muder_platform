package ws

import (
	"context"
	"encoding/json"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog"
)

const (
	// writeWait is the max time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// pongWait is the max time to wait for a pong response from the peer.
	pongWait = 60 * time.Second

	// pingPeriod sends pings at this interval. Must be less than pongWait.
	pingPeriod = (pongWait * 9) / 10 // 54s

	// maxMessageSize is the maximum size of an incoming message (64 KB).
	maxMessageSize = 64 * 1024

	// sendBufSize is the capacity of the outgoing message channel.
	sendBufSize = 256
)

// ClientHub is the minimal interface a Client needs from its hub.
// Both Hub (game) and SocialHub implement this.
type ClientHub interface {
	Register(c *Client)
	Unregister(c *Client)
	Route(sender *Client, env *Envelope)
}

// Client represents a single WebSocket connection (one player).
type Client struct {
	ID         uuid.UUID
	SessionID  uuid.UUID // game session this client belongs to (zero if lobby)
	conn       *websocket.Conn
	hub        ClientHub
	send       chan []byte
	seq        uint64 // monotonic server sequence number (atomic)
	closed     atomic.Bool
	logger     zerolog.Logger
	closedOnce sync.Once

	// ctx is cancelled when Close runs; handlers performing Redis or DB
	// I/O on behalf of this connection (auth.identify revoke lookup,
	// auth.refresh JTI rotation, etc.) pass ctx so a peer disconnect
	// aborts the in-flight call instead of leaving a zombie goroutine
	// blocked on a slow backing store. See PR-9 H-2.
	ctx    context.Context
	cancel context.CancelFunc
}

// NewClient creates a Client bound to the given connection and hub.
func NewClient(id uuid.UUID, conn *websocket.Conn, hub ClientHub, logger zerolog.Logger) *Client {
	ctx, cancel := context.WithCancel(context.Background())
	return &Client{
		ID:     id,
		conn:   conn,
		hub:    hub,
		send:   make(chan []byte, sendBufSize),
		logger: logger.With().Stringer("playerId", id).Logger(),
		ctx:    ctx,
		cancel: cancel,
	}
}

// Context returns a context that is cancelled when the Client is closed.
// Handlers performing per-connection I/O should pass it through so the
// call aborts on disconnect.
func (c *Client) Context() context.Context {
	return c.ctx
}

// ReadPump reads messages from the WebSocket connection and routes them to the hub.
// It must be run as a dedicated goroutine per client. When ReadPump returns the
// connection is considered dead and the client is unregistered.
func (c *Client) ReadPump() {
	defer func() {
		c.hub.Unregister(c)
		c.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	if err := c.conn.SetReadDeadline(time.Now().Add(pongWait)); err != nil {
		c.logger.Error().Err(err).Msg("failed to set initial read deadline")
		return
	}
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(pongWait))
	})

	for {
		_, msg, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseNormalClosure,
				websocket.CloseNoStatusReceived,
			) {
				c.logger.Warn().Err(err).Msg("unexpected close")
			}
			return
		}

		var env Envelope
		if err := json.Unmarshal(msg, &env); err != nil {
			c.logger.Warn().Err(err).Msg("invalid envelope JSON")
			c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage, "invalid message format"))
			continue
		}

		if env.Type == "" {
			c.logger.Warn().Msg("envelope missing type")
			c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage, "message type is required"))
			continue
		}

		c.hub.Route(c, &env)
	}
}

// WritePump pumps messages from the send channel to the WebSocket connection.
// It must be run as a dedicated goroutine per client.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			if !ok {
				// send channel closed; write a close frame and exit.
				_ = c.conn.SetWriteDeadline(time.Now().Add(writeWait))
				_ = c.conn.WriteMessage(websocket.CloseMessage, nil)
				return
			}

			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				c.logger.Error().Err(err).Msg("failed to set write deadline")
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				c.logger.Error().Err(err).Msg("failed to get writer")
				return
			}

			// Write the first message.
			if _, err := w.Write(msg); err != nil {
				c.logger.Error().Err(err).Msg("failed to write message")
				return
			}

			// Coalesce queued messages into the same write batch.
			// Each message is a separate JSON object delimited by newline.
			n := len(c.send)
			for i := 0; i < n; i++ {
				if _, err := w.Write([]byte{'\n'}); err != nil {
					c.logger.Error().Err(err).Msg("failed to write delimiter")
					return
				}
				queued := <-c.send
				if _, err := w.Write(queued); err != nil {
					c.logger.Error().Err(err).Msg("failed to write coalesced message")
					return
				}
			}

			if err := w.Close(); err != nil {
				c.logger.Error().Err(err).Msg("failed to close writer")
				return
			}

		case <-ticker.C:
			if err := c.conn.SetWriteDeadline(time.Now().Add(writeWait)); err != nil {
				c.logger.Error().Err(err).Msg("failed to set ping write deadline")
				return
			}
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.logger.Warn().Err(err).Msg("failed to send ping")
				return
			}
		}
	}
}

// SendMessage shallow-copies the envelope, stamps it with a per-client monotonic
// sequence number, and queues it for delivery. If the send buffer is full or the
// client is closed, the message is dropped.
func (c *Client) SendMessage(env *Envelope) {
	if c.closed.Load() {
		return
	}

	// Shallow copy so concurrent broadcasts don't share seq/ts mutations.
	stamped := *env
	stamped.Seq = atomic.AddUint64(&c.seq, 1)
	stamped.TS = time.Now().UnixMilli()

	data, err := json.Marshal(&stamped)
	if err != nil {
		c.logger.Error().Err(err).Str("type", stamped.Type).Msg("failed to marshal envelope")
		return
	}

	// Double-check after marshal — Close() may have fired in the meantime.
	if c.closed.Load() {
		return
	}

	select {
	case c.send <- data:
	default:
		c.logger.Warn().
			Str("type", stamped.Type).
			Uint64("seq", stamped.Seq).
			Int("bufLen", len(c.send)).
			Msg("send buffer full, dropping message")
	}
}

// Close safely shuts down the client connection. It is idempotent.
func (c *Client) Close() {
	c.closedOnce.Do(func() {
		c.logger.Debug().Msg("closing client connection")
		c.closed.Store(true)
		if c.cancel != nil {
			c.cancel()
		}
		close(c.send)
		if c.conn != nil {
			_ = c.conn.Close()
		}
	})
}
