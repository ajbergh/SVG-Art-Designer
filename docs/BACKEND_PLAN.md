# Go Backend Planning Document

## SVG Art Designer — Server-Side Architecture

### Goal

Add a pure Go backend (no CGO) that:

1. **Stores design history** in SQLite — replaces browser localStorage
2. **Stores SVG designs** as first-class persisted artifacts
3. **Stores API keys encrypted** in the database — removes keys from the client bundle
4. **Proxies Gemini API calls** — the frontend never touches the AI API directly

---

## 1. Pure Go SQLite — No CGO

### Library: `modernc.org/sqlite`

A complete, pure-Go SQLite implementation transpiled from C using `ccgo`. No CGO, no GCC, no cross-compilation friction.

```
go get modernc.org/sqlite
go get github.com/jmoiron/sqlx  # Optional: ergonomic SQL wrapper
```

**Why this choice:**
- Zero CGO dependency — builds on any OS with `go build`
- Full SQLite feature parity (WAL mode, JSON functions, etc.)
- Well-maintained, ~10M+ downloads
- Compatible with `database/sql` standard interface

**Alternative considered:** `github.com/glebarez/go-sqlite` — thinner wrapper around `modernc.org/sqlite`, also pure Go.

**Trade-off:** Pure-Go SQLite is ~2-3x slower than CGO mattn/go-sqlite3 on write-heavy workloads. For this app's volume (individual user design history), this is irrelevant.

---

## 2. Database Schema

```sql
-- API keys, encrypted at rest
CREATE TABLE api_keys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL DEFAULT 'gemini',       -- key identifier
    provider    TEXT NOT NULL DEFAULT 'google',        -- future multi-provider
    ciphertext  BLOB NOT NULL,                         -- AES-256-GCM encrypted key
    nonce       BLOB NOT NULL,                         -- GCM nonce (12 bytes)
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_api_keys_name ON api_keys(name);

-- Design history (replaces localStorage svg_designer_history_v1)
CREATE TABLE designs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    prompt            TEXT NOT NULL,
    style             TEXT NOT NULL DEFAULT 'None',     -- ArtStyle enum value
    model             TEXT NOT NULL,                     -- 'gemini-3-flash-preview' etc.
    svg_content       TEXT NOT NULL,                     -- Full SVG markup
    layers_enabled    INTEGER NOT NULL DEFAULT 0,        -- boolean
    animation_enabled INTEGER NOT NULL DEFAULT 0,        -- boolean
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_designs_created_at ON designs(created_at DESC);

-- Optional: user preferences (currently lost on reload)
CREATE TABLE preferences (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

### Migration Strategy

SQL migrations embedded via `embed.FS`:

```go
//go:embed migrations/*.sql
var migrationsFS embed.FS
```

Run on startup — simple version-tracked sequential migrations (no heavy framework needed).

---

## 3. API Key Encryption

### Approach: AES-256-GCM with a Server-Side Master Key

```
Master Key (32 bytes) ──► AES-256-GCM encrypt ──► ciphertext + nonce stored in SQLite
                       ◄── AES-256-GCM decrypt ◄── retrieved from SQLite on API call
```

**Master key source (ordered by preference):**

1. **Environment variable**: `SVG_DESIGNER_MASTER_KEY` (hex-encoded 32 bytes)
2. **Key file**: `./master.key` (gitignored, generated on first run if missing)
3. **Auto-generated**: If neither exists, generate a random 32-byte key, write to `./master.key`, and warn the user

**Go implementation sketch:**

```go
package crypto

import (
    "crypto/aes"
    "crypto/cipher"
    "crypto/rand"
    "encoding/hex"
    "errors"
    "io"
    "os"
)

func LoadMasterKey() ([]byte, error) {
    // 1. Try env var
    if keyHex := os.Getenv("SVG_DESIGNER_MASTER_KEY"); keyHex != "" {
        return hex.DecodeString(keyHex)
    }
    // 2. Try key file
    if data, err := os.ReadFile("master.key"); err == nil {
        return hex.DecodeString(string(data))
    }
    // 3. Generate new key
    key := make([]byte, 32)
    if _, err := io.ReadFull(rand.Reader, key); err != nil {
        return nil, err
    }
    os.WriteFile("master.key", []byte(hex.EncodeToString(key)), 0600)
    return key, nil
}

