package ws

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
)

// --- fakes ---

type fakeReadingModule struct {
	mu sync.Mutex

	advanceCalls    []advanceCall
	voiceEndedCalls []voiceEndedCall
	leftCalls       []leftCall
	rejoinCalls     []rejoinCall
	advanceErr      error
	voiceEndedErr   error
	stateSnapshot   ReadingStateSnapshot
}

type advanceCall struct {
	playerID uuid.UUID
	isHost   bool
	roleID   string
}
type voiceEndedCall struct {
	voiceID string
}
type leftCall struct {
	hostLeaving bool
	roles       []string
}
type rejoinCall struct {
	hostRejoining bool
	roles         []string
}

func (f *fakeReadingModule) HandleAdvance(_ context.Context, playerID uuid.UUID, isHost bool, roleID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.advanceCalls = append(f.advanceCalls, advanceCall{playerID, isHost, roleID})
	return f.advanceErr
}

func (f *fakeReadingModule) HandleVoiceEnded(_ context.Context, voiceID string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.voiceEndedCalls = append(f.voiceEndedCalls, voiceEndedCall{voiceID})
	return f.voiceEndedErr
}

func (f *fakeReadingModule) HandlePlayerLeft(_ context.Context, hostLeaving bool, leftRoleIDs []string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.leftCalls = append(f.leftCalls, leftCall{hostLeaving, append([]string(nil), leftRoleIDs...)})
}

func (f *fakeReadingModule) HandlePlayerRejoined(_ context.Context, hostRejoining bool, rejoinedRoleIDs []string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rejoinCalls = append(f.rejoinCalls, rejoinCall{hostRejoining, append([]string(nil), rejoinedRoleIDs...)})
}

func (f *fakeReadingModule) GetReadingStateSnapshot() ReadingStateSnapshot {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.stateSnapshot
}

type fakeResolver struct {
	module ReadingModuleAPI
	roles  map[uuid.UUID]struct {
		roleID string
		isHost bool
	}
	sectionID string
}

func newFakeResolver(mod ReadingModuleAPI) *fakeResolver {
	return &fakeResolver{
		module: mod,
		roles: make(map[uuid.UUID]struct {
			roleID string
			isHost bool
		}),
	}
}

func (r *fakeResolver) setRole(playerID uuid.UUID, roleID string, isHost bool) {
	r.roles[playerID] = struct {
		roleID string
		isHost bool
	}{roleID, isHost}
}

func (r *fakeResolver) LookupModule(_ uuid.UUID) ReadingModuleAPI {
	return r.module
}

func (r *fakeResolver) LookupRole(_, playerID uuid.UUID) (string, bool, bool) {
	v, ok := r.roles[playerID]
	if !ok {
		return "", false, false
	}
	return v.roleID, v.isHost, true
}

func (r *fakeResolver) LookupSectionID(_ uuid.UUID) string { return r.sectionID }

type fakeBroadcaster struct {
	mu         sync.Mutex
	broadcasts []struct {
		sessionID uuid.UUID
		env       *Envelope
	}
}

func (b *fakeBroadcaster) BroadcastToSession(sessionID uuid.UUID, env *Envelope) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.broadcasts = append(b.broadcasts, struct {
		sessionID uuid.UUID
		env       *Envelope
	}{sessionID, env})
}

type fakeSender struct {
	mu   sync.Mutex
	sent []*Envelope
}

func (s *fakeSender) SendMessage(env *Envelope) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sent = append(s.sent, env)
}

// newReadingTestClient builds a Client suitable for reading-handler tests.
// The conn is nil because the handler only calls SendMessage which writes
// to the send channel. Returns the client and a drain function that returns
// all queued raw envelopes (drained synchronously, no goroutine).
func newReadingTestClient(t *testing.T, sessionID uuid.UUID) (*Client, func() []string) {
	t.Helper()
	c := &Client{
		ID:        uuid.New(),
		SessionID: sessionID,
		send:      make(chan []byte, 32),
		logger:    zerolog.Nop(),
	}
	t.Cleanup(func() {
		// Close is idempotent; safe even if a test already invoked it.
		c.closedOnce.Do(func() {
			c.closed.Store(true)
			close(c.send)
		})
	})
	drain := func() []string {
		var out []string
		for {
			select {
			case msg, ok := <-c.send:
				if !ok {
					return out
				}
				out = append(out, string(msg))
			default:
				return out
			}
		}
	}
	return c, drain
}

