package server

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/mmp-platform/server/internal/template"
)

// TestTemplateHandler exercises the three HTTP endpoints exposed by
// TemplateHandler using the embedded preset templates.
func TestTemplateHandler(t *testing.T) {
	loader := template.NewLoader()
	handler := NewTemplateHandler(loader)

	// Peek at available templates via the loader so table cases stay in sync
	// with whatever presets ship with the binary.
	metas, err := loader.List()
	if err != nil {
		t.Fatalf("loader.List: %v", err)
	}
	if len(metas) == 0 {
		t.Skip("no preset templates embedded; skipping handler tests")
	}
	sampleID := metas[0].ID

	tests := []struct {
		name       string
		method     string
		path       string
		route      string
		register   func(r chi.Router)
		wantStatus int
		verify     func(t *testing.T, body []byte)
	}{
		{
			name:   "list templates returns json array",
			method: http.MethodGet,
			path:   "/templates",
			register: func(r chi.Router) {
				r.Get("/templates", handler.ListTemplates)
			},
			wantStatus: http.StatusOK,
			verify: func(t *testing.T, body []byte) {
				var out []template.TemplateMeta
				if err := json.Unmarshal(body, &out); err != nil {
					t.Fatalf("list decode: %v; body=%s", err, body)
				}
				if len(out) == 0 {
					t.Fatalf("list returned empty array")
				}
			},
		},
		{
			name:   "get existing template",
			method: http.MethodGet,
			path:   "/templates/" + sampleID,
			register: func(r chi.Router) {
				r.Get("/templates/{id}", handler.GetTemplate)
			},
			wantStatus: http.StatusOK,
			verify: func(t *testing.T, body []byte) {
				var tmpl template.Template
				if err := json.Unmarshal(body, &tmpl); err != nil {
					t.Fatalf("get decode: %v", err)
				}
				if tmpl.ID != sampleID {
					t.Fatalf("got id=%q want %q", tmpl.ID, sampleID)
				}
			},
		},
		{
			name:   "get missing template returns 404",
			method: http.MethodGet,
			path:   "/templates/__does_not_exist__",
			register: func(r chi.Router) {
				r.Get("/templates/{id}", handler.GetTemplate)
			},
			wantStatus: http.StatusNotFound,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			r := chi.NewRouter()
			tc.register(r)

			req := httptest.NewRequest(tc.method, tc.path, nil)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status=%d want=%d body=%s", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if tc.verify != nil {
				tc.verify(t, rec.Body.Bytes())
			}
		})
	}
}
