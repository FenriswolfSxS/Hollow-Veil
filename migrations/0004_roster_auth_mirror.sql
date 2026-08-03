CREATE TABLE IF NOT EXISTS roster_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL UNIQUE,
  rank TEXT NOT NULL,
  portrait TEXT,
  profile_url TEXT,
  world TEXT,
  job TEXT,
  level INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roster_members_rank ON roster_members(rank);
