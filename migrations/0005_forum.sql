CREATE TABLE IF NOT EXISTS forum_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS forum_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  parent_id TEXT,
  body TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
  FOREIGN KEY(parent_id) REFERENCES forum_comments(id) ON DELETE CASCADE,
  FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS forum_votes (
  user_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  value INTEGER NOT NULL CHECK(value IN (-1,1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(user_id,target_type,target_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON forum_comments(post_id,created_at ASC);
CREATE INDEX IF NOT EXISTS idx_forum_votes_target ON forum_votes(target_type,target_id);
