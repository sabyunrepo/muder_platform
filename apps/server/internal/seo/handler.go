package seo

import (
	"embed"
	"encoding/json"
	"html/template"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
)

//go:embed templates/*.html
var templateFS embed.FS

// ThemePageData holds data for rendering the theme detail SEO page.
type ThemePageData struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Slug        string   `json:"slug"`
	ImageURL    string   `json:"imageURL"`
	Players     string   `json:"players"`
	Duration    string   `json:"duration"`
	Difficulty  string   `json:"difficulty"`
	Tags        []string `json:"tags"`
	BaseURL     string   `json:"baseURL"`
}

// JSONLD returns the JSON-LD structured data for the theme page.
func (d ThemePageData) JSONLD() template.JS {
	ld := map[string]any{
		"@context":    "https://schema.org",
		"@type":       "Game",
		"name":        d.Title,
		"description": d.Description,
		"url":         d.BaseURL + "/themes/" + d.Slug,
		"genre":       "Murder Mystery",
		"numberOfPlayers": map[string]any{
			"@type": "QuantitativeValue",
			"value": d.Players,
		},
	}
	if d.ImageURL != "" {
		ld["image"] = d.ImageURL
	}
	if len(d.Tags) > 0 {
		ld["keywords"] = d.Tags
	}

	b, _ := json.MarshalIndent(ld, "    ", "  ")
	return template.JS(b)
}

// CanonicalURL returns the full canonical URL for the theme page.
func (d ThemePageData) CanonicalURL() string {
	return d.BaseURL + "/themes/" + d.Slug
}

// StaticPageData holds data for rendering static pages (privacy, terms).
type StaticPageData struct {
	Title   string
	BaseURL string
}

// Handler serves server-rendered SEO pages using html/template.
type Handler struct {
	theme   *template.Template
	privacy *template.Template
	terms   *template.Template
	logger  zerolog.Logger
	baseURL string
}

// NewHandler creates a new SEO handler, parsing embedded templates.
// Each page template is parsed together with layout.html so that
// the "head" and "content" block names do not collide across pages.
// baseURL should be the public-facing origin (e.g. "https://mmp.example.com").
func NewHandler(baseURL string, logger zerolog.Logger) *Handler {
	mustParsePage := func(page string) *template.Template {
		return template.Must(
			template.ParseFS(templateFS, "templates/layout.html", "templates/"+page),
		)
	}

	return &Handler{
		theme:   mustParsePage("theme.html"),
		privacy: mustParsePage("privacy.html"),
		terms:   mustParsePage("terms.html"),
		logger:  logger.With().Str("component", "seo").Logger(),
		baseURL: baseURL,
	}
}

// RegisterRoutes mounts SEO page routes onto the given chi router.
func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Get("/themes/{slug}", h.ThemePage)
	r.Get("/privacy", h.PrivacyPage)
	r.Get("/terms", h.TermsPage)
}

// ThemePage renders the theme detail SEO page.
// In production, theme data would come from a database; here we use
// a placeholder lookup that can be replaced with a real repository.
func (h *Handler) ThemePage(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	data := h.lookupTheme(slug)
	if data == nil {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	if err := h.theme.ExecuteTemplate(w, "layout", data); err != nil {
		h.logger.Error().Err(err).Str("slug", slug).Msg("failed to render theme page")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// PrivacyPage renders the privacy policy page.
func (h *Handler) PrivacyPage(w http.ResponseWriter, r *http.Request) {
	data := StaticPageData{
		Title:   "개인정보처리방침",
		BaseURL: h.baseURL,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	if err := h.privacy.ExecuteTemplate(w, "layout", data); err != nil {
		h.logger.Error().Err(err).Msg("failed to render privacy page")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// TermsPage renders the terms of service page.
func (h *Handler) TermsPage(w http.ResponseWriter, r *http.Request) {
	data := StaticPageData{
		Title:   "이용약관",
		BaseURL: h.baseURL,
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")

	if err := h.terms.ExecuteTemplate(w, "layout", data); err != nil {
		h.logger.Error().Err(err).Msg("failed to render terms page")
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// lookupTheme returns theme data for the given slug.
// TODO: Replace with real repository/service lookup.
func (h *Handler) lookupTheme(slug string) *ThemePageData {
	// Placeholder themes for development. In production, this will query
	// the theme repository via the service layer.
	themes := map[string]*ThemePageData{
		"midnight-mansion": {
			Title:       "자정의 저택",
			Description: "어둠이 내린 고풍스러운 저택에서 벌어진 미스터리한 살인 사건. 숨겨진 단서를 찾아 범인을 밝혀내세요.",
			Slug:        "midnight-mansion",
			ImageURL:    "/static/images/themes/midnight-mansion.jpg",
			Players:     "4-8명",
			Duration:    "60-90분",
			Difficulty:  "중급",
			Tags:        []string{"공포", "저택", "클래식"},
			BaseURL:     h.baseURL,
		},
		"last-train": {
			Title:       "마지막 열차",
			Description: "심야 열차 안에서 발생한 의문의 사건. 승객들 사이에 숨어있는 범인을 찾아야 합니다.",
			Slug:        "last-train",
			ImageURL:    "/static/images/themes/last-train.jpg",
			Players:     "5-10명",
			Duration:    "90-120분",
			Difficulty:  "상급",
			Tags:        []string{"추리", "밀실", "서스펜스"},
			BaseURL:     h.baseURL,
		},
	}

	return themes[slug]
}