// findEnvelopeType inspects the slice produced by the test client and
// returns true if any received message has the given type field.
func findEnvelopeType(received []string, msgType string) bool {
	for _, raw := range received {
		var env Envelope
		if err := json.Unmarshal([]byte(raw), &env); err == nil {
			if env.Type == msgType {
				return true
			}
		}
	}
	return false
}

// findErrorWithCode inspects the test client buffer for an error envelope
// whose payload message contains the given reading error code substring.
func findErrorWithCode(received []string, codeSubstring string) bool {
	for _, raw := range received {
		var env Envelope
		if err := json.Unmarshal([]byte(raw), &env); err != nil {
			continue
		}
		if env.Type != TypeError {
			continue
		}
		var pl ErrorPayload
		if err := json.Unmarshal(env.Payload, &pl); err != nil {
			continue
		}
		if containsString(pl.Message, codeSubstring) {
			return true
		}
	}
	return false
}

func containsString(haystack, needle string) bool {
	return len(needle) == 0 || (len(haystack) >= len(needle) && (haystack == needle || indexOf(haystack, needle) >= 0))
}

func indexOf(s, sub string) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return i
		}
	}
	return -1
}

// --- tests ---

func TestReadingWSHandler_Advance_Success(t *testing.T) {
	mod := &fakeReadingModule{}
	resolver := newFakeResolver(mod)
	sessionID := uuid.New()

	h := NewReadingWSHandler(nil, resolver, zerolog.Nop())

	c, _ := newReadingTestClient(t, sessionID)
	resolver.setRole(c.ID, "detective", false)

	h.Handle(c, MustEnvelope(TypeReadingAdvance, nil))

	mod.mu.Lock()
	defer mod.mu.Unlock()
	if len(mod.advanceCalls) != 1 {
		t.Fatalf("want 1 HandleAdvance call, got %d", len(mod.advanceCalls))
	}
	if mod.advanceCalls[0].roleID != "detective" {
		t.Errorf("roleID = %q, want %q", mod.advanceCalls[0].roleID, "detective")
	}
	if mod.advanceCalls[0].isHost {
		t.Errorf("isHost = true, want false")
	}
}

func TestReadingWSHandler_Advance_NoSession(t *testing.T) {
	mod := &fakeReadingModule{}
	resolver := newFakeResolver(mod)
	h := NewReadingWSHandler(nil, resolver, zerolog.Nop())

	c, drain := newReadingTestClient(t, uuid.Nil) // not in a session

	h.Handle(c, MustEnvelope(TypeReadingAdvance, nil))

	// Drain
	received := drain()
	if len(mod.advanceCalls) != 0 {
		t.Fatalf("want 0 advance calls, got %d", len(mod.advanceCalls))
	}
	if !findEnvelopeType(received, TypeError) {
		t.Errorf("expected error envelope, got %v", received)
	}
}

func TestReadingWSHandler_Advance_PermissionDenied(t *testing.T) {
	mod := &fakeReadingModule{
		advanceErr: apperror.New(apperror.ErrReadingAdvanceForbidden, http.StatusForbidden,
			"reading: only the host can advance this line"),
	}
	resolver := newFakeResolver(mod)
	sessionID := uuid.New()

	h := NewReadingWSHandler(nil, resolver, zerolog.Nop())

	c, drain := newReadingTestClient(t, sessionID)
	resolver.setRole(c.ID, "detective", false)

	h.Handle(c, MustEnvelope(TypeReadingAdvance, nil))
	received := drain()

	if !findErrorWithCode(received, apperror.ErrReadingAdvanceForbidden) {
		t.Errorf("expected READING_ADVANCE_FORBIDDEN in error envelope, got: %v", received)
	}
}

