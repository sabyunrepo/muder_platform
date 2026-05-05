package ws

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
)

// Reading message types — both directions.
const (
	// C→S
	TypeReadingAdvance    = "reading:advance"
	TypeReadingVoiceEnded = "reading:voice_ended"

	// S→C
	TypeReadingState       = "reading:state"
	TypeReadingStarted     = "reading:started"
	TypeReadingLineChanged = "reading:line_changed"
	TypeReadingPaused      = "reading:paused"
	TypeReadingResumed     = "reading:resumed"
	TypeReadingCompleted   = "reading:completed"
)

// ReadingModuleAPI is the subset of the reading.ReadingModule surface that
// the WS handler depends on. Defined as an interface here so the ws package
// stays free of a hard dependency on the reading package and so handlers
// are trivially testable with a fake module.
type ReadingModuleAPI interface {
	HandleAdvance(ctx context.Context, playerID uuid.UUID, isHost bool, roleID string) error
	HandleVoiceEnded(ctx context.Context, voiceID string) error
	HandlePlayerLeft(ctx context.Context, hostLeaving bool, leftRoleIDs []string)
	HandlePlayerRejoined(ctx context.Context, hostRejoining bool, rejoinedRoleIDs []string)
	GetReadingStateSnapshot() ReadingStateSnapshot
}

// ReadingStateSnapshot mirrors reading.ReadingState in a ws-package-local
// shape so the ws package does not import reading. The reading module's
// adapter (see ReadingModuleAdapter) maps between the two.
type ReadingStateSnapshot struct {
	SectionID    string          `json:"sectionId"`
	CurrentIndex int             `json:"currentIndex"`
	Lines        json.RawMessage `json:"lines"`
	BgmMediaID   string          `json:"bgmMediaId,omitempty"`
	Status       string          `json:"status"`
}

// ReadingSessionResolver looks up per-session game-engine state needed by
// the reading WS handler. Implementations are provided by whoever wires the
// engine into main.go (out of scope for this handler — see Phase 7.7 wiring).
//
// LookupModule returns nil if the session has no active reading module.
// LookupRole returns the player's role id and host status; ok=false means
// the player is not currently a member of the session.
type ReadingSessionResolver interface {
	LookupModule(sessionID uuid.UUID) ReadingModuleAPI
	LookupRole(sessionID, playerID uuid.UUID) (roleID string, isHost bool, ok bool)
	// LookupSectionID returns the active reading section id for a session, or
	// empty string if unknown. The reading module itself does not track its
	// owning section id; the session registry does.
	LookupSectionID(sessionID uuid.UUID) string
}

// ReadingClientSender abstracts the per-client send path so tests can plug
// in a fake without standing up a real Hub. *Client satisfies it.
type ReadingClientSender interface {
	SendMessage(env *Envelope)
}

// ReadingBroadcaster abstracts the session-broadcast path so tests can plug
// in a fake without standing up a real Hub. *Hub satisfies it.
type ReadingBroadcaster interface {
	BroadcastToSession(sessionID uuid.UUID, env *Envelope)
}

// ReadingWSHandler routes reading:* messages and exposes the disconnect /
// reconnect / event-bridge integration points used by the engine layer.
type ReadingWSHandler struct {
	resolver ReadingSessionResolver
	hub      ReadingBroadcaster
	logger   zerolog.Logger
}

// NewReadingWSHandler constructs a handler. resolver is required; hub may
// be nil only in tests that exercise the C→S path without broadcasting.
func NewReadingWSHandler(hub ReadingBroadcaster, resolver ReadingSessionResolver, logger zerolog.Logger) *ReadingWSHandler {
	return &ReadingWSHandler{
		resolver: resolver,
		hub:      hub,
		logger:   logger.With().Str("component", "reading.ws").Logger(),
	}
}

// Handle is the router entry point registered as the "reading" namespace
// handler. It dispatches to per-message handlers and writes structured
// errors back to the originating client.
func (h *ReadingWSHandler) Handle(c *Client, env *Envelope) {
	switch env.Type {
	case TypeReadingAdvance:
		h.handleAdvance(c, env)
	case TypeReadingVoiceEnded:
		h.handleVoiceEnded(c, env)
	default:
		h.logger.Warn().
			Str("type", env.Type).
			Stringer("playerId", c.ID).
			Msg("unknown reading event type")
		c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage, "unknown reading event type: "+env.Type))
	}
}

