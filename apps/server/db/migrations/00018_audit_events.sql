-- +goose Up
CREATE TABLE audit_events (
    id         BIGSERIAL PRIMARY KEY,
    session_id UUID NOT NULL,
    seq        BIGINT NOT NULL,
    actor_id   UUID,
    action     VARCHAR(64) NOT NULL,
    module_id  VARCHAR(128),
    payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, seq)
);

CREATE INDEX idx_audit_events_session ON audit_events(session_id, seq);
CREATE INDEX idx_audit_events_action ON audit_events(action);
CREATE INDEX idx_audit_events_created ON audit_events(created_at DESC);

-- +goose Down
DROP TABLE IF EXISTS audit_events;
