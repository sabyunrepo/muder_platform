package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/mmp-platform/server/internal/template"
)

// TemplateHandler serves template metadata and schemas via HTTP.
type TemplateHandler struct {
	loader *template.Loader
}

// NewTemplateHandler creates a new handler backed by the given loader.
func NewTemplateHandler(loader *template.Loader) *TemplateHandler {
	return &TemplateHandler{loader: loader}
}

// ListTemplates returns metadata for all available templates.
// GET /api/templates
func (h *TemplateHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	metas, err := h.loader.List()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, http.StatusOK, metas)
}

// GetTemplate returns a full template by ID.
// GET /api/templates/{id}
func (h *TemplateHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tmpl, err := h.loader.Load(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	writeJSON(w, http.StatusOK, tmpl)
}

// GetTemplateSchema returns the merged config schema for a template.
// GET /api/templates/{id}/schema
func (h *TemplateHandler) GetTemplateSchema(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tmpl, err := h.loader.Load(id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	schema, err := template.MergeSchemasJSON(tmpl)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(schema)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
