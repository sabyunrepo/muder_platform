package ws

import (
	"strings"
	"sync"

	"github.com/rs/zerolog"
)

// HandlerFunc processes a WebSocket message from a client.
type HandlerFunc func(c *Client, env *Envelope)

// Router dispatches incoming messages by type prefix.
// Type format: "namespace:action" (e.g., "game:vote", "chat:send").
// Handlers are registered per namespace; the router splits on ":"
// and delegates to the matching handler.
type Router struct {
	mu       sync.RWMutex
	handlers map[string]HandlerFunc // namespace → handler
	fallback HandlerFunc            // called when no handler matches
	logger   zerolog.Logger
}

// NewRouter creates a message router.
func NewRouter(logger zerolog.Logger) *Router {
	return &Router{
		handlers: make(map[string]HandlerFunc),
		logger:   logger.With().Str("component", "ws.router").Logger(),
	}
}

// Handle registers a handler for the given namespace.
// Example: r.Handle("game", gameHandler) matches all "game:*" messages.
func (r *Router) Handle(namespace string, fn HandlerFunc) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.handlers[namespace] = fn
}

// SetFallback sets a handler for messages that don't match any namespace.
func (r *Router) SetFallback(fn HandlerFunc) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.fallback = fn
}

// Route dispatches an incoming message to the appropriate handler.
// Called from Client.ReadPump via Hub.Route.
func (r *Router) Route(c *Client, env *Envelope) {
	// System messages handled internally.
	if env.Type == TypePing {
		pong := MustEnvelope(TypePong, nil)
		c.SendMessage(pong)
		return
	}

	namespace, _, _ := strings.Cut(env.Type, ":")

	r.mu.RLock()
	fn, ok := r.handlers[namespace]
	fb := r.fallback
	r.mu.RUnlock()

	if ok {
		fn(c, env)
		return
	}

	if fb != nil {
		fb(c, env)
		return
	}

	r.logger.Warn().
		Str("type", env.Type).
		Str("playerID", c.ID.String()).
		Msg("unhandled message type")

	c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage, "unknown message type: "+env.Type))
}

// Namespaces returns a list of registered namespace names.
func (r *Router) Namespaces() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ns := make([]string, 0, len(r.handlers))
	for k := range r.handlers {
		ns = append(ns, k)
	}
	return ns
}
