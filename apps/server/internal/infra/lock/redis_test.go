package lock

import (
	"testing"
)

func TestNewRedisLocker_NilClient(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic for nil client")
		}
	}()
	NewRedisLocker(nil)
}
