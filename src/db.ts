import Database from 'better-sqlite3'

const db = new Database('data.db')

db.pragma('journal_mode = WAL')

// Set schema
db.exec(`
  CREATE TABLE IF NOT EXISTS token (
    id INTEGER PRIMARY KEY,
    access_token TEXT,
    token_type TEXT,
    expires_in INTEGER,
    expires_at INTEGER,
    refresh_token TEXT,
    scope TEXT
  );
`)

export default db
