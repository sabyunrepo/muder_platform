package ws

import (
	"time"

	"github.com/google/uuid"
)

// auth.* protocol payloads (PR-9 WS Auth Protocol).
//
// These describe the wire format of the six auth.* events declared in
// envelope_catalog_system.go. The handshake follows a Discord-gateway-style
// pattern:
//
//  1. On (re)connect the server sends ConnectedPayload (existing).
//  2. The client may send auth.identify with a refreshed credential, or
//     auth.resume with (sessionId, lastSeq) to replay buffered events.
//  3. The server may pre-empt with auth.challenge (re-auth required), or
//     send auth.refresh_required ahead of token expiry. After a forced
//     revoke (admin action, password change, logout-elsewhere) it pushes
//     auth.revoked and closes the connection.
//
// Runtime gating is layered on top of the catalog by the per-connection
// dispatcher (see auth_protocol.go, added in PR-9 Task 3). The
// MMP_WS_AUTH_PROTOCOL feature flag controls whether inbound
// auth.identify/resume/refresh frames are processed and whether the
// server emits auth.challenge/revoked/refresh_required. The catalog
// itself is unconditionally Active so codegen output does not flap with
// the flag.

// AuthIdentifyPayload — C2S, sent post-upgrade with a refreshed credential.
//
// wsgen:payload
type AuthIdentifyPayload struct {
	Token         string    `json:"token"`
	SessionID     uuid.UUID `json:"sessionId,omitempty"`
	ClientLastSeq uint64    `json:"clientLastSeq,omitempty"`
}

// AuthResumePayload — C2S, sent on reconnect to replay missed events.
//
// wsgen:payload
type AuthResumePayload struct {
	Token     string    `json:"token"`
	SessionID uuid.UUID `json:"sessionId"`
	LastSeq   uint64    `json:"lastSeq"`
}

// AuthRefreshPayload — C2S, request a rotated short-lived token.
//
// wsgen:payload
type AuthRefreshPayload struct {
	Token string `json:"token"`
}

// AuthChallengePayload — S2C, server demands re-authentication before a
// sensitive action proceeds.
//
// wsgen:payload
type AuthChallengePayload struct {
	Reason string `json:"reason"`
	Action string `json:"action,omitempty"`
}

// AuthRevokedPayload — S2C, the session has been invalidated and the
// connection is closing. Code is one of: "banned",
// "logged_out_elsewhere", "password_changed", "admin_revoked".
//
// wsgen:payload
type AuthRevokedPayload struct {
	Reason string `json:"reason"`
	Code   string `json:"code"`
}

// AuthRefreshRequiredPayload — S2C, the token is approaching expiry.
// The client should reply with auth.refresh before ExpiresAt.
//
// wsgen:payload
type AuthRefreshRequiredPayload struct {
	ExpiresAt time.Time `json:"expiresAt"`
	Reason    string    `json:"reason,omitempty"`
}
