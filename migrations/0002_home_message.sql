CREATE TABLE IF NOT EXISTS home_message (
  id INTEGER PRIMARY KEY CHECK(id=1),
  content TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT,
  FOREIGN KEY(updated_by) REFERENCES users(id)
);
