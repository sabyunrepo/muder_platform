package auth

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/db"
)

// Revoke codes mirror the CHECK constraint on revoke_log.code (migration
// 00027). Adding a new code requires migration + payload update + locale
// bundle update together — frontend translation tables key off these
// strings.
const (
	RevokeCodeBanned             = "banned"
	RevokeCodeLoggedOutElsewhere = "logged_out_elsewhere"
	RevokeCodePasswordChanged    = "password_changed"
	RevokeCodeAdminRevoked       = "admin_revoked"
)

// RevokeEntry is the domain payload accepted by RevokeRepo.Insert. UserID
// is required; SessionID / TokenJTI / RevokedBy are optional and select
// the granularity (whole user / single session / single token).
type RevokeEntry struct {
	UserID    uuid.UUID
	SessionID *uuid.UUID
	TokenJTI  *string
	Reason    string
	Code      string
	RevokedBy *uuid.UUID
}

// RevokeRecord is the domain projection of a revoke_log row. pgtype
// optionals are surfaced as nullable Go pointers so callers stay free of
// driver types.
type RevokeRecord struct {
	ID        uuid.UUID
	UserID    uuid.UUID
	SessionID *uuid.UUID
	TokenJTI  *string
	RevokedAt time.Time
	Reason    string
	Code      string
	RevokedBy *uuid.UUID
}

// RevokeRepo wraps the sqlc-generated revoke_log queries with a domain
// surface that hides pgtype optionals. The Hub.RevokeUser path writes
// here before pushing auth.revoked; the auth.identify / auth.resume
// reconnect path reads here as the pull fallback.
type RevokeRepo interface {
	Insert(ctx context.Context, entry RevokeEntry) (RevokeRecord, error)
	IsUserRevokedSince(ctx context.Context, userID uuid.UUID, since time.Time) (bool, error)
	IsTokenRevoked(ctx context.Context, jti string) (bool, error)
	IsSessionRevoked(ctx context.Context, sessionID uuid.UUID) (bool, error)
	ListRecent(ctx context.Context, userID uuid.UUID, limit int32) ([]RevokeRecord, error)
}

// revokeQuerier is the narrow sqlc surface required by revokeRepo. Tests
// can inject a fake to assert pgtype mapping without a live database;
// production wires *db.Queries.
type revokeQuerier interface {
	InsertRevoke(ctx context.Context, arg db.InsertRevokeParams) (db.RevokeLog, error)
	IsUserRevokedSince(ctx context.Context, arg db.IsUserRevokedSinceParams) (bool, error)
	IsTokenRevoked(ctx context.Context, tokenJti pgtype.Text) (bool, error)
	IsSessionRevoked(ctx context.Context, sessionID pgtype.UUID) (bool, error)
	ListRecentRevokesForUser(ctx context.Context, arg db.ListRecentRevokesForUserParams) ([]db.RevokeLog, error)
}

type revokeRepo struct {
	queries revokeQuerier
}

// NewRevokeRepo wires a RevokeRepo over the supplied sqlc querier.
// Panics on a nil querier — the bug surfaces at boot, not at first
// revoke under load.
func NewRevokeRepo(queries revokeQuerier) RevokeRepo {
	if queries == nil {
		panic("auth.NewRevokeRepo: queries is nil")
	}
	return &revokeRepo{queries: queries}
}

func (r *revokeRepo) Insert(ctx context.Context, entry RevokeEntry) (RevokeRecord, error) {
	row, err := r.queries.InsertRevoke(ctx, db.InsertRevokeParams{
		UserID:    entry.UserID,
		SessionID: uuidToPgtype(entry.SessionID),
		TokenJti:  textToPgtype(entry.TokenJTI),
		Reason:    entry.Reason,
		Code:      entry.Code,
		RevokedBy: uuidToPgtype(entry.RevokedBy),
	})
	if err != nil {
		return RevokeRecord{}, err
	}
	return revokeLogToRecord(row), nil
}

func (r *revokeRepo) IsUserRevokedSince(ctx context.Context, userID uuid.UUID, since time.Time) (bool, error) {
	return r.queries.IsUserRevokedSince(ctx, db.IsUserRevokedSinceParams{
		UserID:    userID,
		RevokedAt: since,
	})
}

func (r *revokeRepo) IsTokenRevoked(ctx context.Context, jti string) (bool, error) {
	return r.queries.IsTokenRevoked(ctx, pgtype.Text{String: jti, Valid: true})
}

func (r *revokeRepo) IsSessionRevoked(ctx context.Context, sessionID uuid.UUID) (bool, error) {
	return r.queries.IsSessionRevoked(ctx, pgtype.UUID{Bytes: sessionID, Valid: true})
}

func (r *revokeRepo) ListRecent(ctx context.Context, userID uuid.UUID, limit int32) ([]RevokeRecord, error) {
	rows, err := r.queries.ListRecentRevokesForUser(ctx, db.ListRecentRevokesForUserParams{
		UserID: userID,
		Limit:  limit,
	})
	if err != nil {
		return nil, err
	}
	out := make([]RevokeRecord, len(rows))
	for i, row := range rows {
		out[i] = revokeLogToRecord(row)
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// pgtype <-> domain conversion helpers (revoke-scope; not exported)
// ---------------------------------------------------------------------------

func uuidToPgtype(id *uuid.UUID) pgtype.UUID {
	if id == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *id, Valid: true}
}

func textToPgtype(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{}
	}
	return pgtype.Text{String: *s, Valid: true}
}

func pgtypeToUUID(p pgtype.UUID) *uuid.UUID {
	if !p.Valid {
		return nil
	}
	id := uuid.UUID(p.Bytes)
	return &id
}

func pgtypeToText(p pgtype.Text) *string {
	if !p.Valid {
		return nil
	}
	s := p.String
	return &s
}

func revokeLogToRecord(row db.RevokeLog) RevokeRecord {
	return RevokeRecord{
		ID:        row.ID,
		UserID:    row.UserID,
		SessionID: pgtypeToUUID(row.SessionID),
		TokenJTI:  pgtypeToText(row.TokenJti),
		RevokedAt: row.RevokedAt,
		Reason:    row.Reason,
		Code:      row.Code,
		RevokedBy: pgtypeToUUID(row.RevokedBy),
	}
}
