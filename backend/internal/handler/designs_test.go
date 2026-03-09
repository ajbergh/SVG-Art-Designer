package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/ajbergh/svg-art-designer/backend/internal/database"
	"github.com/ajbergh/svg-art-designer/backend/internal/model"
)

// helper to create a temporary test database for handler tests.
func testSetup(t *testing.T) (*model.DesignStore, *DesignHandler) {
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

	store := model.NewDesignStore(db.DB)
	handler := NewDesignHandler(store)
	return store, handler
}

func TestDesignHandlerCreate(t *testing.T) {
	store, h := testSetup(t)
	_ = store

	body := `{"prompt":"sunset","style":"Flat","model":"gemini-2.0-flash","svg_content":"<svg viewBox=\"0 0 100 100\"><rect/></svg>"}`
	req := httptest.NewRequest(http.MethodPost, "/api/designs", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.Create(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusCreated, w.Body.String())
	}

	var resp model.Design
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.ID < 1 {
		t.Error("expected positive ID")
	}
	if resp.Prompt != "sunset" {
		t.Errorf("Prompt = %q, want %q", resp.Prompt, "sunset")
	}
}

func TestDesignHandlerCreateValidation(t *testing.T) {
	_, h := testSetup(t)

	// Missing prompt.
	body := `{"svg_content":"<svg/>"}`
	req := httptest.NewRequest(http.MethodPost, "/api/designs", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	h.Create(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("missing prompt: status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	// Missing svg_content.
	body = `{"prompt":"test"}`
	req = httptest.NewRequest(http.MethodPost, "/api/designs", bytes.NewBufferString(body))
	w = httptest.NewRecorder()
	h.Create(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("missing svg: status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestDesignHandlerList(t *testing.T) {
	store, h := testSetup(t)

	// Insert test data.
	for i := 0; i < 3; i++ {
		store.Create(&model.Design{
			Prompt: "test " + strconv.Itoa(i), Model: "m", SVGContent: "<svg/>",
		})
	}

	req := httptest.NewRequest(http.MethodGet, "/api/designs?limit=2", nil)
	w := httptest.NewRecorder()
	h.List(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var resp model.DesignList
	json.NewDecoder(w.Body).Decode(&resp)
	if resp.Total != 3 {
		t.Errorf("Total = %d, want 3", resp.Total)
	}
	if len(resp.Designs) != 2 {
		t.Errorf("len = %d, want 2", len(resp.Designs))
	}
}

func TestDesignHandlerDeleteAll(t *testing.T) {
	store, h := testSetup(t)

	store.Create(&model.Design{Prompt: "x", Model: "m", SVGContent: "<svg/>"})

	req := httptest.NewRequest(http.MethodDelete, "/api/designs", nil)
	w := httptest.NewRecorder()
	h.DeleteAll(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNoContent)
	}
}
