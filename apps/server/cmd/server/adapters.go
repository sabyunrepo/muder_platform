package main

import (
	"encoding/json"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/session"
	"github.com/mmp-platform/server/internal/ws"
)

// --- SessionSender adapter (ws → session) ---

// managerSessionSender implements ws.SessionSender by routing inbound WS
// messages to the session actor via SessionManager.Get + Session.Send.
type managerSessionSender struct {
	mgr *session.SessionManager
}

// SendToSession looks up the session and delivers the message to its inbox.
func (a *managerSessionSender) SendToSession(msg ws.SessionMessage) error {
	s := a.mgr.Get(msg.SessionID)
	if s == nil {
		return nil // session not started yet; silently drop
	}
	var raw json.RawMessage
	if msg.Payload != nil {
		raw = json.RawMessage(msg.Payload)
	}
	return s.Send(session.SessionMessage{
		Kind:       session.KindEngineCommand,
		PlayerID:   msg.PlayerID,
		ModuleName: moduleNameForMessageType(msg.MsgType),
		MsgType:    msg.MsgType,
		Payload:    session.EngineCommandPayload{RawPayload: raw},
		Ctx:        msg.Ctx,
	})
}

func moduleNameForMessageType(msgType string) string {
	switch msgType {
	case "event:trigger":
		return "event_progression"
	default:
		return ""
	}
}

// --- Broadcaster adapter (session → ws) ---

// hubBroadcaster implements session.Broadcaster by forwarding BroadcastEnvelope
// to ws.Hub.BroadcastToSession. Lives here because session imports ws (for
// ws.Envelope) and ws must not import session — cmd/server can import both.
type hubBroadcaster struct {
	hub *ws.Hub
}

// BroadcastToSession converts a session.BroadcastEnvelope to a ws.Envelope
// and broadcasts it to all clients in the session.
func (b *hubBroadcaster) BroadcastToSession(sessionID uuid.UUID, env session.BroadcastEnvelope) {
	wsEnv := &ws.Envelope{
		Type:    env.Type,
		Payload: env.Payload,
	}
	b.hub.BroadcastToSession(sessionID, wsEnv)
}