func Encrypt(plaintext, key []byte) (ciphertext, nonce []byte, err error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, nil, err
    }
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, nil, err
    }
    nonce = make([]byte, gcm.NonceSize())
    if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
        return nil, nil, err
    }
    return gcm.Seal(nil, nonce, plaintext, nil), nonce, nil
}

func Decrypt(ciphertext, nonce, key []byte) ([]byte, error) {
    block, err := aes.NewCipher(key)
    if err != nil {
        return nil, err
    }
    gcm, err := cipher.NewGCM(block)
    if err != nil {
        return nil, err
    }
    return gcm.Open(nil, nonce, ciphertext, nil)
}
```

**Key rotation:** Add a `key_version` column to `api_keys` and an array of master keys in config. Decrypt with the version that encrypted it; re-encrypt on next write with the latest version.

---

## 4. Backend Project Structure

```
backend/
├── cmd/
│   └── server/
│       └── main.go              # Entry point, config loading, server startup
├── internal/
│   ├── config/
│   │   └── config.go            # Env var parsing, defaults
│   ├── crypto/
│   │   └── aes.go               # AES-256-GCM encrypt/decrypt + master key loading
│   ├── database/
│   │   ├── db.go                # SQLite connection, migration runner
│   │   └── migrations/
│   │       └── 001_initial.sql  # Schema creation
│   ├── handler/
│   │   ├── designs.go           # Design CRUD endpoints
│   │   ├── apikeys.go           # API key management endpoints
│   │   ├── gemini.go            # Gemini proxy endpoint
│   │   └── middleware.go        # CORS, logging, rate limiting
│   ├── model/
│   │   ├── design.go            # Design struct + DB methods
│   │   └── apikey.go            # APIKey struct + encrypted storage methods
│   └── gemini/
│       └── client.go            # Server-side Gemini SDK wrapper
├── go.mod
├── go.sum
└── Makefile
```

### Key Dependencies

| Package | Purpose | CGO? |
|---------|---------|------|
| `modernc.org/sqlite` | Pure Go SQLite | No |
| `net/http` (stdlib) | HTTP server | No |
| `crypto/aes`, `crypto/cipher` (stdlib) | AES-256-GCM encryption | No |
| `encoding/json` (stdlib) | JSON serialization | No |
| `github.com/google/generative-ai-go` | Gemini Go SDK | No |
| `google.golang.org/api` | Auth for Gemini SDK | No |

**Router choice:** stdlib `net/http` with Go 1.22+ pattern matching (`GET /api/designs/{id}`). No external router dependency needed.

---

## 5. API Endpoints

### Design History

```
GET    /api/designs              List all designs (newest first, paginated)
GET    /api/designs/{id}         Get single design by ID
POST   /api/designs              Create design (manual save, or auto-save after generation)
DELETE /api/designs/{id}         Delete a design
DELETE /api/designs               Clear all designs
```

**Query parameters for list:**
- `?limit=50&offset=0` — Pagination
- `?style=Icon` — Filter by style
- `?q=sunset` — Search prompts

**Request/Response shapes:**

```json
// POST /api/designs
{
  "prompt": "a sunset over mountains",
  "style": "Gradient",
  "model": "gemini-3-flash-preview",
  "svg_content": "<svg>...</svg>",
  "layers_enabled": true,
  "animation_enabled": false
}

