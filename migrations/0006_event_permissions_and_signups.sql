CREATE TABLE IF NOT EXISTS event_signups (
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'going' CHECK(status IN ('going','maybe')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(event_id,user_id),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_event_signups_event ON event_signups(event_id,status);
