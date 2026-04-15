package ws

import "encoding/json"

// BootstrapRegistry registers all known client→server message types into r.
// Called once at startup from main.go before the Hub begins accepting connections.
//
// Types are split into two groups:
//   - Legacy: namespaced "ns:action" types handled by the Router (game, chat, etc.)
//   - Session: new-runtime types routed to the session actor layer.
//
// The decoder for all types is a pass-through (raw JSON preserved) because the
// session actor and module handlers perform their own typed decode. The registry
// exists to prevent unknown-type drops at the Hub.Route level.
func BootstrapRegistry(r *EnvelopeRegistry) {
	passThrough := func(raw json.RawMessage) (any, error) { return raw, nil }

	legacyTypes := []string{
		// accusation module
		"accusation:accuse",
		"accusation:reset",
		"accusation:vote",
		// audio module
		"audio:pause",
		"audio:play",
		"audio:resume",
		"audio:stop",
		// chat module
		"chat:send",
		// clue distribution
		"clue:show_accept",
		"clue:show_decline",
		"clue:show_request",
		"clue:trade_accept",
		"clue:trade_decline",
		"clue:trade_propose",
		"clue:use",
		"clue:use_cancel",
		"clue:use_target",
		// conditional trigger
		"conditional:status",
		// consensus
		"consensus:propose",
		"consensus:vote",
		// ending reveal
		"ending:next_reveal",
		// event trigger
		"event:trigger",
		// explore
		"explore:examine",
		"explore:move",
		"explore:start",
		// floor navigation
		"floor:change",
		"floor:select",
		// GM controls
		"gm:advance_phase",
		"gm:broadcast_message",
		"gm:play_media",
		"gm:show_ending",
		"gm:start_playing",
		"gm:start_prologue",
		"gm:toggle_voting",
		// group chat
		"group:create",
		"group:invite",
		"group:leave",
		"group:send",
		"groupchat:join",
		"groupchat:leave",
		"groupchat:send",
		// hybrid
		"hybrid:consensus_vote",
		"hybrid:trigger_event",
		// location search
		"location:search",
		// mission
		"mission:check",
		"mission:report",
		"mission:verify",
		// reading
		"reading:advance",
		"reading:jump",
		"reading:voice_ended",
		// ready toggle
		"ready:toggle",
		// room actions
		"room:deselect_character",
		"room:examine",
		"room:move",
		"room:select_character",
		// round clue
		"round_clue:status",
		// script
		"script:skip",
		// skip vote
		"skip:agree",
		"skip:disagree",
		"skip:request",
		// spatial voice
		"spatial:move",
		// starting
		"starting:status",
		// timed clue
		"timed_clue:start",
		"timed_clue:stop",
		"timed_clue:tick",
		// voice
		"voice:join",
		"voice:leave",
		"voice:mute",
		"voice:unmute",
		// vote
		"vote:cast",
		"vote:change",
		// whisper
		"whisper:send",
		// sound
		"sound:play",
		"sound:stop",
	}

	for _, t := range legacyTypes {
		r.Register(t, passThrough)
	}
}
