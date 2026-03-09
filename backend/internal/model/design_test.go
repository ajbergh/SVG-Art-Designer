package model

import (
	"path/filepath"
	"testing"

	"github.com/ajbergh/svg-art-designer/backend/internal/database"
)

// helper to open a temp DB and run migrations.
func testDB(t *testing.T) *database.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if err := db.Migrate(); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func TestDesignCRUD(t *testing.T) {
	db := testDB(t)
	store := NewDesignStore(db.DB)

	// Create
	d := &Design{
		Prompt:           "a sunset over mountains",
		Style:            "Watercolor",
		Model:            "gemini-2.0-flash",
		SVGContent:       `<svg viewBox="0 0 100 100"><circle r="50"/></svg>`,
		LayersEnabled:    true,
		AnimationEnabled: false,
	}
	id, err := store.Create(d)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if id < 1 {
		t.Fatalf("expected positive ID, got %d", id)
	}

	// GetByID
	got, err := store.GetByID(id)
	if err != nil {
		t.Fatalf("GetByID: %v", err)
	}
	if got.Prompt != d.Prompt {
		t.Errorf("Prompt = %q, want %q", got.Prompt, d.Prompt)
	}
	if got.Style != d.Style {
		t.Errorf("Style = %q, want %q", got.Style, d.Style)
	}
	if !got.LayersEnabled {
		t.Error("LayersEnabled should be true")
	}
	if got.AnimationEnabled {
		t.Error("AnimationEnabled should be false")
	}

	// List
	list, err := store.List(10, 0, "", "")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if list.Total != 1 {
		t.Errorf("Total = %d, want 1", list.Total)
	}
	if len(list.Designs) != 1 {
		t.Errorf("len(Designs) = %d, want 1", len(list.Designs))
	}

	// Delete
	if err := store.Delete(id); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	list, _ = store.List(10, 0, "", "")
	if list.Total != 0 {
		t.Errorf("Total after delete = %d, want 0", list.Total)
	}
}

func TestDesignListFilters(t *testing.T) {
	db := testDB(t)
	store := NewDesignStore(db.DB)

	entries := []struct {
		prompt string
		style  string
	}{
		{"sunset mountain", "Watercolor"},
		{"ocean waves", "Flat"},
		{"sunset beach", "Watercolor"},
	}
	for _, e := range entries {
		store.Create(&Design{
			Prompt:     e.prompt,
			Style:      e.style,
			Model:      "gemini-2.0-flash",
			SVGContent: "<svg></svg>",
		})
	}

	// Filter by style.
	list, _ := store.List(10, 0, "Watercolor", "")
	if list.Total != 2 {
		t.Errorf("style filter: Total = %d, want 2", list.Total)
	}

	// Search by prompt keyword.
	list, _ = store.List(10, 0, "", "sunset")
	if list.Total != 2 {
		t.Errorf("query filter: Total = %d, want 2", list.Total)
	}

	// Combined filter.
	list, _ = store.List(10, 0, "Flat", "ocean")
	if list.Total != 1 {
		t.Errorf("combined filter: Total = %d, want 1", list.Total)
	}

	// Pagination.
	list, _ = store.List(1, 0, "", "")
	if len(list.Designs) != 1 || list.Total != 3 {
		t.Errorf("pagination: len=%d, total=%d, want len=1, total=3", len(list.Designs), list.Total)
	}
}

func TestDesignDeleteAll(t *testing.T) {
	db := testDB(t)
	store := NewDesignStore(db.DB)

	for i := 0; i < 3; i++ {
		store.Create(&Design{Prompt: "test", Model: "m", SVGContent: "<svg/>"})
	}

	if err := store.DeleteAll(); err != nil {
		t.Fatalf("DeleteAll: %v", err)
	}

	list, _ := store.List(10, 0, "", "")
	if list.Total != 0 {
		t.Errorf("Total after DeleteAll = %d, want 0", list.Total)
	}
}
