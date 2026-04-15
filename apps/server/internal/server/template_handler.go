package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog/log"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/template"
)

// TemplateHandler serves template metadata and schemas via HTTP.
//
// NOTE: /templates endpoints are public by design — they serve go:embed'd
// preset JSON shipped with the binary. If user-scoped templates are ever
// added, move these routes into the authed group in main.go.
type TemplateHandler struct {
	loader *template.Loader
}

func NewTemplateHandler(loader *template.Loader) *TemplateHandler {
	return &TemplateHandler{loader: loader}
}

// ListTemplates returns metadata for all available templates.
// GET /api/v1/templates
func (h *TemplateHandler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	metas, err := h.loader.List()
	if err != nil {
		apperror.WriteError(w, r, apperror.Internal("failed to load templates").Wrap(err))
		return
	}
	writeJSON(w, r, http.StatusOK, metas)
}

// GetTemplate returns a full template by ID.
// GET /api/v1/templates/{id}
func (h *TemplateHandler) GetTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tmpl, err := h.loader.Load(id)
	if err != nil {
		apperror.WriteError(w, r, apperror.NotFound("template not found").Wrap(err))
		return
	}
	writeJSON(w, r, http.StatusOK, tmpl)
}

// GetTemplateSchema returns the merged config schema for a template.
// GET /api/v1/templates/{id}/schema
func (h *TemplateHandler) GetTemplateSchema(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tmpl, err := h.loader.Load(id)
	if err != nil {
		apperror.WriteError(w, r, apperror.NotFound("template not found").Wrap(err))
		return
	}

	schema, err := template.MergeSchemasJSON(tmpl)
	if err != nil {
		apperror.WriteError(w, r, apperror.Internal("failed to merge template schema").Wrap(err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if _, werr := w.Write(schema); werr != nil {
		log.Warn().Err(werr).Str("template_id", id).Msg("template schema write failed")
	}
}

func writeJSON(w http.ResponseWriter, r *http.Request, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Warn().Err(err).Str("path", r.URL.Path).Msg("json encode failed")
	}
}
