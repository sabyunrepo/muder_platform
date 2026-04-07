package session_test

import (
	"testing"

	"go.uber.org/goleak"
)

// TestMain enables goroutine-leak detection for all tests in the session package.
// Any test that starts a goroutine without cleaning it up will cause the suite
// to fail here, catching goroutine leaks introduced by future PRs early.
func TestMain(m *testing.M) {
	goleak.VerifyTestMain(m)
}
