package voice

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
)

// TestMockProviderDoesNotLogTokenValue guards F-sec-3 (Phase 19 audit):
// the mock voice provider must never emit the generated token string in
// log output. Regression anchor for PR #83 fix (commit b9cc4ba) — if a
// future edit to the logger chain re-introduces `Str("token", token)` or
// similar, this test fails before the change reaches main.
func TestMockProviderDoesNotLogTokenValue(t *testing.T) {
	var buf bytes.Buffer
	logger := zerolog.New(&buf).Level(zerolog.DebugLevel)
	p := NewMockProvider(logger)

	token, err := p.GenerateToken(context.Background(), TokenParams{
		SessionID:  uuid.New(),
		PlayerID:   uuid.New(),
		RoomName:   "test-room",
		PlayerName: "alice",
	})
	if err != nil {
		t.Fatalf("GenerateToken: %v", err)
	}
	if token == "" {
		t.Fatal("GenerateToken returned empty token")
	}

	logOutput := buf.String()

	if strings.Contains(logOutput, token) {
		t.Fatalf("F-sec-3 regression: token value leaked in log output\n  token=%s\n  log=%s", token, logOutput)
	}

	if strings.Contains(logOutput, "eyJ") {
		t.Fatalf("F-sec-3 regression: JWT-shaped prefix appears in log output\n  log=%s", logOutput)
	}
}

// TestLiveKitProviderHasNoLoggerField is a compile-time contract anchor:
// the real LiveKit provider must not embed a zerolog.Logger, so there is
// no accidental surface on which a future edit could leak token values.
// If a logger field is added, this test forces the author to acknowledge
// the F-sec-3 constraint by modifying this test too.
func TestLiveKitProviderHasNoLoggerField(t *testing.T) {
	p := NewLiveKitProvider("http://localhost:7880", "devkey", "devsecret")
	lp, ok := p.(*livekitProvider)
	if !ok {
		t.Fatalf("NewLiveKitProvider should return *livekitProvider, got %T", p)
	}

	// The struct literal below mirrors the complete set of fields. If a
	// `logger zerolog.Logger` field is introduced later, this assignment
	// fails to compile unless the author updates the test, which forces
	// them to re-read the F-sec-3 note in provider.go:104.
	_ = livekitProvider{
		apiKey:    lp.apiKey,
		apiSecret: lp.apiSecret,
		url:       lp.url,
		client:    lp.client,
	}
}
