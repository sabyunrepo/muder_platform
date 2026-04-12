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

// ErrStopped is returned by DBLogger.Append when Stop has already been called.
var ErrStopped = errors.New("auditlog: logger stopped")

// Querier is the subset of db.Queries used inside the Append transaction.
// Keeping this as an interface is what makes TxRunner injectable for unit
// tests: a fake runner calls its own stub Querier without touching postgres.
type Querier interface {
	AppendAuditEvent(ctx context.Context, arg db.AppendAuditEventParams) (db.AuditEvent, error)
	ListBySession(ctx context.Context, sessionID uuid.UUID) ([]db.AuditEvent, error)
	LatestSeq(ctx context.Context, sessionID uuid.UUID) (int64, error)
}

// TxRunner is a minimal seam for executing a read/write transaction against
// the audit_events table. The concrete implementation (pgxTxRunner) acquires
// the per-session advisory lock and hands the caller a sqlc Queries bound to
// the open pgx.Tx. Tests may substitute a fake runner to drive error-path
// unit tests without a real postgres instance.
type TxRunner interface {
	RunTx(ctx context.Context, sessionID uuid.UUID, fn func(q Querier) error) error
}

// Store wraps a pgxpool and sqlc Querier to provide thread-safe audit
// event persistence. Seq assignment uses a read-then-insert transaction
// to avoid lost-update races under concurrent writers.
type Store struct {
	runner TxRunner
	pool   *pgxpool.Pool // retained for non-tx reads (ListBySession, LatestSeq)
}

// NewStore constructs a Store backed by the given pgxpool. pool must not be nil.
func NewStore(pool *pgxpool.Pool) *Store {
	if pool == nil {
		panic("auditlog: pool must not be nil")
	}
	return &Store{
		runner: &pgxTxRunner{pool: pool},
		pool:   pool,
	}
}

// NewStoreWithRunner constructs a Store with a custom TxRunner. Intended for
// unit tests that need to drive error-classification paths without spinning up
// a testcontainer. pool may be nil when the caller does not exercise
// ListBySession / LatestSeq.
func NewStoreWithRunner(runner TxRunner, pool *pgxpool.Pool) *Store {
	if runner == nil {
		panic("auditlog: runner must not be nil")
	}
	return &Store{runner: runner, pool: pool}
}

// Append persists evt to the database, assigning the next seq atomically.
// An advisory lock keyed on the session_id ensures only one writer at a time
// increments the per-session sequence counter, preventing duplicate-key races
// under concurrent load without requiring retry logic in the caller. The lock
// is transaction-scoped (pg_advisory_xact_lock), so it's released automatically
// on commit or rollback. Cross-session writers do not contend with each other.
func (s *Store) Append(ctx context.Context, evt AuditEvent) error {
	if err := evt.Validate(); err != nil {
		return err
	}

	return s.runner.RunTx(ctx, evt.SessionID, func(q Querier) error {
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

// pgxTxRunner is the production TxRunner: it opens a real pgx read/write tx,
// takes the per-session advisory lock, and hands the fn a sqlc Queries bound
// to that tx.
type pgxTxRunner struct {
	pool *pgxpool.Pool
}

// RunTx implements TxRunner for pgxTxRunner.
func (r *pgxTxRunner) RunTx(ctx context.Context, sessionID uuid.UUID, fn func(q Querier) error) error {
	return pgx.BeginTxFunc(ctx, r.pool, pgx.TxOptions{
		IsoLevel:   pgx.ReadCommitted,
		AccessMode: pgx.ReadWrite,
	}, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx,
			"SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))",
			sessionID.String(),
		); err != nil {
			return err
		}
		return fn(db.New(tx))
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
