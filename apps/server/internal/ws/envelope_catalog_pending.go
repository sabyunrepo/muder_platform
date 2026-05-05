package ws

// Pending / reserved WS event catalog entries.
//
// These names are currently referenced by the frontend (apps/web, MSW,
// unit tests) but not yet emitted or handled by the server. They are
// registered as StatusStub so that:
//
//   - BootstrapRegistry does not install a silent pass-through C2S
//     handler for them (a stub does NOT mask an unimplemented server
//     path the way an active passthrough would);
//   - wsgen emits them in WsEventType so the generated frontend enum
//     stays stable and TypeScript compiles across the Phase 19 PR-1
//     drift-reduction window;
//   - Phase 19 audit Finding F-ws-* tracking is preserved — each entry
//     carries a Note pointing at the follow-up decision needed (either
//     "implement on server" or "remove from frontend").
//
// Phase 20 plan item: revisit every stub below and resolve to either an
// active catalog entry (full server handler + tests) or deletion from
// the frontend (and this file).

func init() {
	RegisterCatalog(
		// Game action protocol. Frontend sends a discriminated union
		// payload ({type: "ready"|"start"|"close"|"trade"|"explore"|…})
		// through WsEventType.GAME_ACTION. Server currently exposes the
		// legacy per-action colon C2S types (ready:toggle, clue:use, …);
		// unifying under a typed action channel is a Phase 20 design call.
		EventDef{Type: "game.action", Direction: DirC2S, Category: "game",
			Status: StatusStub,
			Note:   "FE send-only; server uses legacy per-action types. Phase 20 — unify or migrate"},
		EventDef{Type: "game.action_result", Direction: DirS2C, Category: "game",
			Status: StatusStub,
			Note:   "FE listen-only; server yet to emit ACK envelopes"},
		EventDef{Type: "game.end", Direction: DirS2C, Category: "game",
			Status: StatusStub,
			Note:   "FE listen-only; server currently uses ending.completed instead"},
	)
}