func TestReadingWSHandler_Advance_InvalidAdvanceBy(t *testing.T) {
	mod := &fakeReadingModule{
		advanceErr: apperror.New(apperror.ErrReadingInvalidAdvanceBy, http.StatusUnprocessableEntity,
			"reading: invalid advanceBy"),
	}
	resolver := newFakeResolver(mod)
	sessionID := uuid.New()

	h := NewReadingWSHandler(nil, resolver, zerolog.Nop())

	c, drain := newReadingTestClient(t, sessionID)
	resolver.setRole(c.ID, "detective", false)

	h.Handle(c, MustEnvelope(TypeReadingAdvance, nil))
	received := drain()

	if !findErrorWithCode(received, apperror.ErrReadingInvalidAdvanceBy) {
		t.Errorf("expected READING_INVALID_ADVANCE_BY in error envelope, got: %v", received)
	}
}

func TestReadingWSHandler_VoiceEnded_Success(t *testing.T) {
	mod := &fakeReadingModule{}
	resolver := newFakeResolver(mod)
	sessionID := uuid.New()

	h := NewReadingWSHandler(nil, resolver, zerolog.Nop())

	c, _ := newReadingTestClient(t, sessionID)
	resolver.setRole(c.ID, "detective", false)

	env := MustEnvelope(TypeReadingVoiceEnded, map[string]string{"voiceId": "v-1"})
	h.Handle(c, env)

	mod.mu.Lock()
	defer mod.mu.Unlock()
	if len(mod.voiceEndedCalls) != 1 {
		t.Fatalf("want 1 HandleVoiceEnded call, got %d", len(mod.voiceEndedCalls))
	}
	if mod.voiceEndedCalls[0].voiceID != "v-1" {
		t.Errorf("voiceID = %q, want %q", mod.voiceEndedCalls[0].voiceID, "v-1")
	}
	// voice_ended must NOT route through HandleAdvance (which would
	// permission-check and reject voice lines).
	if len(mod.advanceCalls) != 0 {
		t.Errorf("voice_ended must not call HandleAdvance, got %d calls", len(mod.advanceCalls))
	}
}

func TestReadingWSHandler_VoiceEnded_BypassesPermissionCheck(t *testing.T) {
	// Even when the player has no role, voice_ended should still drive the
	// module forward — the server is the source of truth for media end.
	mod := &fakeReadingModule{}
	resolver := newFakeResolver(mod)
	sessionID := uuid.New()

	h := NewReadingWSHandler(nil, resolver, zerolog.Nop())

	c, _ := newReadingTestClient(t, sessionID)
	// deliberately do NOT set a role for c.ID

	env := MustEnvelope(TypeReadingVoiceEnded, map[string]string{"voiceId": "v-1"})
	h.Handle(c, env)

	mod.mu.Lock()
	defer mod.mu.Unlock()
	if len(mod.voiceEndedCalls) != 1 {
		t.Fatalf("voice_ended should bypass role lookup, want 1 call, got %d", len(mod.voiceEndedCalls))
	}
}

func TestReadingWSHandler_OnPlayerLeft(t *testing.T) {
	mod := &fakeReadingModule{}
	resolver := newFakeResolver(mod)
	sessionID := uuid.New()
	playerID := uuid.New()
	resolver.setRole(playerID, "detective", true)

	h := NewReadingWSHandler(nil, resolver, zerolog.Nop())
	h.OnPlayerLeft(sessionID, playerID)

	mod.mu.Lock()
	defer mod.mu.Unlock()
	if len(mod.leftCalls) != 1 {
		t.Fatalf("want 1 HandlePlayerLeft call, got %d", len(mod.leftCalls))
	}
	if !mod.leftCalls[0].hostLeaving {
		t.Errorf("hostLeaving = false, want true")
	}
	if len(mod.leftCalls[0].roles) != 1 || mod.leftCalls[0].roles[0] != "detective" {
		t.Errorf("roles = %v, want [detective]", mod.leftCalls[0].roles)
	}
}

