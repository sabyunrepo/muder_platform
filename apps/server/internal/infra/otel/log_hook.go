package otel

import (
	"github.com/rs/zerolog"
	"go.opentelemetry.io/otel/trace"
)

// LogHook injects trace_id and span_id into zerolog events.
type LogHook struct{}

// Run implements zerolog.Hook.
func (h LogHook) Run(e *zerolog.Event, level zerolog.Level, msg string) {
	ctx := e.GetCtx()
	if ctx == nil {
		return
	}
	span := trace.SpanFromContext(ctx)
	sc := span.SpanContext()
	if sc.IsValid() {
		e.Str("trace_id", sc.TraceID().String()).
			Str("span_id", sc.SpanID().String())
	}
}