// handleAdvance is the C→S advance entry point. It looks up the player's
// role and host status from the session resolver, then delegates to the
// permission-checked HandleAdvance on the module. AppErrors from the module
// are translated into structured ws errors so clients can map them.
func (h *ReadingWSHandler) handleAdvance(c *Client, _ *Envelope) {
	if c.SessionID == uuid.Nil {
		c.SendMessage(NewErrorEnvelope(ErrCodeUnauthorized, "must join a session first"))
		return
	}

	mod := h.resolver.LookupModule(c.SessionID)
	if mod == nil {
		c.SendMessage(newReadingError(ErrCodeNotFound, apperror.ErrReadingSectionNotFound, "reading: module not active"))
		return
	}

	roleID, isHost, ok := h.resolver.LookupRole(c.SessionID, c.ID)
	if !ok {
		c.SendMessage(NewErrorEnvelope(ErrCodeUnauthorized, "player not in session"))
		return
	}

	if err := mod.HandleAdvance(context.Background(), c.ID, isHost, roleID); err != nil {
		c.SendMessage(translateReadingError(err))
		return
	}
}

// readingVoiceEndedPayload is the wire shape for the C→S voice ended event.
type readingVoiceEndedPayload struct {
	VoiceID string `json:"voiceId"`
}

// handleVoiceEnded is server-trusted (the client merely reports media
// completion). Permission checks for role/host are bypassed because the
// underlying line is configured with advanceBy="voice".
func (h *ReadingWSHandler) handleVoiceEnded(c *Client, env *Envelope) {
	if c.SessionID == uuid.Nil {
		c.SendMessage(NewErrorEnvelope(ErrCodeUnauthorized, "must join a session first"))
		return
	}

	mod := h.resolver.LookupModule(c.SessionID)
	if mod == nil {
		// Voice-ended on an inactive module is a no-op, not an error.
		return
	}

	var payload readingVoiceEndedPayload
	if len(env.Payload) > 0 {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			c.SendMessage(NewErrorEnvelope(ErrCodeBadMessage, "invalid reading:voice_ended payload"))
			return
		}
	}

	if err := mod.HandleVoiceEnded(context.Background(), payload.VoiceID); err != nil {
		// HandleVoiceEnded is best-effort; log but don't error to client.
		h.logger.Debug().
			Err(err).
			Stringer("playerId", c.ID).
			Stringer("sessionId", c.SessionID).
			Str("voiceId", payload.VoiceID).
			Msg("reading:voice_ended advance ignored")
	}
}

// OnPlayerLeft is invoked by the WS layer's disconnect path. It looks up
// the leaving player's role/host info and notifies the reading module.
// Safe to call when no reading module is active.
func (h *ReadingWSHandler) OnPlayerLeft(sessionID, playerID uuid.UUID) {
	if sessionID == uuid.Nil {
		return
	}
	mod := h.resolver.LookupModule(sessionID)
	if mod == nil {
		return
	}
	roleID, isHost, ok := h.resolver.LookupRole(sessionID, playerID)
	if !ok {
		// Player was already gone or never tracked — fall back to a no-op
		// HandlePlayerLeft call so the module's idempotent guards take effect.
		return
	}
	var roles []string
	if roleID != "" {
		roles = []string{roleID}
	}
	mod.HandlePlayerLeft(context.Background(), isHost, roles)
}

// OnPlayerRejoined is invoked by the WS layer's reconnect path. It notifies
// the reading module of the rejoin and then pushes a reading:state envelope
// to the reconnecting client only (not a broadcast) so the local UI can
// rebuild from a known snapshot.
func (h *ReadingWSHandler) OnPlayerRejoined(c *Client) {
	if c == nil || c.SessionID == uuid.Nil {
		return
	}
	mod := h.resolver.LookupModule(c.SessionID)
	if mod == nil {
		return
	}
	roleID, isHost, ok := h.resolver.LookupRole(c.SessionID, c.ID)
	if ok {
		var roles []string
		if roleID != "" {
			roles = []string{roleID}
		}
		mod.HandlePlayerRejoined(context.Background(), isHost, roles)
	}

	// Push current state to the reconnecting client only.
	state := mod.GetReadingStateSnapshot()
	if state.SectionID == "" {
		state.SectionID = h.resolver.LookupSectionID(c.SessionID)
	}
	env, err := NewEnvelope(TypeReadingState, state)
	if err != nil {
		h.logger.Error().Err(err).Msg("failed to marshal reading:state envelope")
		return
	}
	c.SendMessage(env)
}

