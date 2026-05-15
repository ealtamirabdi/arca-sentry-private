-- ARCA SENTRY — optional PostgreSQL schema.
--
-- The SQLite event store (core/event_store.py) is the runtime source of truth.
-- This Postgres schema is offered as an alternative for enterprise deployments
-- that want a centralized auditable backend with the same append-only model.

CREATE TABLE IF NOT EXISTS events (
    seq            BIGSERIAL PRIMARY KEY,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type     TEXT NOT NULL,
    interaction_id TEXT,
    payload        JSONB NOT NULL,
    prev_hash      TEXT NOT NULL,
    self_hash      TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_events_interaction ON events(interaction_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_severity
    ON events ((payload->>'severity'))
    WHERE event_type = 'decision';

-- Forbid UPDATE and DELETE on events to keep the audit log append-only.
CREATE OR REPLACE FUNCTION events_immutable() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'events table is append-only (no % allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_no_update ON events;
CREATE TRIGGER trg_events_no_update BEFORE UPDATE ON events
    FOR EACH ROW EXECUTE FUNCTION events_immutable();

DROP TRIGGER IF EXISTS trg_events_no_delete ON events;
CREATE TRIGGER trg_events_no_delete BEFORE DELETE ON events
    FOR EACH ROW EXECUTE FUNCTION events_immutable();
