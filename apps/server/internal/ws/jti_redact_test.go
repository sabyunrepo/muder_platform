package ws

import (
	"strings"
	"testing"
)

// PR-9 CR-2/CR-3: redactJTI must produce a stable non-reversible
// fingerprint. Tests pin the contract so a future "let's just log the
// last 4 chars" tweak that reintroduces a partial leak is caught.

func TestRedactJTI_StableHash(t *testing.T) {
	t.Parallel()
	jti := "550e8400-e29b-41d4-a716-446655440000"
	first := redactJTI(jti)
	second := redactJTI(jti)
	if first != second {
		t.Errorf("hash not stable: first=%q second=%q", first, second)
	}
	if len(first) != 8 {
		t.Errorf("hash length=%d, want 8 (sha256 hex prefix)", len(first))
	}
	if strings.Contains(jti, first) {
		t.Errorf("hash %q is a substring of the raw jti — leak risk", first)
	}
}

func TestRedactJTI_DifferentInputsProduceDifferentHashes(t *testing.T) {
	t.Parallel()
	a := redactJTI("token-a")
	b := redactJTI("token-b")
	if a == b {
		t.Errorf("collision: redactJTI(a)=redactJTI(b)=%q", a)
	}
}

func TestRedactJTI_EmptyInputReturnsEmpty(t *testing.T) {
	t.Parallel()
	if got := redactJTI(""); got != "" {
		t.Errorf("redactJTI(\"\") = %q, want empty (do not log a hash for nothing)", got)
	}
}