// PushReadingStateTo is exposed for callers (e.g. integration tests, manual
// recovery flows) that want to push the current reading state to a single
// client without going through the rejoin hook.
func (h *ReadingWSHandler) PushReadingStateTo(sender ReadingClientSender, sessionID uuid.UUID) {
	if sender == nil || sessionID == uuid.Nil {
		return
	}
	mod := h.resolver.LookupModule(sessionID)
	if mod == nil {
		return
	}
	state := mod.GetReadingStateSnapshot()
	if state.SectionID == "" {
		state.SectionID = h.resolver.LookupSectionID(sessionID)
	}
	env, err := NewEnvelope(TypeReadingState, state)
	if err != nil {
		h.logger.Error().Err(err).Msg("failed to marshal reading:state envelope")
		return
	}
	sender.SendMessage(env)
}

// readingEventBridge is the set of engine event types this handler forwards
// to WS clients as reading:* envelopes. The mapping is intentionally explicit
// so a typo in the engine layer doesn't silently leak unrelated events.
var readingEventBridge = map[string]string{
	"reading.started":      TypeReadingStarted,
	"reading.line_changed": TypeReadingLineChanged,
	"reading.paused":       TypeReadingPaused,
	"reading.resumed":      TypeReadingResumed,
	"reading.completed":    TypeReadingCompleted,
}

// readingStartedLineStorage mirrors reading.readingLineConfig (PascalCase)
// and is used only to decode the raw storage shape the reading module
// publishes via reading.started. It stays local to the ws package so there is
// no import cycle with the bridge package.
type readingStartedLineStorage struct {
	Index        int    `json:"Index"`
	Text         string `json:"Text,omitempty"`
	VoiceID      string `json:"VoiceID,omitempty"`
	AdvanceBy    string `json:"AdvanceBy,omitempty"`
	Speaker      string `json:"Speaker,omitempty"`
	VoiceMediaID string `json:"VoiceMediaID,omitempty"`
}

// readingStartedLineWire is the camelCase per-line shape FE consumers expect
// inside the reading:started envelope. Mirrors bridge.readingLineWire —
// duplicated here because ws cannot import bridge.
type readingStartedLineWire struct {
	Index        int    `json:"index"`
	Text         string `json:"text,omitempty"`
	VoiceID      string `json:"voiceId,omitempty"`
	AdvanceBy    string `json:"advanceBy,omitempty"`
	Speaker      string `json:"speaker,omitempty"`
	VoiceMediaID string `json:"voiceMediaId,omitempty"`
}

// readingStartedPayloadWire is the envelope payload broadcast to FE as
// reading:started. bgmMediaId is omitted when empty to match the rest of the
// reading envelope contract (FE treats absent as "no section BGM override").
type readingStartedPayloadWire struct {
	SectionID  string                   `json:"sectionId"`
	Lines      []readingStartedLineWire `json:"lines"`
	BgmMediaID string                   `json:"bgmMediaId,omitempty"`
	TotalLines int                      `json:"totalLines,omitempty"`
}