// GET /api/designs
{
  "designs": [
    {
      "id": 1,
      "prompt": "a sunset over mountains",
      "style": "Gradient",
      "model": "gemini-3-flash-preview",
      "svg_content": "<svg>...</svg>",
      "layers_enabled": true,
      "animation_enabled": false,
      "created_at": "2026-03-09T14:30:00Z"
    }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

### API Key Management

```
GET    /api/keys                 List stored keys (names only, no secrets)
POST   /api/keys                 Store a new encrypted API key
PUT    /api/keys/{name}          Update an existing key
DELETE /api/keys/{name}          Delete a key
GET    /api/keys/{name}/verify   Test the key against Gemini API
```

**Request/Response shapes:**

```json
// POST /api/keys
{
  "name": "gemini",
  "provider": "google",
  "api_key": "AIza..."       // plaintext in request; encrypted before storage
}

// GET /api/keys
{
  "keys": [
    { "name": "gemini", "provider": "google", "created_at": "2026-03-09T14:00:00Z" }
  ]
}
// Note: API key values are NEVER returned to the client
```

### Gemini Proxy

```
POST   /api/generate             Generate SVG via Gemini (server-side API call)
POST   /api/enhance              Enhance a prompt via Gemini
POST   /api/session/reset        Reset the server-side Gemini chat session
```

**Request/Response shapes:**

```json
// POST /api/generate
{
  "prompt": "a sunset over mountains with birds",
  "style": "Gradient",
  "model": "gemini-3-flash-preview",
  "enable_layers": true,
  "enable_animation": false
}

// Response
{
  "svg": "<svg viewBox=\"0 0 512 512\">...</svg>",
  "design_id": 7        // auto-saved design ID
}

// POST /api/enhance
{
  "prompt": "sunset mountains"
}

// Response
{
  "enhanced_prompt": "A dramatic sunset over layered mountain silhouettes..."
}
```

---

## 6. Frontend Migration Plan

### Phase 1 — Backend Proxy (API Key Security)

**Goal:** Move the Gemini API key off the client.

1. Backend serves as a proxy for all Gemini API calls
2. Frontend calls `/api/generate` and `/api/enhance` instead of the Gemini SDK directly
3. Remove `@google/genai` from frontend dependencies
4. Remove `GEMINI_API_KEY` from vite.config.ts `define` block
5. Add API key management UI (settings page or modal)

**Frontend changes to `geminiService.ts`:**

```typescript
// Before: Direct Gemini SDK call
const ai = new GoogleGenAI({ apiKey: API_KEY });
const chat = ai.chats.create({ model, config });
const response = await chat.sendMessage({ message: prompt });

// After: Backend proxy call
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt, style, model, enable_layers, enable_animation }),
});
const { svg, design_id } = await response.json();
```

**Vite dev proxy config:**

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': 'http://localhost:8080',
  },
},
```

### Phase 2 — Backend History Storage

**Goal:** Replace localStorage with server-side persistence.

1. History CRUD calls go to `/api/designs` endpoints
2. Remove `localStorage.getItem/setItem` calls from App.tsx
3. Add loading states for async history operations
4. Keep the same `HistoryItem` UI shape; map from API response

**Migration for existing users:** On first load, if localStorage has `svg_designer_history_v1`, POST each item to `/api/designs` and then clear localStorage.

### Phase 3 — Multi-User (Future/Optional)

**Goal:** Per-user design libraries.

1. Add a `users` table with auth (passkey, OAuth, or simple password)
2. Add `user_id` foreign key to `designs` and `api_keys`
3. Session cookies or JWT tokens
4. This phase is out of scope for the initial backend — note as future work

---

## 7. Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8080` | HTTP server port |
| `DATABASE_PATH` | No | `./svg_designer.db` | SQLite database file path |
| `SVG_DESIGNER_MASTER_KEY` | No | Auto-generated | Hex-encoded 32-byte AES master key |
| `GEMINI_API_KEY` | No | — | Initial Gemini API key (stored encrypted on first run) |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed CORS origins (comma-separated) |
| `LOG_LEVEL` | No | `info` | Logging verbosity |

### Config Loading Priority

1. Environment variables
2. `.env` file in working directory (loaded via simple key=value parser, no external dep)
3. Hardcoded defaults

---

## 8. Server Startup Flow

```
main.go
  │
  ├─ Load config from env/file
  ├─ Load or generate master key
  ├─ Open SQLite database (WAL mode)
  ├─ Run migrations
  ├─ If GEMINI_API_KEY env is set and no key in DB → encrypt and store it
  ├─ Initialize Gemini client (decrypt key from DB)
  ├─ Register HTTP routes
  ├─ Start HTTP server
  └─ Graceful shutdown on SIGINT/SIGTERM
```

---

## 9. Development Workflow

### Running Backend + Frontend Together

### Windows Quick Start

```bat
scripts\start-dev.bat
```

This launches both the Go backend (:8080) and Vite frontend (:3000) in separate terminal windows. It checks for Go and Node prerequisites and installs dependencies if needed.

### Manual Start

