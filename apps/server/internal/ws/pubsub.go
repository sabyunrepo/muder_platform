package ws

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog"
)

// channelPrefix is the Redis channel prefix for WebSocket pub/sub.
const channelPrefix = "mmp:ws:"

// PubSub abstracts cross-node message broadcasting.
type PubSub interface {
	// Publish sends an envelope to all nodes for a given session.
	Publish(ctx context.Context, sessionID uuid.UUID, env *Envelope) error
	// Subscribe starts listening for messages on a session channel.
	Subscribe(ctx context.Context, sessionID uuid.UUID) error
	// Unsubscribe stops listening for a session channel.
	Unsubscribe(ctx context.Context, sessionID uuid.UUID) error
	// Close shuts down all subscriptions.
	Close() error
}

// OnMessageFunc is the callback invoked when a message is received from another node.
type OnMessageFunc func(sessionID uuid.UUID, env *Envelope)

// pubsubMessage is the wire format for messages sent over Redis pub/sub.
type pubsubMessage struct {
	NodeID    uuid.UUID `json:"nodeId"`
	SessionID uuid.UUID `json:"sessionId"`
	Envelope  *Envelope `json:"envelope"`
}

// channelName returns the Redis channel name for a session.
func channelName(sessionID uuid.UUID) string {
	return channelPrefix + sessionID.String()
}

// --- RedisPubSub ---

// RedisPubSub implements PubSub using Redis pub/sub for cross-node broadcasting.
type RedisPubSub struct {
	client    *redis.Client
	nodeID    uuid.UUID
	onMessage OnMessageFunc
	logger    zerolog.Logger

	mu   sync.RWMutex
	subs map[uuid.UUID]*redis.PubSub
}

// NewRedisPubSub creates a new RedisPubSub instance.
// The onMessage callback is invoked for each message received from other nodes.
func NewRedisPubSub(client *redis.Client, nodeID uuid.UUID, onMessage OnMessageFunc, logger zerolog.Logger) *RedisPubSub {
	return &RedisPubSub{
		client:    client,
		nodeID:    nodeID,
		onMessage: onMessage,
		logger:    logger.With().Str("component", "pubsub").Stringer("nodeId", nodeID).Logger(),
		subs:      make(map[uuid.UUID]*redis.PubSub),
	}
}

// Publish sends an envelope to all nodes subscribed to the session channel.
func (r *RedisPubSub) Publish(ctx context.Context, sessionID uuid.UUID, env *Envelope) error {
	msg := pubsubMessage{
		NodeID:    r.nodeID,
		SessionID: sessionID,
		Envelope:  env,
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("pubsub: marshal message: %w", err)
	}

	ch := channelName(sessionID)
	if err := r.client.Publish(ctx, ch, data).Err(); err != nil {
		return fmt.Errorf("pubsub: publish to %s: %w", ch, err)
	}

	r.logger.Debug().
		Stringer("sessionId", sessionID).
		Str("type", env.Type).
		Msg("published message")

	return nil
}

// Subscribe starts listening for messages on the session channel.
// It is safe to call multiple times for the same session; duplicate calls are no-ops.
func (r *RedisPubSub) Subscribe(ctx context.Context, sessionID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.subs[sessionID]; exists {
		return nil
	}

	ch := channelName(sessionID)
	sub := r.client.Subscribe(ctx, ch)

	// Verify the subscription was established.
	if _, err := sub.Receive(ctx); err != nil {
		_ = sub.Close()
		return fmt.Errorf("pubsub: subscribe to %s: %w", ch, err)
	}

	r.subs[sessionID] = sub

	r.logger.Info().
		Stringer("sessionId", sessionID).
		Str("channel", ch).
		Msg("subscribed to session channel")

	go r.listen(sessionID, sub)

	return nil
}

// listen reads messages from a Redis PubSub subscription and dispatches them.
func (r *RedisPubSub) listen(sessionID uuid.UUID, sub *redis.PubSub) {
	ch := sub.Channel()
	for msg := range ch {
		var pm pubsubMessage
		if err := json.Unmarshal([]byte(msg.Payload), &pm); err != nil {
			r.logger.Error().
				Err(err).
				Stringer("sessionId", sessionID).
				Str("raw", msg.Payload).
				Msg("failed to unmarshal pubsub message")
			continue
		}

		// Skip messages originating from this node.
		if pm.NodeID == r.nodeID {
			continue
		}

		if pm.Envelope == nil {
			r.logger.Warn().
				Stringer("sessionId", sessionID).
				Stringer("fromNode", pm.NodeID).
				Msg("received pubsub message with nil envelope")
			continue
		}

		r.logger.Debug().
			Stringer("sessionId", sessionID).
			Stringer("fromNode", pm.NodeID).
			Str("type", pm.Envelope.Type).
			Msg("received remote message")

		r.onMessage(pm.SessionID, pm.Envelope)
	}

	r.logger.Debug().
		Stringer("sessionId", sessionID).
		Msg("pubsub listener goroutine exited")
}

// Unsubscribe stops listening for the session channel and cleans up the subscription.
func (r *RedisPubSub) Unsubscribe(ctx context.Context, sessionID uuid.UUID) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	sub, exists := r.subs[sessionID]
	if !exists {
		return nil
	}

	delete(r.subs, sessionID)

	if err := sub.Close(); err != nil {
		return fmt.Errorf("pubsub: unsubscribe from %s: %w", channelName(sessionID), err)
	}

	r.logger.Info().
		Stringer("sessionId", sessionID).
		Msg("unsubscribed from session channel")

	return nil
}

// Close shuts down all active subscriptions.
func (r *RedisPubSub) Close() error {
	r.mu.Lock()
	defer r.mu.Unlock()

	var firstErr error
	for sessionID, sub := range r.subs {
		if err := sub.Close(); err != nil && firstErr == nil {
			firstErr = fmt.Errorf("pubsub: close subscription for %s: %w", sessionID, err)
		}
	}

	count := len(r.subs)
	r.subs = make(map[uuid.UUID]*redis.PubSub)

	r.logger.Info().
		Int("count", count).
		Msg("closed all pubsub subscriptions")

	return firstErr
}

// --- NoopPubSub ---

// NoopPubSub is a no-op implementation of PubSub for single-node deployments and testing.
type NoopPubSub struct{}

func (NoopPubSub) Publish(context.Context, uuid.UUID, *Envelope) error { return nil }
func (NoopPubSub) Subscribe(context.Context, uuid.UUID) error          { return nil }
func (NoopPubSub) Unsubscribe(context.Context, uuid.UUID) error        { return nil }
func (NoopPubSub) Close() error                                        { return nil }

// compile-time interface checks
var (
	_ PubSub = (*RedisPubSub)(nil)
	_ PubSub = NoopPubSub{}
)
