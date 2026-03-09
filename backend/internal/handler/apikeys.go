package handler

import (
	"encoding/json"
	"net/http"

	"github.com/ajbergh/svg-art-designer/backend/internal/model"
)

// APIKeyHandler handles API key management endpoints.
type APIKeyHandler struct {
	store        *model.APIKeyStore
	onKeyChanged func(name, plaintext string) // optional callback when a key is stored/updated
}

// NewAPIKeyHandler creates a new APIKeyHandler.
func NewAPIKeyHandler(store *model.APIKeyStore) *APIKeyHandler {
	return &APIKeyHandler{store: store}
}

// SetOnKeyChanged registers a callback invoked after a key is stored or updated.
func (h *APIKeyHandler) SetOnKeyChanged(fn func(name, plaintext string)) {
	h.onKeyChanged = fn
}

// List returns metadata for all stored API keys (no secrets).
// GET /api/keys
func (h *APIKeyHandler) List(w http.ResponseWriter, r *http.Request) {
	keys, err := h.store.List()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list api keys")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"keys": keys})
}

// storeKeyRequest is the request body for storing an API key.
type storeKeyRequest struct {
	Name     string `json:"name"`
	Provider string `json:"provider"`
	APIKey   string `json:"api_key"`
}

// Store encrypts and saves (or updates) an API key.
// POST /api/keys
func (h *APIKeyHandler) Store(w http.ResponseWriter, r *http.Request) {
	var req storeKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Name == "" {
		req.Name = "gemini"
	}
	if req.Provider == "" {
		req.Provider = "google"
	}
	if req.APIKey == "" {
		writeError(w, http.StatusBadRequest, "api_key is required")
		return
	}

	if err := h.store.Store(req.Name, req.Provider, req.APIKey); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store api key")
		return
	}

	if h.onKeyChanged != nil {
		h.onKeyChanged(req.Name, req.APIKey)
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "stored", "name": req.Name})
}

// Update replaces an existing API key.
// PUT /api/keys/{name}
func (h *APIKeyHandler) Update(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "key name is required")
		return
	}

	var req storeKeyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.APIKey == "" {
		writeError(w, http.StatusBadRequest, "api_key is required")
		return
	}

	exists, err := h.store.Exists(name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to check api key")
		return
	}
	if !exists {
		writeError(w, http.StatusNotFound, "api key not found")
		return
	}

	provider := req.Provider
	if provider == "" {
		provider = "google"
	}

	if err := h.store.Store(name, provider, req.APIKey); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update api key")
		return
	}

	if h.onKeyChanged != nil {
		h.onKeyChanged(name, req.APIKey)
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated", "name": name})
}

// Delete removes an API key by name.
// DELETE /api/keys/{name}
func (h *APIKeyHandler) Delete(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "key name is required")
		return
	}

	if err := h.store.Delete(name); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete api key")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
