package ws

// System / lifecycle WS events.
//
// These are bidirectional or server-initiated connection-management
// messages that apply regardless of which session or module a client is
// currently attached to.
//
// The `auth.*` block was reserved as StatusStub by PR-1 and is wired
// up by PR-9 (WS Auth Protocol). Payload shapes live in
// auth_payloads.go. Runtime gating (MMP_WS_AUTH_PROTOCOL) is enforced
// by the per-connection dispatcher in auth_protocol.go — the catalog
// stays unconditionally Active so codegen output is stable.

func init() {
	RegisterCatalog(
		// --- heartbeat / lifecycle ---
		EventDef{Type: TypePing, Direction: DirBidi, Category: "system"},
		EventDef{Type: TypePong, Direction: DirBidi, Category: "system"},
		EventDef{Type: TypeError, Direction: DirS2C, Category: "system",
			Note: "wire payload is ErrorPayload with ProblemDetail-lite recovery metadata"},
		EventDef{Type: TypeConnected, Direction: DirS2C, Category: "system",
			Note: "first server frame on upgrade; payload is ConnectedPayload"},
		EventDef{Type: TypeReconnect, Direction: DirS2C, Category: "system",
			Note: "server-initiated hint for clients to re-establish"},

		// --- auth (PR-9 WS Auth Protocol) ---
		EventDef{Type: "auth.identify", Direction: DirC2S, Category: "auth",
			Note: "client presents refreshed credentials post-upgrade; payload AuthIdentifyPayload"},
		EventDef{Type: "auth.resume", Direction: DirC2S, Category: "auth",
			Note: "client resumes session after reconnect (Discord gateway RESUME); payload AuthResumePayload"},
		EventDef{Type: "auth.refresh", Direction: DirC2S, Category: "auth",
			Note: "client requests a rotated token before expiry; payload AuthRefreshPayload"},
		EventDef{Type: "auth.challenge", Direction: DirS2C, Category: "auth",
			Note: "server asks for re-auth before a sensitive action; payload AuthChallengePayload"},
		EventDef{Type: "auth.revoked", Direction: DirS2C, Category: "auth",
			Note: "server notifies client its session was invalidated (ban, logout-elsewhere); payload AuthRevokedPayload"},
		EventDef{Type: "auth.refresh_required", Direction: DirS2C, Category: "auth",
			Note: "server signals token approaching expiry; payload AuthRefreshRequiredPayload"},
		EventDef{Type: "auth.token_issued", Direction: DirS2C, Category: "auth",
			Note: "server's response to auth.refresh — new access token + expiry; payload AuthTokenIssuedPayload"},
		EventDef{Type: "auth.invalid_session", Direction: DirS2C, Category: "auth",
			Note: "resume target stale; resumable bool guides retry policy (Discord INVALID_SESSION); payload AuthInvalidSessionPayload"},
	)
}
