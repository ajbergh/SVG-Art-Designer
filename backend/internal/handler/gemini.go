package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/ajbergh/svg-art-designer/backend/internal/gemini"
	"github.com/ajbergh/svg-art-designer/backend/internal/model"
)

// GeminiHandler handles Gemini proxy endpoints.
type GeminiHandler struct {
	client      *gemini.Client
	designStore *model.DesignStore
}

// NewGeminiHandler creates a new GeminiHandler.
func NewGeminiHandler(client *gemini.Client, designStore *model.DesignStore) *GeminiHandler {
	return &GeminiHandler{client: client, designStore: designStore}
}

type generateRequest struct {
	Prompt          string `json:"prompt"`
	Style           string `json:"style"`
	Model           string `json:"model"`
	EnableLayers    bool   `json:"enable_layers"`
	EnableAnimation bool   `json:"enable_animation"`
}

type generateResponse struct {
	SVG      string `json:"svg"`
	DesignID int64  `json:"design_id"`
}

// getSessionID extracts the session identifier from the request header.
// Falls back to the client IP if no header is provided.
func getSessionID(r *http.Request) string {
	if id := r.Header.Get("X-Session-ID"); id != "" {
		return id
	}
	return r.RemoteAddr
}

// Generate creates an SVG via Gemini and auto-saves to the database.
// POST /api/generate
func (h *GeminiHandler) Generate(w http.ResponseWriter, r *http.Request) {
	var req generateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "prompt is required")
		return
	}
	if req.Model == "" {
		req.Model = "gemini-2.0-flash"
	}

	sessionID := getSessionID(r)

	// Use an extended timeout for generation — Pro models can take 60s+.
	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	svg, err := h.client.GenerateSVG(ctx, sessionID, req.Prompt, req.Style, req.Model, req.EnableLayers, req.EnableAnimation)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "generation failed: "+err.Error())
		return
	}

	// Auto-save design.
	design := &model.Design{
		Prompt:           req.Prompt,
		Style:            req.Style,
		Model:            req.Model,
		SVGContent:       svg,
		LayersEnabled:    req.EnableLayers,
		AnimationEnabled: req.EnableAnimation,
	}
	designID, err := h.designStore.Create(design)
	if err != nil {
		// Generation succeeded but save failed — still return the SVG.
		writeJSON(w, http.StatusOK, generateResponse{SVG: svg, DesignID: 0})
		return
	}

	writeJSON(w, http.StatusOK, generateResponse{SVG: svg, DesignID: designID})
}

type enhanceRequest struct {
	Prompt string `json:"prompt"`
}

type enhanceResponse struct {
	EnhancedPrompt string `json:"enhanced_prompt"`
}

// Enhance rewrites a prompt using Gemini.
// POST /api/enhance
func (h *GeminiHandler) Enhance(w http.ResponseWriter, r *http.Request) {
	var req enhanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if req.Prompt == "" {
		writeError(w, http.StatusBadRequest, "prompt is required")
		return
	}

	enhanced, err := h.client.EnhancePrompt(r.Context(), req.Prompt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "enhancement failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, enhanceResponse{EnhancedPrompt: enhanced})
}

// ResetSession clears the Gemini chat session for the requesting user.
// POST /api/session/reset
func (h *GeminiHandler) ResetSession(w http.ResponseWriter, r *http.Request) {
	sessionID := getSessionID(r)
	h.client.ResetSession(sessionID)
	writeJSON(w, http.StatusOK, map[string]string{"status": "session reset"})
}
