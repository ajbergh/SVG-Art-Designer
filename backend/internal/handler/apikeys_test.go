package handler

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/ajbergh/svg-art-designer/backend/internal/database"
	"github.com/ajbergh/svg-art-designer/backend/internal/model"
)

func testAPIKeySetup(t *testing.T) (*model.APIKeyStore, *APIKeyHandler) {
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

	masterKey := make([]byte, 32)
	rand.Read(masterKey)
	store := model.NewAPIKeyStore(db.DB, masterKey)
	handler := NewAPIKeyHandler(store)
	return store, handler
}

func TestAPIKeyHandlerStore(t *testing.T) {
	_, h := testAPIKeySetup(t)

	body := `{"name":"gemini","provider":"google","api_key":"AIzaSyB_test123"}`
	req := httptest.NewRequest(http.MethodPost, "/api/keys", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	h.Store(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d; body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]string
	json.NewDecoder(w.Body).Decode(&resp)
	if resp["status"] != "stored" {
		t.Errorf("status = %q, want %q", resp["status"], "stored")
	}
}

func TestAPIKeyHandlerStoreValidation(t *testing.T) {
	_, h := testAPIKeySetup(t)

	// Missing api_key.
	body := `{"name":"gemini"}`
	req := httptest.NewRequest(http.MethodPost, "/api/keys", bytes.NewBufferString(body))
	w := httptest.NewRecorder()
	h.Store(w, req)
	if w.Code != http.StatusBadRequest {
		t.Errorf("missing api_key: status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestAPIKeyHandlerList(t *testing.T) {
	store, h := testAPIKeySetup(t)

	store.Store("gemini", "google", "key1")
	store.Store("openai", "openai", "key2")

	req := httptest.NewRequest(http.MethodGet, "/api/keys", nil)
	w := httptest.NewRecorder()
	h.List(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var resp struct {
		Keys []model.APIKey `json:"keys"`
	}
	json.NewDecoder(w.Body).Decode(&resp)
	if len(resp.Keys) != 2 {
		t.Errorf("len(keys) = %d, want 2", len(resp.Keys))
	}

	// Ensure no secrets are leaked in the response.
	raw := w.Body.String()
	if bytes.Contains([]byte(raw), []byte("key1")) || bytes.Contains([]byte(raw), []byte("key2")) {
		t.Error("plaintext API keys should not appear in List response")
	}
}

func TestAPIKeyHandlerDelete(t *testing.T) {
	store, h := testAPIKeySetup(t)

	store.Store("gemini", "google", "testkey")

	// Go 1.22+ PathValue needs the route pattern registered.
	// We'll set up a mux to test path values properly.
	mux := http.NewServeMux()
	mux.HandleFunc("DELETE /api/keys/{name}", h.Delete)

	req := httptest.NewRequest(http.MethodDelete, "/api/keys/gemini", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d; body: %s", w.Code, http.StatusNoContent, w.Body.String())
	}
}
