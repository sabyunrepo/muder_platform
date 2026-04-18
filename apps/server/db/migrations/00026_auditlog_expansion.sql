-- +goose Up
-- Phase 19 PR-6 — Auditlog Expansion (F-sec-4 P0, delta D-SEC-1).
--
-- Motivation: the original audit_events schema (00018) required a non-null
-- session_id, so auth/admin/review/editor events — which occur outside any
-- game session — could not be written. Phase 19 audit F-sec-4 flagged this
-- as a P0 because a full class of security-relevant actions (login,
-- logout, ban, review approval, clue-edge edits) goes unrecorded.
--
-- This migration loosens the schema to support both game-bound events
-- (session_id, seq) and identity-bound events (user_id, seq=NULL), while
-- guaranteeing every row carries at least one identity:
--
--   1. session_id and seq become NULLABLE.
--   2. A user_id column is added (NULLABLE) so auth/admin actions can be
--      attributed to the acting account without fabricating a session.
--   3. The legacy per-session UNIQUE(session_id, seq) is replaced with a
--      partial unique index active only when session_id IS NOT NULL, so
--      user-only rows never collide on a synthetic seq.
--   4. An IDENTITY CHECK constraint forbids rows that have neither
--      session_id nor user_id, preserving the "every audit row is
--      attributable" invariant.
--   5. A descending index on (user_id, created_at) keeps admin-dashboard
--      lookups ("show last N actions by user X") fast.

ALTER TABLE audit_events
    ALTER COLUMN session_id DROP NOT NULL,
    ALTER COLUMN seq DROP NOT NULL,
    ADD COLUMN user_id UUID;

ALTER TABLE audit_events
    DROP CONSTRAINT IF EXISTS audit_events_session_id_seq_key;

CREATE UNIQUE INDEX audit_events_session_seq_key
    ON audit_events (session_id, seq)
    WHERE session_id IS NOT NULL;

CREATE INDEX idx_audit_events_user
    ON audit_events (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

ALTER TABLE audit_events
    ADD CONSTRAINT audit_events_identity_required
    CHECK (session_id IS NOT NULL OR user_id IS NOT NULL);

-- +goose Down
-- Reverts the schema to the 00018 shape. Session-less rows (user-only) are
-- evicted before restoring NOT NULL; the down path is only expected to
-- run when rolling back an aborted migration and losing those rows is
-- acceptable in that recovery scenario.

ALTER TABLE audit_events
    DROP CONSTRAINT IF EXISTS audit_events_identity_required;

DROP INDEX IF EXISTS idx_audit_events_user;
DROP INDEX IF EXISTS audit_events_session_seq_key;

DELETE FROM audit_events WHERE session_id IS NULL;

ALTER TABLE audit_events
    ALTER COLUMN session_id SET NOT NULL,
    ALTER COLUMN seq SET NOT NULL,
    DROP COLUMN user_id;

ALTER TABLE audit_events
    ADD CONSTRAINT audit_events_session_id_seq_key UNIQUE (session_id, seq);
