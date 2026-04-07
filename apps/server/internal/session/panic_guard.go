package session

import (
	"fmt"
	"runtime/debug"
)

// panicAbortThreshold is the number of cumulative panics that triggers a
// permanent session abort. Design decision (phase-8.0 brainstorming):
// 3 cumulative panics → abort, no counter reset.
const panicAbortThreshold = 3

// onPanic is called by safeHandleMessage whenever a recovered panic occurs
// inside handleMessage. It increments the session's cumulative panic counter
// and, upon reaching panicAbortThreshold, permanently aborts the session.
//
// This function runs on the Session's actor goroutine — no locking needed.
//
// Security note: panic values are logged as their Go type name only (not %v)
// to avoid leaking sensitive runtime data into log aggregators. The full
// stack trace is included separately for diagnostics.
func onPanic(s *Session, p any) {
	s.panicCount++

	s.logger.Error().
		Int("panic_count", s.panicCount).
		Int("abort_threshold", panicAbortThreshold).
		Str("session_id", s.ID.String()).
		Str("panic_type", fmt.Sprintf("%T", p)).
		Bytes("stack", debug.Stack()).
		Msg("recovered panic in session message handler")

	if s.panicCount >= panicAbortThreshold {
		s.logger.Error().
			Str("session_id", s.ID.String()).
			Msg("panic threshold reached — aborting session permanently")

		// stop() closes the done channel so Run exits on its next iteration.
		s.stop()

		// Notify the manager so it removes this session from its active map.
		if s.onAbort != nil {
			s.onAbort(s.ID)
		}
	}
}
