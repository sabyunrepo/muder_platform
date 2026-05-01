-- +goose Up
-- Phase 19 PR-9 — WS Auth Protocol revoke ledger.
--
-- Motivation: PR-9 introduces server-initiated session invalidation
-- (admin ban, password change, logout-elsewhere) over the auth.revoked
-- WS event. The server needs a persistent record of which user / session
-- / token has been revoked so that the WS hub middleware can:
--
--   1. detect ongoing connections whose user was just revoked and emit
--      auth.revoked + close the socket;
--   2. reject auth.identify / auth.resume frames that present a
--      revoked token after a reconnect attempt;
--   3. let admin dashboards review past revoke actions for audit.
--
-- Granularity: a revoke row may target the whole user (token_jti and
-- session_id NULL — the common ban / password-change case), a single
-- WS session (session_id set, token_jti NULL — kick-but-keep-account),
-- or a specific issued token (token_jti set — logout-elsewhere
-- precision). The CHECK enforces "every revoke targets at least the
-- user".
--
-- Reasons are constrained to a small enum so frontend translation
-- bundles can rely on stable strings; new reasons go through migration
-- + AuthRevokedPayload.Code update + locale resource update together.

CREATE TABLE revoke_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL,
    session_id  UUID,
    token_jti   TEXT,
    revoked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason      TEXT NOT NULL,
    code        TEXT NOT NULL,
    revoked_by  UUID,
    CONSTRAINT revoke_log_code_chk
        CHECK (code IN ('banned', 'logged_out_elsewhere', 'password_changed', 'admin_revoked'))
);

-- Hot path: WS hub middleware looks up "is there any revoke for this
-- user_id newer than the connection's auth timestamp?" on every
-- broadcast tick. DESC ordering on revoked_at lets the existence
-- predicate short-circuit on the freshest row.
CREATE INDEX idx_revoke_log_user_at
    ON revoke_log (user_id, revoked_at DESC);

-- Token-precision lookup for the auth.identify / auth.resume reject
-- path. Partial index keeps it cheap when most revokes are user-wide.
CREATE INDEX idx_revoke_log_token_jti
    ON revoke_log (token_jti)
    WHERE token_jti IS NOT NULL;

-- +goose Down
DROP TABLE IF EXISTS revoke_log;
