package server

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"
)

const (
	readTimeout     = 10 * time.Second
	writeTimeout    = 30 * time.Second
	idleTimeout     = 60 * time.Second
	shutdownTimeout = 15 * time.Second
)

// Server wraps the standard http.Server with graceful shutdown support.
type Server struct {
	httpServer *http.Server
	logger     zerolog.Logger
}

// New creates a new Server bound to the given port with the provided handler.
func New(port int, handler http.Handler, logger zerolog.Logger) *Server {
	return &Server{
		httpServer: &http.Server{
			Addr:         fmt.Sprintf(":%d", port),
			Handler:      handler,
			ReadTimeout:  readTimeout,
			WriteTimeout: writeTimeout,
			IdleTimeout:  idleTimeout,
		},
		logger: logger,
	}
}

// Start begins listening for HTTP requests and blocks until a termination
// signal (SIGINT or SIGTERM) is received, then gracefully shuts down.
func (s *Server) Start() error {
	errCh := make(chan error, 1)

	go func() {
		s.logger.Info().
			Str("addr", s.httpServer.Addr).
			Msg("server starting")

		if err := s.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	select {
	case err := <-errCh:
		return fmt.Errorf("server failed to start: %w", err)
	case sig := <-quit:
		s.logger.Info().Str("signal", sig.String()).Msg("shutting down server")
	}

	ctx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()

	if err := s.httpServer.Shutdown(ctx); err != nil {
		return fmt.Errorf("server forced to shutdown: %w", err)
	}

	s.logger.Info().Msg("server stopped gracefully")
	return nil
}
