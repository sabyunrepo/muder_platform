package ws

// System / lifecycle WS events.
//
// These are bidirectional or server-initiated connection-management
// messages that apply regardless of which session or module a client is
// currently attached to.
//
// The `auth.*` block is a StatusStub placeholder reserved for PR-9 (WS
// Auth Protocol) — the current rebuild uses query-token upgrade auth only,
// so no server handler exists yet and BootstrapRegistry skips these.
// They appear in Catalog purely so the codegen-produced frontend enum
// keeps stable names for the upcoming rollout.

func init() {
	RegisterCatalog(
		// --- heartbeat / lifecycle ---
		EventDef{Type: TypePing, Direction: DirBidi, Category: "system"},
		EventDef{Type: TypePong, Direction: DirBidi, Category: "system"},
		EventDef{Type: TypeError, Direction: DirS2C, Category: "system",
			Note: "wire payload is ErrorPayload { code, message }"},
		EventDef{Type: TypeConnected, Direction: DirS2C, Category: "system",
			Note: "first server frame on upgrade; payload is ConnectedPayload"},
		EventDef{Type: TypeReconnect, Direction: DirS2C, Category: "system",
			Note: "server-initiated hint for clients to re-establish"},

		// --- auth (stub; implemented by PR-9 WS Auth Protocol) ---
		EventDef{Type: "auth.identify", Direction: DirC2S, Category: "auth",
			Status: StatusStub,
			Note:   "PR-9 reserved — client presents refreshed credentials post-upgrade"},
		EventDef{Type: "auth.resume", Direction: DirC2S, Category: "auth",
			Status: StatusStub,
			Note:   "PR-9 reserved — client resumes session after reconnect, like Discord gateway RESUME"},
		EventDef{Type: "auth.refresh", Direction: DirC2S, Category: "auth",
			Status: StatusStub,
			Note:   "PR-9 reserved — client requests new token before expiry"},
		EventDef{Type: "auth.challenge", Direction: DirS2C, Category: "auth",
			Status: StatusStub,
			Note:   "PR-9 reserved — server asks for re-auth before sensitive action"},
		EventDef{Type: "auth.revoked", Direction: DirS2C, Category: "auth",
			Status: StatusStub,
			Note:   "PR-9 reserved — server notifies client its session was invalidated (ban, logout elsewhere)"},
		EventDef{Type: "auth.refresh_required", Direction: DirS2C, Category: "auth",
			Status: StatusStub,
			Note:   "PR-9 reserved — server signals token approaching expiry"},
	)
}
