package auditlog

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mmp-platform/server/internal/db"
)

// ErrBufferFull is returned when the DBLogger internal channel is full.
var ErrBufferFull = errors.New("auditlog: buffer full")

// Querier is the subset of db.Queries used by Store.
// Defined as an interface to allow test injection.
type Querier interface {
	AppendAuditEvent(ctx context.Context, arg db.AppendAuditEventParams) (db.AuditEvent, error)
	ListBySession(ctx context.Context, sessionID uuid.UUID) ([]db.AuditEvent, error)
	LatestSeq(ctx context.Context, sessionID uuid.UUID) (int64, error)
}

// Store wraps a pgxpool and sqlc Querier to provide thread-safe audit
// event persistence. Seq assignment uses a read-then-insert transaction
// to avoid lost-update races under concurrent writers.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore constructs a Store. pool must not be nil.
func NewStore(pool *pgxpool.Pool) *Store {
	if pool == nil {
		panic("auditlog: pool must not be nil")
	}
	return &Store{pool: pool}
}

// Append persists evt to the database, assigning the next seq
// atomically inside a serializable transaction.
func (s *Store) Append(ctx context.Context, evt AuditEvent) error {
	if err := evt.Validate(); err != nil {
		return err
	}

	return pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{
		IsoLevel:   pgx.Serializable,
		AccessMode: pgx.ReadWrite,
	}, func(tx pgx.Tx) error {
		q := db.New(tx)

		seq, err := q.LatestSeq(ctx, evt.SessionID)
		if err != nil {
			return err
		}
		seq++ // next sequence number

		payload := evt.Payload
		if len(payload) == 0 {
			payload = json.RawMessage(`{}`)
		}

		var actorID pgtype.UUID
		if evt.ActorID != nil {
			actorID = pgtype.UUID{Bytes: *evt.ActorID, Valid: true}
		}

		var moduleID pgtype.Text
		if evt.ModuleID != "" {
			moduleID = pgtype.Text{String: evt.ModuleID, Valid: true}
		}

		_, err = q.AppendAuditEvent(ctx, db.AppendAuditEventParams{
			SessionID: evt.SessionID,
			Seq:       seq,
			ActorID:   actorID,
			Action:    string(evt.Action),
			ModuleID:  moduleID,
			Payload:   payload,
		})
		return err
	})
}

// ListBySession returns all audit events for the given session ordered by seq.
func (s *Store) ListBySession(ctx context.Context, sessionID uuid.UUID) ([]AuditEvent, error) {
	q := db.New(s.pool)
	rows, err := q.ListBySession(ctx, sessionID)
	if err != nil {
		return nil, err
	}
	out := make([]AuditEvent, 0, len(rows))
	for _, r := range rows {
		out = append(out, rowToEvent(r))
	}
	return out, nil
}

// LatestSeq returns the highest seq stored for the session, or 0 if none.
func (s *Store) LatestSeq(ctx context.Context, sessionID uuid.UUID) (int64, error) {
	q := db.New(s.pool)
	return q.LatestSeq(ctx, sessionID)
}

// rowToEvent converts a DB row to domain AuditEvent.
func rowToEvent(r db.AuditEvent) AuditEvent {
	evt := AuditEvent{
		ID:        r.ID,
		SessionID: r.SessionID,
		Seq:       r.Seq,
		Action:    AuditAction(r.Action),
		Payload:   r.Payload,
		CreatedAt: r.CreatedAt,
	}
	if r.ActorID.Valid {
		id := uuid.UUID(r.ActorID.Bytes)
		evt.ActorID = &id
	}
	if r.ModuleID.Valid {
		evt.ModuleID = r.ModuleID.String
	}
	return evt
}
