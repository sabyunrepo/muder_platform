package engine

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
)

func TestFilterByPlayer_CallerHasEntry(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()
	src := map[uuid.UUID][]string{
		alice: {"e1", "e2"},
		bob:   {"e3"},
	}
	got := FilterByPlayer(src, alice)
	if len(got) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(got))
	}
	if _, ok := got[bob]; ok {
		t.Errorf("bob's entry leaked into alice's redacted view")
	}
	if v := got[alice]; len(v) != 2 || v[0] != "e1" || v[1] != "e2" {
		t.Errorf("alice's own entry malformed: %v", v)
	}
}

func TestFilterByPlayer_CallerHasNoEntry(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()
	src := map[uuid.UUID]int{bob: 42}
	got := FilterByPlayer(src, alice)
	if got == nil {
		t.Fatalf("expected non-nil empty map, got nil")
	}
	if len(got) != 0 {
		t.Errorf("expected empty map, got %d entries", len(got))
	}
	// JSON shape must be "{}" not "null".
	raw, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("json marshal: %v", err)
	}
	if string(raw) != "{}" {
		t.Errorf("expected {} JSON shape, got %s", string(raw))
	}
}

func TestFilterByPlayer_OtherPlayerEntriesNotLeaked(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()
	carol := uuid.New()
	src := map[uuid.UUID]string{
		alice: "apple",
		bob:   "banana",
		carol: "cherry",
	}
	got := FilterByPlayer(src, alice)
	if len(got) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(got))
	}
	for pid := range got {
		if pid != alice {
			t.Errorf("leaked non-caller entry for %s", pid)
		}
	}
}

func TestFilterByPlayerStringKey_CallerHasEntry(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()
	src := map[string][]string{
		alice.String(): {"x"},
		bob.String():   {"y"},
	}
	got := FilterByPlayerStringKey(src, alice)
	if len(got) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(got))
	}
	if _, ok := got[bob.String()]; ok {
		t.Errorf("bob's entry leaked")
	}
}

func TestFilterByPlayerStringKey_Empty(t *testing.T) {
	alice := uuid.New()
	src := map[string]int{}
	got := FilterByPlayerStringKey(src, alice)
	if got == nil {
		t.Fatalf("expected non-nil empty map")
	}
	raw, _ := json.Marshal(got)
	if string(raw) != "{}" {
		t.Errorf("expected {} got %s", raw)
	}
}

func TestFilterByKeySet_AllowedOnly(t *testing.T) {
	src := map[string]int{"g1": 1, "g2": 2, "g3": 3}
	got := FilterByKeySet(src, []string{"g1", "g3", "missing"})
	if len(got) != 2 {
		t.Fatalf("expected 2 entries, got %d", len(got))
	}
	if got["g1"] != 1 || got["g3"] != 3 {
		t.Errorf("filtered values wrong: %v", got)
	}
	if _, ok := got["g2"]; ok {
		t.Errorf("g2 leaked despite not in allow-list")
	}
}

func TestFilterByKeySet_EmptyAllow(t *testing.T) {
	src := map[string]int{"a": 1}
	got := FilterByKeySet(src, nil)
	if got == nil {
		t.Fatalf("expected non-nil empty map")
	}
	if len(got) != 0 {
		t.Errorf("expected empty, got %d", len(got))
	}
}
