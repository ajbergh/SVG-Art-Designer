-- Initial schema for SVG Art Designer backend

-- API keys, encrypted at rest
CREATE TABLE IF NOT EXISTS api_keys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL DEFAULT 'gemini',
    provider    TEXT    NOT NULL DEFAULT 'google',
    ciphertext  BLOB    NOT NULL,
    nonce       BLOB    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_name ON api_keys(name);

-- Design history (replaces localStorage svg_designer_history_v1)
CREATE TABLE IF NOT EXISTS designs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt            TEXT    NOT NULL,
    style             TEXT    NOT NULL DEFAULT 'None',
    model             TEXT    NOT NULL,
    svg_content       TEXT    NOT NULL,
    layers_enabled    INTEGER NOT NULL DEFAULT 0,
    animation_enabled INTEGER NOT NULL DEFAULT 0,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_designs_created_at ON designs(created_at DESC);

-- User preferences
CREATE TABLE IF NOT EXISTS preferences (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
