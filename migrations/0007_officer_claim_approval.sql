CREATE TABLE IF NOT EXISTS claim_requests (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  character_name_key TEXT NOT NULL UNIQUE,
  fc_rank TEXT NOT NULL,
  portrait TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  verification_code_hash TEXT NOT NULL,
  verification_code_hint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  requested_at INTEGER NOT NULL,
  reviewed_at INTEGER,
  reviewed_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_claim_requests_status ON claim_requests(status,requested_at);
