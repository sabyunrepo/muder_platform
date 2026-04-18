package ws

// Client → Server WS event catalog.
//
// These are the messages a connected client may send to the Hub. The payload
// is decoded downstream by either the session actor or a module-specific
// handler — the Catalog only controls Hub.Route admittance.
//
// Naming note (Phase 19 PR-1): legacy "ns:action" colon form is preserved
// here. New entries should use "ns.action" dot form per the EventDef
// package comment; colon→dot normalisation is a Phase 20 follow-up.

func init() {
	RegisterCatalog(
		// --- accusation ---
		EventDef{Type: "accusation:accuse", Direction: DirC2S, Category: "accusation"},
		EventDef{Type: "accusation:reset", Direction: DirC2S, Category: "accusation"},
		EventDef{Type: "accusation:vote", Direction: DirC2S, Category: "accusation"},

		// --- audio (client-initiated playback control) ---
		EventDef{Type: "audio:pause", Direction: DirC2S, Category: "audio"},
		EventDef{Type: "audio:play", Direction: DirC2S, Category: "audio"},
		EventDef{Type: "audio:resume", Direction: DirC2S, Category: "audio"},
		EventDef{Type: "audio:stop", Direction: DirC2S, Category: "audio"},

		// --- chat (send; server fanout uses chat.message in s2c) ---
		EventDef{Type: "chat:send", Direction: DirC2S, Category: "chat"},

		// --- clue distribution ---
		EventDef{Type: "clue:show_accept", Direction: DirC2S, Category: "clue"},
		EventDef{Type: "clue:show_decline", Direction: DirC2S, Category: "clue"},
		EventDef{Type: "clue:show_request", Direction: DirC2S, Category: "clue"},
		EventDef{Type: "clue:trade_accept", Direction: DirC2S, Category: "clue"},
		EventDef{Type: "clue:trade_decline", Direction: DirC2S, Category: "clue"},
		EventDef{Type: "clue:trade_propose", Direction: DirC2S, Category: "clue"},
		EventDef{Type: "clue:use", Direction: DirC2S, Category: "clue"},
		EventDef{Type: "clue:use_cancel", Direction: DirC2S, Category: "clue"},
		EventDef{Type: "clue:use_target", Direction: DirC2S, Category: "clue"},

		// --- conditional ---
		EventDef{Type: "conditional:status", Direction: DirC2S, Category: "conditional"},

		// --- consensus ---
		EventDef{Type: "consensus:propose", Direction: DirC2S, Category: "consensus"},
		EventDef{Type: "consensus:vote", Direction: DirC2S, Category: "consensus"},

		// --- ending ---
		EventDef{Type: "ending:next_reveal", Direction: DirC2S, Category: "ending"},

		// --- event trigger ---
		EventDef{Type: "event:trigger", Direction: DirC2S, Category: "event"},

		// --- explore ---
		EventDef{Type: "explore:examine", Direction: DirC2S, Category: "explore"},
		EventDef{Type: "explore:move", Direction: DirC2S, Category: "explore"},
		EventDef{Type: "explore:start", Direction: DirC2S, Category: "explore"},

		// --- floor navigation ---
		EventDef{Type: "floor:change", Direction: DirC2S, Category: "floor"},
		EventDef{Type: "floor:select", Direction: DirC2S, Category: "floor"},

		// --- GM controls ---
		EventDef{Type: "gm:advance_phase", Direction: DirC2S, Category: "gm"},
		EventDef{Type: "gm:broadcast_message", Direction: DirC2S, Category: "gm"},
		EventDef{Type: "gm:play_media", Direction: DirC2S, Category: "gm"},
		EventDef{Type: "gm:show_ending", Direction: DirC2S, Category: "gm"},
		EventDef{Type: "gm:start_playing", Direction: DirC2S, Category: "gm"},
		EventDef{Type: "gm:start_prologue", Direction: DirC2S, Category: "gm"},
		EventDef{Type: "gm:toggle_voting", Direction: DirC2S, Category: "gm"},

		// --- group / groupchat ---
		EventDef{Type: "group:create", Direction: DirC2S, Category: "group"},
		EventDef{Type: "group:invite", Direction: DirC2S, Category: "group"},
		EventDef{Type: "group:leave", Direction: DirC2S, Category: "group"},
		EventDef{Type: "group:send", Direction: DirC2S, Category: "group"},
		EventDef{Type: "groupchat:join", Direction: DirC2S, Category: "groupchat"},
		EventDef{Type: "groupchat:leave", Direction: DirC2S, Category: "groupchat"},
		EventDef{Type: "groupchat:send", Direction: DirC2S, Category: "groupchat"},

		// --- hybrid ---
		EventDef{Type: "hybrid:consensus_vote", Direction: DirC2S, Category: "hybrid"},
		EventDef{Type: "hybrid:trigger_event", Direction: DirC2S, Category: "hybrid"},

		// --- location search ---
		EventDef{Type: "location:search", Direction: DirC2S, Category: "location"},

		// --- mission ---
		EventDef{Type: "mission:check", Direction: DirC2S, Category: "mission"},
		EventDef{Type: "mission:report", Direction: DirC2S, Category: "mission"},
		EventDef{Type: "mission:verify", Direction: DirC2S, Category: "mission"},

		// --- reading (client-side control; server state in s2c) ---
		EventDef{Type: "reading:advance", Direction: DirC2S, Category: "reading"},
		EventDef{Type: "reading:jump", Direction: DirC2S, Category: "reading"},
		EventDef{Type: "reading:voice_ended", Direction: DirC2S, Category: "reading"},

		// --- ready toggle ---
		EventDef{Type: "ready:toggle", Direction: DirC2S, Category: "ready"},

		// --- room actions ---
		EventDef{Type: "room:deselect_character", Direction: DirC2S, Category: "room"},
		EventDef{Type: "room:examine", Direction: DirC2S, Category: "room"},
		EventDef{Type: "room:move", Direction: DirC2S, Category: "room"},
		EventDef{Type: "room:select_character", Direction: DirC2S, Category: "room"},

		// --- round clue ---
		EventDef{Type: "round_clue:status", Direction: DirC2S, Category: "round_clue"},

		// --- script ---
		EventDef{Type: "script:skip", Direction: DirC2S, Category: "script"},

		// --- skip vote ---
		EventDef{Type: "skip:agree", Direction: DirC2S, Category: "skip"},
		EventDef{Type: "skip:disagree", Direction: DirC2S, Category: "skip"},
		EventDef{Type: "skip:request", Direction: DirC2S, Category: "skip"},

		// --- spatial voice position ---
		EventDef{Type: "spatial:move", Direction: DirC2S, Category: "spatial"},

		// --- starting ---
		EventDef{Type: "starting:status", Direction: DirC2S, Category: "starting"},

		// --- timed clue ---
		EventDef{Type: "timed_clue:start", Direction: DirC2S, Category: "timed_clue"},
		EventDef{Type: "timed_clue:stop", Direction: DirC2S, Category: "timed_clue"},
		EventDef{Type: "timed_clue:tick", Direction: DirC2S, Category: "timed_clue"},

		// --- voice (bidi: client sends intent, server broadcasts state via voice_bridge) ---
		EventDef{Type: "voice:join", Direction: DirBidi, Category: "voice", Note: "client intent; server also broadcasts via domain/bridge/voice_bridge"},
		EventDef{Type: "voice:leave", Direction: DirBidi, Category: "voice"},
		EventDef{Type: "voice:mute", Direction: DirBidi, Category: "voice"},
		EventDef{Type: "voice:unmute", Direction: DirBidi, Category: "voice"},

		// --- vote (legacy c2s; server tally in s2c as vote.cast / vote:tallied) ---
		EventDef{Type: "vote:cast", Direction: DirC2S, Category: "vote"},
		EventDef{Type: "vote:change", Direction: DirC2S, Category: "vote"},

		// --- whisper ---
		EventDef{Type: "whisper:send", Direction: DirC2S, Category: "whisper"},

		// --- sound (bidi: client can trigger, server broadcasts via domain/sound) ---
		EventDef{Type: "sound:play", Direction: DirBidi, Category: "sound", Note: "server-authored broadcast uses the same type from domain/sound/handler"},
		EventDef{Type: "sound:stop", Direction: DirC2S, Category: "sound"},
	)
}