```bash
# Terminal 1: Go backend
cd backend
go run ./cmd/server

# Terminal 2: Vite frontend (proxies /api → :8080)
npm run dev
```

### Makefile Targets

```makefile
.PHONY: build run test clean

build:
	cd backend && go build -o ../bin/svg-designer-server ./cmd/server

run:
	cd backend && go run ./cmd/server

test:
	cd backend && go test ./...

clean:
	rm -rf bin/ backend/svg_designer.db
```

### Production Build

```bash
# Build Go binary
cd backend && CGO_ENABLED=0 go build -o ../bin/svg-designer-server ./cmd/server

# Build frontend
npm run build

# Serve: Go binary serves static files from dist/ + API routes
```

**Single binary option:** Embed the Vite `dist/` output into the Go binary via `embed.FS` for single-artifact deployment.

---

## 10. Security Considerations

| Concern | Mitigation |
|---------|-----------|
| API key exposure in client bundle | Eliminated — keys stored server-side, encrypted at rest |
| API key at rest in SQLite | AES-256-GCM encryption with server master key |
| Master key management | Env var or auto-generated file with `0600` permissions |
| CORS | Strict origin whitelist, configurable |
| Input validation | Validate prompt length, style enum, model enum on server |
| Rate limiting | Per-IP rate limit on `/api/generate` and `/api/enhance` |
| SQL injection | Parameterized queries only (standard `database/sql` interface) |
| SVG content | Server stores SVG as-is; frontend already sanitizes for rendering |

---

## 11. Testing Strategy

```
backend/
├── internal/
│   ├── crypto/
│   │   └── aes_test.go          # Encrypt/decrypt round-trip, bad key, bad nonce
│   ├── database/
│   │   └── db_test.go           # Migration, CRUD operations, in-memory SQLite
│   ├── handler/
│   │   ├── designs_test.go      # HTTP handler tests with httptest
│   │   ├── apikeys_test.go      # Key storage, no-plaintext-in-response
│   │   └── gemini_test.go       # Mock Gemini client, proxy behavior
│   └── model/
│       ├── design_test.go       # Model serialization, validation
│       └── apikey_test.go       # Encryption integration
```

- Use `testing` stdlib + `httptest` for HTTP handlers
- In-memory SQLite (`:memory:`) for database tests — fast, no disk I/O
- Mock Gemini responses for proxy tests

---

## 12. Implementation Order

| Step | Scope | Status |
|------|-------|--------|
| 1 | Project scaffolding: `go mod init`, directory structure, Makefile | ✅ Done |
| 2 | SQLite setup: connection, migrations, WAL mode | ✅ Done |
| 3 | Crypto module: AES-256-GCM encrypt/decrypt + master key loading | ✅ Done |
| 4 | API key model + handlers: store/retrieve/delete encrypted keys | ✅ Done |
| 5 | Design model + handlers: CRUD, pagination, search | ✅ Done |
| 6 | Gemini proxy: server-side SDK calls, session management | ✅ Done |
| 7 | Middleware: CORS, logging | ✅ Done |
| 8 | Main server entry point: route wiring, graceful shutdown | ✅ Done |
| 9 | Build verification: `go build` passes with zero errors | ✅ Done |
| 10 | Frontend migration Phase 1: proxy Gemini calls through backend | ✅ Done |
| 11 | Frontend migration Phase 2: replace localStorage with API calls | ✅ Done |
| 12 | Vite proxy config + dev workflow | ✅ Done |
| 13 | Production build: embed frontend in Go binary | ✅ Done |
| 14 | Tests: crypto, database, models, handlers, rate limiter (22 tests) | ✅ Done |
| 15 | Rate limiting middleware | ✅ Done |

---

## 13. Open Questions

1. **Authentication:** Should the initial version support multiple users, or is single-user (local machine) sufficient?
2. **Session persistence:** Should Gemini chat sessions survive server restarts? (Would require storing conversation history in DB and replaying on session creation.)
3. **SVG storage optimization:** Store SVGs as separate files on disk with DB references, or keep inline in SQLite? (SQLite handles text BLOBs well up to ~100KB; most SVGs are under 50KB.)
4. **Static file serving:** Should the Go server serve the frontend in production, or use a separate web server / CDN?
5. **Docker:** Should we include a Dockerfile for containerized deployment?
