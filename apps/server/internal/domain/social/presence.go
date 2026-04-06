package social

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

const (
	presencePrefix = "mmp:presence:"
	presenceTTL    = 90 * time.Second
)

// PresenceProvider manages online/offline status using Redis SETEX.
type PresenceProvider interface {
	SetOnline(ctx context.Context, userID uuid.UUID) error
	SetOffline(ctx context.Context, userID uuid.UUID) error
	Heartbeat(ctx context.Context, userID uuid.UUID) error
	IsOnline(ctx context.Context, userID uuid.UUID) (bool, error)
	GetOnlineFriends(ctx context.Context, friendIDs []uuid.UUID) ([]uuid.UUID, error)
}

type redisPresence struct {
	client *redis.Client
}

// NewPresenceProvider creates a Redis-backed presence provider.
func NewPresenceProvider(client *redis.Client) PresenceProvider {
	return &redisPresence{client: client}
}

func presenceKey(userID uuid.UUID) string {
	return presencePrefix + userID.String()
}

func (p *redisPresence) SetOnline(ctx context.Context, userID uuid.UUID) error {
	return p.client.Set(ctx, presenceKey(userID), "1", presenceTTL).Err()
}

func (p *redisPresence) SetOffline(ctx context.Context, userID uuid.UUID) error {
	return p.client.Del(ctx, presenceKey(userID)).Err()
}

func (p *redisPresence) Heartbeat(ctx context.Context, userID uuid.UUID) error {
	return p.client.Expire(ctx, presenceKey(userID), presenceTTL).Err()
}

func (p *redisPresence) IsOnline(ctx context.Context, userID uuid.UUID) (bool, error) {
	n, err := p.client.Exists(ctx, presenceKey(userID)).Result()
	if err != nil {
		return false, fmt.Errorf("presence: check online: %w", err)
	}
	return n > 0, nil
}

func (p *redisPresence) GetOnlineFriends(ctx context.Context, friendIDs []uuid.UUID) ([]uuid.UUID, error) {
	if len(friendIDs) == 0 {
		return nil, nil
	}

	keys := make([]string, len(friendIDs))
	for i, id := range friendIDs {
		keys[i] = presenceKey(id)
	}

	// MGET returns values in order; non-existing keys return nil.
	vals, err := p.client.MGet(ctx, keys...).Result()
	if err != nil {
		return nil, fmt.Errorf("presence: get online friends: %w", err)
	}

	online := make([]uuid.UUID, 0, len(friendIDs))
	for i, v := range vals {
		if v != nil {
			online = append(online, friendIDs[i])
		}
	}
	return online, nil
}