// convertReadingStartedPayload decodes the engine reading.started payload
// (which carries lines in PascalCase storage form) into the camelCase FE
// wire shape. The resolver supplies the owning sectionId since the reading
// module itself does not track it. On decode failure the returned payload
// has an empty lines slice so the outer envelope remains valid JSON.
func (h *ReadingWSHandler) convertReadingStartedPayload(sessionID uuid.UUID, payload any) readingStartedPayloadWire {
	out := readingStartedPayloadWire{
		SectionID: h.resolver.LookupSectionID(sessionID),
		Lines:     []readingStartedLineWire{},
	}
	// Round-trip through JSON so we can accept either a map[string]any or a
	// typed struct from the engine.
	raw, err := json.Marshal(payload)
	if err != nil {
		h.logger.Error().Err(err).Msg("reading.started: marshal payload")
		return out
	}
	var decoded struct {
		Lines      []readingStartedLineStorage `json:"lines"`
		BgmMediaID string                      `json:"bgmMediaId,omitempty"`
		TotalLines int                         `json:"totalLines,omitempty"`
	}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		h.logger.Error().Err(err).Msg("reading.started: decode payload")
		return out
	}
	out.BgmMediaID = decoded.BgmMediaID
	out.TotalLines = decoded.TotalLines
	wire := make([]readingStartedLineWire, len(decoded.Lines))
	for i, s := range decoded.Lines {
		wire[i] = readingStartedLineWire{
			Index:        s.Index,
			Text:         s.Text,
			VoiceID:      s.VoiceID,
			AdvanceBy:    s.AdvanceBy,
			Speaker:      s.Speaker,
			VoiceMediaID: s.VoiceMediaID,
		}
	}
	out.Lines = wire
	return out
}

// ForwardEvent converts an engine reading.* event to a ws envelope and
// broadcasts it to the session. Wired by the per-session bridge that owns
// EventBus subscriptions (see internal/bridge/voice_bridge.go for the
// equivalent voice bridge pattern).
//
// Returns true if the event was a known reading event and was broadcast.
func (h *ReadingWSHandler) ForwardEvent(sessionID uuid.UUID, eventType string, payload any) bool {
	wsType, ok := readingEventBridge[eventType]
	if !ok {
		return false
	}
	if h.hub == nil {
		h.logger.Warn().Str("event", eventType).Msg("ForwardEvent called but hub is nil")
		return false
	}

	// reading.started needs per-line PascalCase → camelCase conversion
	// because the engine module publishes raw storage shapes. All other
	// reading.* events already use camelCase on the wire.
	wirePayload := payload
	if eventType == "reading.started" {
		wirePayload = h.convertReadingStartedPayload(sessionID, payload)
	}

	env, err := NewEnvelope(wsType, wirePayload)
	if err != nil {
		h.logger.Error().Err(err).Str("event", eventType).Msg("failed to marshal reading event envelope")
		return false
	}
	h.hub.BroadcastToSession(sessionID, env)
	return true
}

// translateReadingError converts an *apperror.AppError returned by the
// reading module into a ws error envelope. The original error code is
// preserved in the message body for client-side handling.
func translateReadingError(err error) *Envelope {
	var ae *apperror.AppError
	if errors.As(err, &ae) {
		return NewAppErrorEnvelope(ae, false)
	}
	return NewErrorEnvelope(ErrCodeInternalError, "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.")
}

// appErrorToWSCode maps an apperror code to the closest WS error code.
// Reading-domain codes get categorized so existing FE error handlers
// (which key off the numeric ws code) still route correctly, while the
// string code travels in the message body for finer-grained handling.
func appErrorToWSCode(ae *apperror.AppError) ErrorCode {
	switch ae.Code {
	case apperror.ErrReadingAdvanceForbidden:
		return ErrCodeUnauthorized
	case apperror.ErrReadingLineOutOfRange,
		apperror.ErrReadingSectionNotFound:
		return ErrCodeNotFound
	case apperror.ErrReadingInvalidAdvanceBy,
		apperror.ErrReadingVoiceRequired:
		return ErrCodeBadMessage
	case apperror.ErrMediaReferenceInUse:
		// No dedicated WS conflict code; surface as a bad-message-style
		// rejection so the FE can show a "still in use" toast. The string
		// apperror code travels in the body for finer-grained handling.
		return ErrCodeBadMessage
	}
	return ErrCodeInternalError
}

// newReadingError builds a ws error envelope tagged with a reading error code
// for cases where the module isn't even reachable (e.g. inactive). The caller
// supplies both the numeric WS code (for FE routing) and the apperror string
// code (for fine-grained handling).
func newReadingError(wsCode ErrorCode, code, detail string) *Envelope {
	return MustEnvelope(TypeError, ErrorPayload{
		Code:    wsCode,
		Message: code + ": " + detail,
	})
}
