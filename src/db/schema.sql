CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── API Keys & Billing ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                     TEXT UNIQUE NOT NULL DEFAULT 'x_live_' || encode(gen_random_bytes(24), 'hex'),
  name                    TEXT,
  email                   TEXT,
  tier                    TEXT NOT NULL DEFAULT 'free', -- free|starter|growth|enterprise
  credits_remaining       INT NOT NULL DEFAULT 500,
  credits_used_period     INT NOT NULL DEFAULT 0,
  overage_credits         INT NOT NULL DEFAULT 0,
  proxy_credits_remaining INT NOT NULL DEFAULT 0,
  period_reset_at         TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', NOW()) + interval '1 month'),
  active                  BOOLEAN DEFAULT true,
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  stripe_item_id          TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS api_keys_email_idx ON api_keys (email);
CREATE INDEX IF NOT EXISTS api_keys_stripe_sub_idx ON api_keys (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

-- ─── Scrape Jobs ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scrape_jobs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id       UUID NOT NULL REFERENCES api_keys(id),
  batch_id         TEXT,                             -- optional batch grouping UUID
  url              TEXT NOT NULL,
  strategy         TEXT NOT NULL DEFAULT 'auto',    -- auto|http|playwright|flaresolverr
  strategy_used    TEXT,                             -- actual strategy that ran
  proxy_tier       TEXT,                             -- none|datacenter|residential
  output_formats   TEXT[] NOT NULL,                  -- ['html','markdown','screenshot',...]
  options          JSONB NOT NULL DEFAULT '{}',      -- wait_for, headers, cookies, selectors, etc.
  status           TEXT NOT NULL DEFAULT 'pending',  -- pending|running|done|failed
  priority         INT NOT NULL DEFAULT 0,           -- 0=normal, 1=high, 2=realtime
  worker_id        TEXT,
  credits_cost     INT,
  duration_ms      INT,
  result           JSONB,
  error            TEXT,
  webhook_url      TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ
);

-- Queue poll index: FOR UPDATE SKIP LOCKED
CREATE INDEX IF NOT EXISTS scrape_jobs_queue_idx ON scrape_jobs (priority DESC, created_at ASC)
  WHERE status = 'pending';

-- User lookup
CREATE INDEX IF NOT EXISTS scrape_jobs_key_idx ON scrape_jobs (api_key_id, created_at DESC);

-- Batch lookup
CREATE INDEX IF NOT EXISTS scrape_jobs_batch_idx ON scrape_jobs (batch_id)
  WHERE batch_id IS NOT NULL;

-- ─── Webhooks ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhooks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id    UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  url           TEXT NOT NULL,
  secret        TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  events        TEXT[] NOT NULL DEFAULT '{job.done,job.failed}',
  active        BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  last_fired_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS webhooks_key_idx ON webhooks (api_key_id);

-- ─── Webhook Delivery Log ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id   UUID REFERENCES webhooks(id) ON DELETE CASCADE,
  job_id       UUID REFERENCES scrape_jobs(id),
  event        TEXT NOT NULL,
  status_code  INT,
  success      BOOLEAN DEFAULT false,
  attempt      INT DEFAULT 1,
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Usage Events ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id  UUID NOT NULL REFERENCES api_keys(id),
  job_id      UUID REFERENCES scrape_jobs(id),
  credits     INT NOT NULL,
  strategy    TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_key_idx ON usage_events (api_key_id, recorded_at DESC);

-- ─── Rate Limit Windows ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limit_windows (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id     UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  window_start   TIMESTAMPTZ NOT NULL,
  request_count  INT NOT NULL DEFAULT 0,
  UNIQUE (api_key_id, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limit_windows_key_idx ON rate_limit_windows (api_key_id, window_start DESC);

-- ─── Proxy Stats ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS proxy_stats (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proxy_host   TEXT NOT NULL,  -- host:port only (no credentials in DB)
  source       TEXT NOT NULL,
  success      BOOLEAN NOT NULL,
  response_ms  INT,
  job_id       UUID REFERENCES scrape_jobs(id),
  recorded_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS proxy_stats_host_idx ON proxy_stats (proxy_host, recorded_at DESC);

-- ─── Scrape Telemetry ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scrape_telemetry (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  domain        VARCHAR     NOT NULL,
  step_index    INT         NOT NULL,
  strategy      VARCHAR     NOT NULL,
  proxy_tier    VARCHAR     NOT NULL,
  success       BOOLEAN     NOT NULL,
  blocked       BOOLEAN     NOT NULL DEFAULT false,
  time_ms       INT         NOT NULL,
  cost_credits  INT         NOT NULL DEFAULT 0,
  error_type    VARCHAR,
  api_key_id    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scrape_telemetry_domain_created
  ON scrape_telemetry (domain, created_at DESC);

CREATE INDEX IF NOT EXISTS scrape_telemetry_created
  ON scrape_telemetry (created_at DESC);

-- ─── Domain Strategies ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS domain_strategies (
  domain           VARCHAR     PRIMARY KEY,
  optimal_strategy VARCHAR     NOT NULL,
  proxy_tier       VARCHAR     NOT NULL,
  success_rate     FLOAT       NOT NULL,
  avg_time_ms      INT         NOT NULL,
  avg_cost_credits FLOAT       NOT NULL,
  sample_count     INT         NOT NULL,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked           BOOLEAN     NOT NULL DEFAULT false
);
