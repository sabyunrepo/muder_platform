package lock

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const lockPrefix = "lock:"

// releaseScript atomically checks owner before deleting.
var releaseScript = redis.NewScript(`
if redis.call("get", KEYS[1]) == ARGV[1] then
	return redis.call("del", KEYS[1])
end
return 0
`)

// RedisLocker implements Locker using Redis SET NX.
type RedisLocker struct {
	client *redis.Client
}

// NewRedisLocker creates a new RedisLocker. Panics if client is nil.
func NewRedisLocker(client *redis.Client) *RedisLocker {
	if client == nil {
		panic("lock: redis client must not be nil")
	}
	return &RedisLocker{client: client}
}

func (l *RedisLocker) Acquire(ctx context.Context, key string, ttl time.Duration) (Lock, error) {
	token := uuid.New().String()
	fullKey := lockPrefix + key

	ok, err := l.client.SetNX(ctx, fullKey, token, ttl).Result()
	if err != nil {
		return nil, fmt.Errorf("lock: acquire %q: %w", key, err)
	}
	if !ok {
		return nil, ErrLockNotAcquired
	}

	return &redisLock{
		client: l.client,
		key:    fullKey,
		token:  token,
	}, nil
}

type redisLock struct {
	client *redis.Client
	key    string
	token  string
}

func (rl *redisLock) Release(ctx context.Context) error {
	result, err := releaseScript.Run(ctx, rl.client, []string{rl.key}, rl.token).Int64()
	if err != nil {
		return fmt.Errorf("lock: release %q: %w", rl.key, err)
	}
	if result == 0 {
		return fmt.Errorf("lock: release %q: lock expired or owned by another", rl.key)
	}
	return nil
}
