package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"runtime/debug"
)

// safeCallReactor invokes a PhaseReactor with panic isolation.
// On panic: logs the error, publishes a module.panic audit event, and continues.
func (e *PhaseEngine) safeCallReactor(ctx context.Context, name string, reactor PhaseReactor, action PhaseActionPayload) (err error) {
	defer func() {
		if r := recover(); r != nil {
			stack := debug.Stack()
			e.logger.Printf("engine: module %q panicked: %v\n%s", name, r, stack)
			e.auditEvent(ctx, "module.panic", map[string]any{
				"module": name,
				"action": string(action.Action),
				"panic":  fmt.Sprintf("%v", r),
			})
			err = fmt.Errorf("engine: module %q panicked: %v", name, r)
		}
	}()
	return reactor.ReactTo(ctx, action)
}

func (e *PhaseEngine) auditEvent(ctx context.Context, eventType string, payload map[string]any) {
	data, err := json.Marshal(payload)
	if err != nil {
		data = json.RawMessage(fmt.Sprintf(`{"marshalError":%q}`, err.Error()))
	}
	e.audit.Log(ctx, e.sessionID, eventType, data)
}
