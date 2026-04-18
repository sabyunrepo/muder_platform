package auditlog

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// ErrBufferFull is returned when the DBLogger internal channel is full.
var ErrBufferFull = errors.New("auditlog: buffer full")

// ErrStopped is returned by DBLogger.Append when Stop has already been called.
var ErrStopped = errors.New("auditlog: logger stopped")

// Querier is the subset of db.Queries used inside audit transactions.
// Keeping this as an interface is what makes TxRunner injectable for unit
// tests: a fake runner calls its own stub Querier without touching postgres.
//
// The pgtype-typed session_id / seq / user_id reflect the Phase 19 PR-6
// schema where those columns are NULLABLE.
type Querier interface {
	AppendAuditEvent(ctx context.Context, arg db.AppendAuditEventParams) (db.AuditEvent, error)
	AppendUserAuditEvent(ctx context.Context, arg db.AppendUserAuditEventParams) (db.AuditEvent, error)
	ListBySession(ctx context.Context, sessionID pgtype.UUID) ([]db.AuditEvent, error)
	LatestSeq(ctx context.Context, sessionID pgtype.UUID) (int64, error)
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
	pool   *pgxpool.Pool // retained for non-tx reads (ListBySession, LatestSeq, user path)
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
// ListBySession / LatestSeq / the user-event path.
func NewStoreWithRunner(runner TxRunner, pool *pgxpool.Pool) *Store {
	if runner == nil {
		panic("auditlog: runner must not be nil")
	}
	return &Store{runner: runner, pool: pool}
}

// Append persists evt to the database. The write path is chosen by evt
// shape (Phase 19 PR-6):
//
//   - SessionID non-zero ⇒ per-session Tx + seq assignment + AppendAuditEvent
//     (preserves the original 00018 behaviour: advisory lock, seq race-free).
//   - SessionID zero && UserID set ⇒ AppendUserAuditEvent (identity-bound
//     row, no seq, no Tx — the DB CHECK constraint asserts at least one
//     identity is present).
func (s *Store) Append(ctx context.Context, evt AuditEvent) error {
	if err := evt.Validate(); err != nil {
		return err
	}
	if evt.HasSession() {
		return s.appendSessionEvent(ctx, evt)
	}
	return s.appendUserEvent(ctx, evt)
}

// appendSessionEvent implements the game-bound write path. An advisory lock
// keyed on the session_id ensures only one writer at a time increments the
// per-session sequence counter, preventing duplicate-key races without
// requiring retry logic in the caller. The lock is transaction-scoped
// (pg_advisory_xact_lock), released on commit/rollback. Cross-session
// writers do not contend.
func (s *Store) appendSessionEvent(ctx context.Context, evt AuditEvent) error {
	err := s.runner.RunTx(ctx, evt.SessionID, func(q Querier) error {
		sessPG := toPgUUID(evt.SessionID)
		seq, err := q.LatestSeq(ctx, sessPG)
		if err != nil {
			return err
		}
		seq++

		_, err = q.AppendAuditEvent(ctx, db.AppendAuditEventParams{
			SessionID: sessPG,
			Seq:       pgtype.Int8{Int64: seq, Valid: true},
			ActorID:   ptrToPgUUID(evt.ActorID),
			UserID:    ptrToPgUUID(evt.UserID),
			Action:    string(evt.Action),
			ModuleID:  stringToPgText(evt.ModuleID),
			Payload:   payloadOrEmpty(evt.Payload),
		})
		return err
	})
	return wrapDBError(err)
}

// appendUserEvent implements the identity-bound write path for auth/admin/
// review/editor events. No Tx or seq is required because the partial
// UNIQUE(session_id, seq) index is not engaged when session_id IS NULL.
func (s *Store) appendUserEvent(ctx context.Context, evt AuditEvent) error {
	q := db.New(s.pool)
	_, err := q.AppendUserAuditEvent(ctx, db.AppendUserAuditEventParams{
		ActorID:  ptrToPgUUID(evt.ActorID),
		UserID:   ptrToPgUUID(evt.UserID),
		Action:   string(evt.Action),
		ModuleID: stringToPgText(evt.ModuleID),
		Payload:  payloadOrEmpty(evt.Payload),
	})
	return wrapDBError(err)
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
	rows, err := q.ListBySession(ctx, toPgUUID(sessionID))
	if err != nil {
		return nil, wrapDBError(err)
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
	seq, err := q.LatestSeq(ctx, toPgUUID(sessionID))
	if err != nil {
		return 0, wrapDBError(err)
	}
	return seq, nil
}

// --- pgtype <-> domain conversion helpers ---

func toPgUUID(u uuid.UUID) pgtype.UUID {
	if u == uuid.Nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: u, Valid: true}
}

func ptrToPgUUID(p *uuid.UUID) pgtype.UUID {
	if p == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *p, Valid: true}
}

func stringToPgText(s string) pgtype.Text {
	if s == "" {
		return pgtype.Text{}
	}
	return pgtype.Text{String: s, Valid: true}
}

func payloadOrEmpty(p json.RawMessage) json.RawMessage {
	if len(p) == 0 {
		return json.RawMessage(`{}`)
	}
	return p
}

// wrapDBError classifies a raw database error into the appropriate AppError
// variant. Context errors (Canceled, DeadlineExceeded) are returned as-is
// since they are not database classification concerns.
func wrapDBError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return err
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return apperror.NotFound("auditlog: no events for session").Wrap(err)
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505": // unique_violation
			return apperror.Conflict("auditlog: duplicate seq for session").Wrap(err)
		case "23503": // foreign_key_violation
			return apperror.BadRequest("auditlog: invalid session_id or user_id reference").Wrap(err)
		case "23514": // check_violation (e.g. identity_required)
			return apperror.BadRequest("auditlog: identity constraint violated").Wrap(err)
		}
	}
	return apperror.Internal("auditlog: database error").Wrap(err)
}

// rowToEvent converts a DB row to domain AuditEvent.
func rowToEvent(r db.AuditEvent) AuditEvent {
	evt := AuditEvent{
		ID:        r.ID,
		Action:    AuditAction(r.Action),
		Payload:   r.Payload,
		CreatedAt: r.CreatedAt,
	}
	if r.SessionID.Valid {
		evt.SessionID = uuid.UUID(r.SessionID.Bytes)
	}
	if r.Seq.Valid {
		evt.Seq = r.Seq.Int64
	}
	if r.ActorID.Valid {
		id := uuid.UUID(r.ActorID.Bytes)
		evt.ActorID = &id
	}
	if r.UserID.Valid {
		id := uuid.UUID(r.UserID.Bytes)
		evt.UserID = &id
	}
	if r.ModuleID.Valid {
		evt.ModuleID = r.ModuleID.String
	}
	return evt
}
