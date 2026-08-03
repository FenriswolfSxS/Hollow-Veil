CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'Wanderer',
  character_name TEXT,
  password_hash TEXT,
  password_salt TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_character_name_nocase ON users(lower(character_name));
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
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
CREATE TABLE IF NOT EXISTS home_message (
  id INTEGER PRIMARY KEY CHECK(id=1),
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT
);