func TestReadingWSHandler_OnPlayerRejoined_PushesStateToClientOnly(t *testing.T) {
	snapshot := ReadingStateSnapshot{
		SectionID:    "sec-1",
		CurrentIndex: 2,
		Lines:        json.RawMessage(`[{"VoiceID":"v1"}]`),
		BgmMediaID:   "bgm-1",
		Status:       "playing",
	}
	mod := &fakeReadingModule{stateSnapshot: snapshot}
	resolver := newFakeResolver(mod)
	resolver.sectionID = "sec-resolver"
	sessionID := uuid.New()

	broadcaster := &fakeBroadcaster{}
	h := NewReadingWSHandler(broadcaster, resolver, zerolog.Nop())

	c, drain := newReadingTestClient(t, sessionID)
	resolver.setRole(c.ID, "detective", false)

	h.OnPlayerRejoined(c)
	received := drain()

	mod.mu.Lock()
	if len(mod.rejoinCalls) != 1 {
		mod.mu.Unlock()
		t.Fatalf("want 1 HandlePlayerRejoined call, got %d", len(mod.rejoinCalls))
	}
	mod.mu.Unlock()

	// reading:state must arrive at the reconnecting client...
	if !findEnvelopeType(received, TypeReadingState) {
		t.Errorf("reading:state was not sent to client, got: %v", received)
	}
	// ...and must NOT be broadcast to the session.
	broadcaster.mu.Lock()
	defer broadcaster.mu.Unlock()
	for _, b := range broadcaster.broadcasts {
		if b.env.Type == TypeReadingState {
			t.Errorf("reading:state must not be broadcast on rejoin")
		}
	}
}

func TestReadingWSHandler_OnPlayerRejoined_InjectsSectionIDFromResolver(t *testing.T) {
	snapshot := ReadingStateSnapshot{
		SectionID:    "", // module doesn't know section id
		CurrentIndex: 0,
		Lines:        json.RawMessage(`[]`),
		Status:       "playing",
	}
	mod := &fakeReadingModule{stateSnapshot: snapshot}
	resolver := newFakeResolver(mod)
	resolver.sectionID = "sec-from-resolver"
	sessionID := uuid.New()

	h := NewReadingWSHandler(nil, resolver, zerolog.Nop())

	c, drain := newReadingTestClient(t, sessionID)
	resolver.setRole(c.ID, "detective", false)
	h.OnPlayerRejoined(c)
	received := drain()

	var found bool
	for _, raw := range received {
		var env Envelope
		if err := json.Unmarshal([]byte(raw), &env); err != nil {
			continue
		}
		if env.Type != TypeReadingState {
			continue
		}
		var snap ReadingStateSnapshot
		if err := json.Unmarshal(env.Payload, &snap); err != nil {
			t.Fatalf("decode reading:state payload: %v", err)
		}
		if snap.SectionID != "sec-from-resolver" {
			t.Errorf("SectionID = %q, want %q", snap.SectionID, "sec-from-resolver")
		}
		found = true
	}
	if !found {
		t.Errorf("reading:state envelope not found in %v", received)
	}
}

func TestReadingWSHandler_ForwardEvent(t *testing.T) {
	resolver := newFakeResolver(nil)
	broadcaster := &fakeBroadcaster{}
	sessionID := uuid.New()

	h := NewReadingWSHandler(broadcaster, resolver, zerolog.Nop())

	cases := []struct {
		eventType string
		wantWS    string
		wantOK    bool
	}{
		{"reading.started", TypeReadingStarted, true},
		{"reading.line_changed", TypeReadingLineChanged, true},
		{"reading.paused", TypeReadingPaused, true},
		{"reading.resumed", TypeReadingResumed, true},
		{"reading.completed", TypeReadingCompleted, true},
		{"reading.unknown", "", false},
		{"voice.joined", "", false},
	}
	for _, tc := range cases {
		t.Run(tc.eventType, func(t *testing.T) {
			ok := h.ForwardEvent(sessionID, tc.eventType, map[string]any{"k": "v"})
			if ok != tc.wantOK {
				t.Errorf("ForwardEvent(%q) ok = %v, want %v", tc.eventType, ok, tc.wantOK)
			}
		})
	}

	broadcaster.mu.Lock()
	defer broadcaster.mu.Unlock()
	gotTypes := make(map[string]bool)
	for _, b := range broadcaster.broadcasts {
		gotTypes[b.env.Type] = true
	}
	for _, want := range []string{TypeReadingStarted, TypeReadingLineChanged, TypeReadingPaused, TypeReadingResumed, TypeReadingCompleted} {
		if !gotTypes[want] {
			t.Errorf("expected broadcast of %q, got %v", want, gotTypes)
		}
	}
}

