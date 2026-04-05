package lock

import (
	"context"
	"errors"
	"time"
)

// ErrLockNotAcquired is returned when a lock cannot be obtained.
var ErrLockNotAcquired = errors.New("lock: not acquired")

// Lock represents an acquired distributed lock.
type Lock interface {
	Release(ctx context.Context) error
}

// Locker defines the interface for distributed locking.
type Locker interface {
	Acquire(ctx context.Context, key string, ttl time.Duration) (Lock, error)
}
