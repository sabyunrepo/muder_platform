package ws

// Server → Client WS event catalog.
//
// Two origin paths feed this list — both end up on the wire as-is:
//
//  1. Handler-direct (colon form) — code calls ws.NewEnvelope / MustEnvelope
//     directly and broadcasts via the Hub. e.g. reading_handler.go emits
//     "reading:line_changed"; domain/social emits "chat:message".
//
//  2. EventBus relay (dot form) — engine modules Publish(Event{Type: "X"})
//     and session/event_mapping.go fans out to WS without transformation,
//     so the wire type equals the event type. e.g. progression/reading.go
//     Publish("reading.line_changed").
//
// These two paths can currently emit semantically-overlapping types
// (reading:line_changed vs reading.line_changed) — this is the root cause
// of the 3-way drift measured in Phase 19 audit F-ws-*. Both are catalogued
// so the frontend knows what may arrive; deduplication/normalisation is
// tracked as a Phase 20 follow-up.

func init() {
	RegisterCatalog(
		// --- session snapshot (handler-direct) ---
		EventDef{Type: "session:state", Direction: DirS2C, Category: "session",
			Note: "snapshot; payload redacted per player by session actor"},

		// --- reading (handler-direct, colon form) ---
		EventDef{Type: "reading:state", Direction: DirS2C, Category: "reading"},
		EventDef{Type: "reading:started", Direction: DirS2C, Category: "reading"},
		EventDef{Type: "reading:line_changed", Direction: DirS2C, Category: "reading"},
		EventDef{Type: "reading:paused", Direction: DirS2C, Category: "reading"},
		EventDef{Type: "reading:resumed", Direction: DirS2C, Category: "reading"},
		EventDef{Type: "reading:completed", Direction: DirS2C, Category: "reading"},

		// --- reading (engine relay, dot form) ---
		EventDef{Type: "reading.started", Direction: DirS2C, Category: "reading",
			Note: "engine-origin; overlaps with reading:started — dedupe in Phase 20"},
		EventDef{Type: "reading.line_changed", Direction: DirS2C, Category: "reading"},
		EventDef{Type: "reading.paused", Direction: DirS2C, Category: "reading"},
		EventDef{Type: "reading.resumed", Direction: DirS2C, Category: "reading"},
		EventDef{Type: "reading.completed", Direction: DirS2C, Category: "reading"},

		// --- audio/media presentation cues (engine relay) ---
		EventDef{Type: "audio.set_bgm", Direction: DirS2C, Category: "audio"},
		EventDef{Type: "audio.play_voice", Direction: DirS2C, Category: "audio"},
		EventDef{Type: "audio.play_sound", Direction: DirS2C, Category: "audio"},
		EventDef{Type: "audio.play_media", Direction: DirS2C, Category: "audio"},
		EventDef{Type: "audio.stop", Direction: DirS2C, Category: "audio"},

		// --- visual presentation cues (engine relay) ---
		EventDef{Type: "presentation.set_background", Direction: DirS2C, Category: "presentation"},
		EventDef{Type: "presentation.set_theme_color", Direction: DirS2C, Category: "presentation"},

		// --- phase (engine relay) ---
		EventDef{Type: "phase.advanced", Direction: DirS2C, Category: "phase"},
		EventDef{Type: "phase:entered", Direction: DirS2C, Category: "phase",
			Status: StatusDeprec, Note: "colon form; prefer phase.advanced"},

		// --- clue (engine relay) ---
		EventDef{Type: "clue.acquired", Direction: DirS2C, Category: "clue"},
		EventDef{Type: "clue.item_declared", Direction: DirS2C, Category: "clue"},
		EventDef{Type: "clue.item_resolved", Direction: DirS2C, Category: "clue"},
		EventDef{Type: "clue.peek_result", Direction: DirS2C, Category: "clue"},

		// --- ending (engine relay) ---
		EventDef{Type: "ending.reveal_step", Direction: DirS2C, Category: "ending"},
		EventDef{Type: "ending.completed", Direction: DirS2C, Category: "ending"},

		// --- game lifecycle (engine relay) ---
		EventDef{Type: "game.started", Direction: DirS2C, Category: "game"},
		EventDef{Type: "game.start", Direction: DirS2C, Category: "game",
			Note: "legacy alias observed in tests; verify vs game.started"},

		// --- player (engine relay) ---
		EventDef{Type: "player.left", Direction: DirS2C, Category: "player"},
		EventDef{Type: "player.joined", Direction: DirS2C, Category: "player"},

		// --- module ---
		EventDef{Type: "module.event", Direction: DirS2C, Category: "module",
			Note: "catch-all for module-specific domain events; payload.moduleId gates dispatch"},
		EventDef{Type: "module.state", Direction: DirS2C, Category: "module"},

		// --- ready ---
		EventDef{Type: "ready.all_ready", Direction: DirS2C, Category: "ready"},
		EventDef{Type: "ready.status_changed", Direction: DirS2C, Category: "ready"},

		// --- vote (engine relay; colon :tallied also observed in tests) ---
		EventDef{Type: "vote.cast", Direction: DirS2C, Category: "vote"},
		EventDef{Type: "vote:tallied", Direction: DirS2C, Category: "vote",
			Status: StatusDeprec, Note: "colon form; prefer vote.tallied after Phase 20"},

		// --- chat (handler-direct broadcast from domain/social) ---
		EventDef{Type: "chat:message", Direction: DirS2C, Category: "chat"},
		EventDef{Type: "chat:typing_indicator", Direction: DirS2C, Category: "chat"},
		EventDef{Type: "chat:read_receipt", Direction: DirS2C, Category: "chat"},
		EventDef{Type: "chat:whisper", Direction: DirS2C, Category: "chat"},

		// --- friend (handler-direct broadcast from domain/social) ---
		EventDef{Type: "friend:request", Direction: DirS2C, Category: "friend"},
		EventDef{Type: "friend:accepted", Direction: DirS2C, Category: "friend"},

		// --- voice (bridge broadcasts "voice:"+eventType dynamically;
		//            explicit entries pin the commonly-observed types) ---
		EventDef{Type: "voice:state", Direction: DirS2C, Category: "voice"},
		EventDef{Type: "voice:token", Direction: DirS2C, Category: "voice",
			Note: "LiveKit short-lived token issued after room.join"},
	)
}
