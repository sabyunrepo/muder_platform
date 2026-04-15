package ws_test

import (
	"sort"
	"strings"
	"testing"

	"github.com/mmp-platform/server/internal/ws"
)

// TestBootstrapRegistry_NoDuplicates verifies BootstrapRegistry does not panic
// due to duplicate type registration.
func TestBootstrapRegistry_NoDuplicates(t *testing.T) {
	r := ws.NewEnvelopeRegistry()
	// Should not panic.
	ws.BootstrapRegistry(r)
	types := r.Types()
	if len(types) == 0 {
		t.Fatal("BootstrapRegistry registered no types")
	}
}

// TestBootstrapRegistry_AllLegacyTypesKnown verifies that every namespace
// handled by the Router is represented in the registry. Any type returned by
// the router but absent from the registry would be silently dropped by
// Hub.Route when a registry is attached — this test prevents that regression.
func TestBootstrapRegistry_AllLegacyTypesKnown(t *testing.T) {
	r := ws.NewEnvelopeRegistry()
	ws.BootstrapRegistry(r)

	// Representative sample of types that must always be registered.
	// Extend this list when new module message types are added.
	required := []string{
		"accusation:accuse",
		"clue:use",
		"clue:use_target",
		"vote:cast",
		"voice:join",
		"voice:leave",
		"reading:advance",
		"reading:voice_ended",
		"gm:advance_phase",
		"whisper:send",
		"chat:send",
		"sound:play",
		"sound:stop",
	}

	for _, typ := range required {
		if !r.IsKnown(typ) {
			t.Errorf("required type %q not registered in envelope catalog", typ)
		}
	}
}

// TestBootstrapRegistry_NoSystemTypeRegistered ensures system types (ping, pong,
// error, connected, reconnect) are NOT registered — they bypass the registry via
// isSystemType and registering them would panic on duplicate at runtime.
func TestBootstrapRegistry_NoSystemTypeRegistered(t *testing.T) {
	r := ws.NewEnvelopeRegistry()
	ws.BootstrapRegistry(r)

	system := []string{"ping", "pong", "error", "connected", "reconnect"}
	for _, typ := range system {
		if r.IsKnown(typ) {
			t.Errorf("system type %q must not be registered in the catalog", typ)
		}
	}
}

// TestBootstrapRegistry_TypesAreSorted verifies no obvious namespace typos by
// confirming every registered type has exactly one ":" separator.
func TestBootstrapRegistry_TypesAreSorted(t *testing.T) {
	r := ws.NewEnvelopeRegistry()
	ws.BootstrapRegistry(r)

	types := r.Types()
	sort.Strings(types)

	for _, typ := range types {
		if strings.Count(typ, ":") != 1 {
			t.Errorf("type %q does not follow namespace:action format", typ)
		}
	}
}
