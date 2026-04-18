// Package testutil provides shared helpers for engine module redaction tests.
// Lives outside the engine package so callers in module/ and session/ can
// import it without creating cycles.
package testutil

import (
	"strings"
	"testing"

	"github.com/google/uuid"
)

// PeerLeakAssert verifies that a per-player snapshot payload (`raw`) contains
// no reference to any peer's UUID string. This is the canonical cross-package
// assertion for the PR-2a / Phase 19 F-sec-2 per-player redaction contract.
//
// The check is a substring match: simple, strict, and catches the common
// module authoring bug where peer UUIDs end up as map keys in the serialised
// snapshot. False positives are possible only if a peer UUID legitimately
// matches some non-key field in the payload — no such collision exists in
// current modules, and the risk is outweighed by the cost of a full JSON
// walk that would know nothing about module-specific field semantics.
//
// Usage:
//
//	raw, _ := mod.BuildStateFor(alice)
//	testutil.PeerLeakAssert(t, raw, alice, bob, charlie)
//
// The `caller` argument is only used for error messages — it does not have to
// be present in the payload (a player with no state yet yields an empty
// snapshot, which is also a valid passing case).
func PeerLeakAssert(t *testing.T, raw []byte, caller uuid.UUID, peers ...uuid.UUID) {
	t.Helper()
	s := string(raw)
	for _, p := range peers {
		if strings.Contains(s, p.String()) {
			t.Errorf(
				"peer uuid %s leaked into caller %s snapshot:\n  payload=%s",
				p, caller, s,
			)
		}
	}
}

// AssertContainsCaller asserts that the snapshot DOES carry the caller's UUID
// when state exists for them. Useful alongside PeerLeakAssert to confirm that
// redaction is not over-zealous (stripping the caller's own entry).
func AssertContainsCaller(t *testing.T, raw []byte, caller uuid.UUID) {
	t.Helper()
	if !strings.Contains(string(raw), caller.String()) {
		t.Errorf("caller %s missing from own snapshot: %s", caller, raw)
	}
}
