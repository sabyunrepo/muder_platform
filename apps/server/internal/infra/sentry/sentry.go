package sentry

import (
	"fmt"
	"time"

	"github.com/getsentry/sentry-go"
)

// Config holds Sentry initialization options.
type Config struct {
	DSN         string
	Environment string
	Release     string
	Debug       bool
}

// Init initializes the Sentry SDK. Returns a cleanup function that flushes buffered events.
// If DSN is empty, Sentry is not initialized and the cleanup is a no-op.
func Init(cfg Config) (cleanup func(), err error) {
	if cfg.DSN == "" {
		return func() {}, nil
	}

	err = sentry.Init(sentry.ClientOptions{
		Dsn:              cfg.DSN,
		Environment:      cfg.Environment,
		Release:          cfg.Release,
		Debug:            cfg.Debug,
		TracesSampleRate: 0.1,
		EnableTracing:    true,
		BeforeSend: func(event *sentry.Event, hint *sentry.EventHint) *sentry.Event {
			// Strip sensitive headers to prevent PII leakage
			if event.Request != nil {
				delete(event.Request.Headers, "Authorization")
				delete(event.Request.Headers, "Cookie")
				event.Request.Cookies = ""
			}
			return event
		},
	})
	if err != nil {
		return nil, fmt.Errorf("sentry init: %w", err)
	}

	return func() {
		sentry.Flush(2 * time.Second)
	}, nil
}
