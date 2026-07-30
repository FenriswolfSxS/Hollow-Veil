CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'pending',
  character_name TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  start_at TEXT NOT NULL,
  end_at TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'members',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at);
CREATE TABLE IF NOT EXISTS roster_cache (
  id INTEGER PRIMARY KEY CHECK(id=1),
  payload TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
