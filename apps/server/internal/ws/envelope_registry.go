package ws

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"

	"github.com/mmp-platform/server/internal/apperror"
)

// DecoderFunc decodes a raw JSON payload into a typed value.
// Returns an error if the payload does not match the expected shape.
type DecoderFunc func(raw json.RawMessage) (any, error)

// EnvelopeRegistry maps message type strings to their payload decoders.
// It is safe for concurrent use. All game-namespaced message types that
// the session engine can handle must be registered here before the Hub starts.
type EnvelopeRegistry struct {
	mu       sync.RWMutex
	decoders map[string]DecoderFunc
}

// NewEnvelopeRegistry creates an empty registry.
func NewEnvelopeRegistry() *EnvelopeRegistry {
	return &EnvelopeRegistry{
		decoders: make(map[string]DecoderFunc),
	}
}

// Register adds a decoder for the given message type.
// Panics only on structural misuse (empty type or nil decoder).
// Duplicate registration is idempotent — the first decoder wins and later
// calls are silently ignored (L-1 fix: no more startup crash when two
// independent init() paths bootstrap the same registry).
func (r *EnvelopeRegistry) Register(typ string, fn DecoderFunc) {
	if typ == "" {
		panic("ws: EnvelopeRegistry.Register: empty type")
	}
	if fn == nil {
		panic("ws: EnvelopeRegistry.Register: nil decoder for type " + typ)
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, dup := r.decoders[typ]; dup {
		// Idempotent — first-wins. Caller likely has duplicate bootstrap path.
		return
	}
	r.decoders[typ] = fn
}

// maxTypeLength bounds attacker-controlled envelope type length to prevent
// log flooding and bloat through oversized unknown-type strings (M-6 fix).
const maxTypeLength = 64

// Decode looks up the decoder for typ and applies it to raw.
// Returns ErrUnknownMessageType (AppError) when the type is not registered
// or exceeds maxTypeLength.
func (r *EnvelopeRegistry) Decode(typ string, raw json.RawMessage) (any, error) {
	if len(typ) > maxTypeLength {
		return nil, apperror.New(
			apperror.ErrWSUnknownMessageType,
			http.StatusBadRequest,
			"message type too long",
		)
	}

	r.mu.RLock()
	fn, ok := r.decoders[typ]
	r.mu.RUnlock()

	if !ok {
		return nil, apperror.New(
			apperror.ErrWSUnknownMessageType,
			http.StatusBadRequest,
			fmt.Sprintf("unknown message type: %s", typ),
		)
	}
	return fn(raw)
}

// IsKnown reports whether typ is registered.
func (r *EnvelopeRegistry) IsKnown(typ string) bool {
	r.mu.RLock()
	_, ok := r.decoders[typ]
	r.mu.RUnlock()
	return ok
}

// Types returns a snapshot of all registered type strings.
func (r *EnvelopeRegistry) Types() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]string, 0, len(r.decoders))
	for t := range r.decoders {
		out = append(out, t)
	}
	return out
}
