package ws

import "github.com/google/uuid"

// auth.* protocol payloads (PR-9 WS Auth Protocol).
//
// These describe the wire format of the eight auth.* events declared in
// envelope_catalog_system.go. The handshake follows a Discord-gateway-style
// pattern, validated against OpenID CAEP 1.0 (2025-08-29) push-revocation
// and OWASP WebSocket cheatsheet "close immediately on logout":
//
//  1. On (re)connect the server sends ConnectedPayload (existing).
//  2. The client may send auth.identify with a refreshed credential, or
//     auth.resume with (sessionId, lastSeq) to replay buffered events.
//  3. The server may pre-empt with auth.challenge (re-auth required) or
//     auth.refresh_required ahead of token expiry; on a successful
//     auth.refresh it answers with auth.token_issued (no piggyback) so
//     the client can swap tokens at a single, unambiguous point.
//  4. If a resume request cannot be honoured (last_seq behind buffer,
//     session_id stale) the server sends auth.invalid_session with
//     resumable=true → client opens fresh connection and re-identifies;
//     resumable=false → fully unauthorized, do not retry. Discord
//     INVALID_SESSION semantics.
//  5. After a forced revoke (admin action, password change,
//     logout-elsewhere) the server pushes auth.revoked and closes the
//     connection immediately.
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
// The client should reply with auth.refresh before ExpiresAt. ExpiresAt
// is an epoch-ms timestamp to match the generated TypeScript contract.
//
// wsgen:payload
type AuthRefreshRequiredPayload struct {
	ExpiresAt int64  `json:"expiresAt"`
	Reason    string `json:"reason,omitempty"`
}

// AuthTokenIssuedPayload — S2C, server's response to a successful
// auth.refresh. Carries the rotated short-lived access token plus its
// expiry, as an epoch-ms timestamp, so the client can schedule the next
// refresh deterministically.
// Sent as a dedicated frame (not piggybacked on another event) per
// videosdk 2025 / websockets.readthedocs guidance.
//
// wsgen:payload
type AuthTokenIssuedPayload struct {
	Token     string `json:"token"`
	ExpiresAt int64  `json:"expiresAt"`
}

// AuthInvalidSessionPayload — S2C, the resume target the client sent
// (session_id + last_seq) cannot be honoured. The Resumable flag tells
// the client whether reconnecting with a full auth.identify is allowed
// (true; e.g. buffer expired but the user is still valid) or whether
// the session is fully unauthorized (false; e.g. user was banned —
// auth.revoked semantics overlap, but invalid_session signals
// "your *resume target* is gone" rather than "your *user* is gone").
// Discord INVALID_SESSION pattern.
//
// wsgen:payload
type AuthInvalidSessionPayload struct {
	Resumable bool   `json:"resumable"`
	Reason    string `json:"reason"`
}
