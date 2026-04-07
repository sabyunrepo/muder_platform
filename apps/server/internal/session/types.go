package session

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
)

// MessageKind identifies the category of a SessionMessage routed through the actor inbox.
type MessageKind int

const (
	// KindEngineCommand routes a player WS message to a specific engine module.
	KindEngineCommand MessageKind = iota
	// KindLifecycleLeft notifies the session that a player disconnected.
	KindLifecycleLeft
	// KindLifecycleRejoined notifies the session that a player reconnected.
	KindLifecycleRejoined
	// KindCriticalSnapshot requests an immediate Redis snapshot.
	KindCriticalSnapshot
	// KindAdvance requests the engine to advance to the next phase.
	KindAdvance
	// KindGMOverride requests a GM-forced phase jump.
	KindGMOverride
	// KindHandleTrigger requests a conditional phase transition.
	KindHandleTrigger
	// KindStop requests the session to gracefully shut down.
	KindStop
)

// SessionMessage is the unified message type passed into Session.inbox.
// Every external caller serializes its intent through this struct so the
// Session goroutine remains the sole mutator of engine state.
type SessionMessage struct {
	Kind     MessageKind
	PlayerID uuid.UUID
	// Payload holds kind-specific data (e.g. json.RawMessage, string for phaseID).
	Payload any
	// ModuleName is set for KindEngineCommand to route to the correct module.
	ModuleName string
	// MsgType is set for KindEngineCommand (engine module message type).
	MsgType string
	// Reply receives the handler's error (nil = success). A nil Reply means fire-and-forget.
	// Senders MUST use a buffered chan of size 1 to avoid blocking the actor.
	Reply chan error
	// Ctx carries the request context (deadline, trace, cancellation).
	Ctx context.Context
}

// SessionStatus is the lifecycle state of a Session.
type SessionStatus int

const (
	// StatusStarting means the session is initializing the engine.
	StatusStarting SessionStatus = iota
	// StatusRunning means the session's event loop is active.
	StatusRunning
	// StatusStopped means the session has exited its event loop (normal or abort).
	StatusStopped
)

// PlayerState holds per-player runtime state visible to the session actor.
type PlayerState struct {
	PlayerID  uuid.UUID
	Connected bool
}

// EngineCommandPayload is the structured payload for KindEngineCommand messages.
type EngineCommandPayload struct {
	RawPayload json.RawMessage
}
