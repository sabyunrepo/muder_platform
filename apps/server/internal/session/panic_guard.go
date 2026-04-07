package session

import "fmt"

// panicAbortThreshold is the number of cumulative panics that triggers a
// permanent session abort. The design decision (confirmed in phase-8.0
// brainstorming) is: 3 cumulative panics → abort, no counter reset.
const panicAbortThreshold = 3

// onPanic is called by safeHandleMessage whenever a recovered panic occurs
// inside handleMessage. It increments the session's cumulative panic counter
// and, upon reaching panicAbortThreshold, permanently aborts the session.
//
// This function runs on the Session's actor goroutine — no locking needed.
func onPanic(s *Session, p any) {
	s.panicCount++

	s.logger.Error().
		Int("panic_count", s.panicCount).
		Int("abort_threshold", panicAbortThreshold).
		Str("session_id", s.ID.String()).
		Str("panic_value", fmt.Sprintf("%v", p)).
		Msg("recovered panic in session message handler")

	if s.panicCount >= panicAbortThreshold {
		s.logger.Error().
			Str("session_id", s.ID.String()).
			Msg("panic threshold reached — aborting session permanently")

		// Close done channel to stop the Run loop after this handler returns.
		s.stop()

		// Notify the manager so it can remove this session from its active map.
		if s.onAbort != nil {
			s.onAbort(s.ID)
		}
	}
}