func TestReadingWSHandler_ForwardEvent_ReadingStartedConvertsToCamelCase(t *testing.T) {
	// The engine publishes reading.started with lines in PascalCase storage
	// form. The forwarder must decode them and re-emit with camelCase keys
	// so the FE readingStore.startSection handler sees the expected shape,
	// and must also inject sectionId from the resolver.
	resolver := newFakeResolver(nil)
	resolver.sectionID = "sec-xyz"
	broadcaster := &fakeBroadcaster{}
	sessionID := uuid.New()

	h := NewReadingWSHandler(broadcaster, resolver, zerolog.Nop())

	rawPayload := map[string]any{
		"bgmMediaId": "bgm-1",
		"totalLines": 2,
		"lines": []map[string]any{
			{
				"Index":        0,
				"Text":         "hello",
				"Speaker":      "narrator",
				"AdvanceBy":    "gm",
				"VoiceMediaID": "v-1",
			},
			{
				"Index":     1,
				"Text":      "world",
				"Speaker":   "Alice",
				"AdvanceBy": "role:alice",
			},
		},
	}
	if ok := h.ForwardEvent(sessionID, "reading.started", rawPayload); !ok {
		t.Fatal("ForwardEvent(reading.started) returned false")
	}

	broadcaster.mu.Lock()
	defer broadcaster.mu.Unlock()
	var env *Envelope
	for _, b := range broadcaster.broadcasts {
		if b.env.Type == TypeReadingStarted {
			env = b.env
			break
		}
	}
	if env == nil {
		t.Fatal("no reading:started envelope broadcast")
	}

	body := string(env.Payload)
	for _, want := range []string{`"index"`, `"text"`, `"speaker"`, `"advanceBy"`, `"voiceMediaId"`, `"sectionId"`, `"bgmMediaId"`} {
		if !containsString(body, want) {
			t.Errorf("envelope missing camelCase key %s\nbody: %s", want, body)
		}
	}
	for _, bad := range []string{`"Index"`, `"Text"`, `"Speaker"`, `"AdvanceBy"`, `"VoiceMediaID"`} {
		if containsString(body, bad) {
			t.Errorf("envelope leaked PascalCase key %s\nbody: %s", bad, body)
		}
	}

	var decoded struct {
		SectionID  string `json:"sectionId"`
		BgmMediaID string `json:"bgmMediaId"`
		TotalLines int    `json:"totalLines"`
		Lines      []struct {
			Index        int    `json:"index"`
			Text         string `json:"text"`
			Speaker      string `json:"speaker"`
			AdvanceBy    string `json:"advanceBy"`
			VoiceMediaID string `json:"voiceMediaId"`
		} `json:"lines"`
	}
	if err := json.Unmarshal(env.Payload, &decoded); err != nil {
		t.Fatalf("decode envelope: %v", err)
	}
	if decoded.SectionID != "sec-xyz" {
		t.Errorf("sectionId = %q, want sec-xyz", decoded.SectionID)
	}
	if decoded.BgmMediaID != "bgm-1" {
		t.Errorf("bgmMediaId = %q, want bgm-1", decoded.BgmMediaID)
	}
	if decoded.TotalLines != 2 {
		t.Errorf("totalLines = %d, want 2", decoded.TotalLines)
	}
	if len(decoded.Lines) != 2 {
		t.Fatalf("lines len = %d, want 2", len(decoded.Lines))
	}
	if decoded.Lines[0].Text != "hello" || decoded.Lines[0].Index != 0 {
		t.Errorf("line[0] = %+v, want {index:0, text:hello}", decoded.Lines[0])
	}
	if decoded.Lines[1].AdvanceBy != "role:alice" {
		t.Errorf("line[1].advanceBy = %q, want role:alice", decoded.Lines[1].AdvanceBy)
	}
}

func TestReadingWSHandler_UnknownReadingType(t *testing.T) {
	resolver := newFakeResolver(&fakeReadingModule{})
	h := NewReadingWSHandler(nil, resolver, zerolog.Nop())

	c, drain := newReadingTestClient(t, uuid.New())
	h.Handle(c, MustEnvelope("reading:bogus", nil))
	received := drain()

	if !findEnvelopeType(received, TypeError) {
		t.Errorf("expected error envelope for unknown reading type, got: %v", received)
	}
}
