-- Mlinzi schema. Idempotent: `npm run db:migrate` is safe to re-run.

-- One row per attempt, redacted before insert. This is the research log.
CREATE TABLE IF NOT EXISTS attempts (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at        timestamptz NOT NULL DEFAULT now(),
  session_id        uuid        NOT NULL,
  level             smallint    NOT NULL CHECK (level BETWEEN 1 AND 5),
  guard_mode        text        NOT NULL CHECK (guard_mode IN ('shadow', 'block')),
  guard_score       real,
  model             text,
  message           text        NOT NULL,
  reply             text,
  reasoning         text,
  tool_calls        jsonb       NOT NULL DEFAULT '[]',
  outcome           text        NOT NULL,
  latency_ms        integer     NOT NULL,
  prompt_tokens     integer,
  completion_tokens integer,
  country           text,
  error             text
);

CREATE INDEX IF NOT EXISTS attempts_level_outcome ON attempts (level, outcome);

CREATE INDEX IF NOT EXISTS attempts_created_at ON attempts (created_at);

-- Fixed-window counters for per-IP and global limits.
CREATE TABLE IF NOT EXISTS rate_counters (
  key          text        NOT NULL,
  window_start timestamptz NOT NULL,
  count        integer     NOT NULL,
  PRIMARY KEY (key, window_start)
);
