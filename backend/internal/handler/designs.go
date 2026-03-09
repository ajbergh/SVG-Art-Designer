package handler

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/ajbergh/svg-art-designer/backend/internal/model"
)

// DesignHandler handles design CRUD endpoints.
type DesignHandler struct {
	store *model.DesignStore
}

// NewDesignHandler creates a new DesignHandler.
func NewDesignHandler(store *model.DesignStore) *DesignHandler {
	return &DesignHandler{store: store}
}

// List returns a paginated list of designs.
// GET /api/designs?limit=50&offset=0&style=Icon&q=sunset
func (h *DesignHandler) List(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}
	style := r.URL.Query().Get("style")
	query := r.URL.Query().Get("q")

	list, err := h.store.List(limit, offset, style, query)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list designs")
		return
	}

	writeJSON(w, http.StatusOK, list)
}

// GetByID returns a single design.
// GET /api/designs/{id}
func (h *DesignHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid design ID")
		return
	}

	design, err := h.store.GetByID(id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "design not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get design")
		return
	}

	writeJSON(w, http.StatusOK, design)
}

// createDesignRequest is the request body for creating a design.
type createDesignRequest struct {
	Prompt           string `json:"prompt"`
	Style            string `json:"style"`
	Model            string `json:"model"`
	SVGContent       string `json:"svg_content"`
	LayersEnabled    bool   `json:"layers_enabled"`
	AnimationEnabled bool   `json:"animation_enabled"`
}

// Create inserts a new design.
// POST /api/designs
func (h *DesignHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req createDesignRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Prompt == "" || req.SVGContent == "" {
		writeError(w, http.StatusBadRequest, "prompt and svg_content are required")
		return
	}

	design := &model.Design{
		Prompt:           req.Prompt,
		Style:            req.Style,
		Model:            req.Model,
		SVGContent:       req.SVGContent,
		LayersEnabled:    req.LayersEnabled,
		AnimationEnabled: req.AnimationEnabled,
	}

	id, err := h.store.Create(design)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create design")
		return
	}

	saved, err := h.store.GetByID(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to retrieve created design")
		return
	}

	writeJSON(w, http.StatusCreated, saved)
}

// Delete removes a single design.
// DELETE /api/designs/{id}
func (h *DesignHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid design ID")
		return
	}

	if err := h.store.Delete(id); errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "design not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete design")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// DeleteAll removes all designs.
// DELETE /api/designs
func (h *DesignHandler) DeleteAll(w http.ResponseWriter, r *http.Request) {
	if err := h.store.DeleteAll(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to clear designs")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
