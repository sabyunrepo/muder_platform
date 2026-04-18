package testutil_test

import (
	"testing"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine/testutil"
)

// TestPeerLeakAssert_FlagsPeerPresence — a peer UUID anywhere in the raw
// payload must be reported.
func TestPeerLeakAssert_FlagsPeerPresence(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()

	payload := []byte(`{"completed":{"` + alice.String() + `":["c1"],"` + bob.String() + `":["c2"]}}`)

	// Subtest isolates the inner t.Errorf so we can observe a failing
	// PeerLeakAssert without failing the outer test.
	spy := &testing.T{}
	testutil.PeerLeakAssert(spy, payload, alice, bob)
	if !spy.Failed() {
		t.Error("expected PeerLeakAssert to flag bob leak, but spy reported no failure")
	}
}

// TestPeerLeakAssert_PassesOnCleanPayload — a payload with only the caller's
// UUID must not trip the assertion.
func TestPeerLeakAssert_PassesOnCleanPayload(t *testing.T) {
	alice := uuid.New()
	bob := uuid.New()

	payload := []byte(`{"completed":{"` + alice.String() + `":["c1"]}}`)

	spy := &testing.T{}
	testutil.PeerLeakAssert(spy, payload, alice, bob)
	if spy.Failed() {
		t.Errorf("PeerLeakAssert should have passed a clean payload, but spy reported failure")
	}
}

// TestAssertContainsCaller_RequiresCallerWhenStateExists — the caller's UUID
// must be present in their own payload when state is non-empty.
func TestAssertContainsCaller_RequiresCallerWhenStateExists(t *testing.T) {
	alice := uuid.New()
	payload := []byte(`{"completed":{}}`) // empty — no caller UUID

	spy := &testing.T{}
	testutil.AssertContainsCaller(spy, payload, alice)
	if !spy.Failed() {
		t.Error("expected AssertContainsCaller to flag missing caller, but spy reported no failure")
	}
}

func TestAssertContainsCaller_Passes(t *testing.T) {
	alice := uuid.New()
	payload := []byte(`{"completed":{"` + alice.String() + `":["c1"]}}`)

	spy := &testing.T{}
	testutil.AssertContainsCaller(spy, payload, alice)
	if spy.Failed() {
		t.Errorf("AssertContainsCaller should have passed, but spy reported failure")
	}
}
