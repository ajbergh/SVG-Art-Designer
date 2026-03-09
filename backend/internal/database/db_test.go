package database

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenAndMigrate(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "test.db")

	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	if err := db.Migrate(); err != nil {
		t.Fatalf("Migrate failed: %v", err)
	}

	// Verify tables exist.
	tables := []string{"api_keys", "designs", "preferences", "schema_migrations"}
	for _, tbl := range tables {
		var name string
		err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", tbl).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", tbl, err)
		}
	}

	// Running migrate again should be idempotent.
	if err := db.Migrate(); err != nil {
		t.Fatalf("second Migrate failed: %v", err)
	}
}

func TestOpenCreatesDirIfNeeded(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "nested", "dir")
	dbPath := filepath.Join(dir, "test.db")

	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	if _, err := os.Stat(dir); os.IsNotExist(err) {
		t.Error("directory was not created")
	}
}

func TestWALMode(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "wal.db")

	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Open failed: %v", err)
	}
	defer db.Close()

	var mode string
	if err := db.QueryRow("PRAGMA journal_mode").Scan(&mode); err != nil {
		t.Fatalf("PRAGMA journal_mode failed: %v", err)
	}
	if mode != "wal" {
		t.Errorf("journal_mode = %q, want %q", mode, "wal")
	}
}
