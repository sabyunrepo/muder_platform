package seo

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/rs/zerolog"
)

func newTestRouter() http.Handler {
	logger := zerolog.Nop()
	h := NewHandler("https://mmp.example.com", logger)

	r := chi.NewRouter()
	h.RegisterRoutes(r)
	return r
}

func TestThemePage(t *testing.T) {
	router := newTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/themes/midnight-mansion", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.StatusCode)
	}

	body, _ := io.ReadAll(res.Body)
	html := string(body)

	checks := []string{
		`<title>자정의 저택 — Murder Mystery Platform</title>`,
		`og:title`,
		`og:description`,
		`og:image`,
		`twitter:card`,
		`application/ld+json`,
		`schema.org`,
		`"Game"`,
		`4-8명`,
		`60-90분`,
		`중급`,
		`#공포`,
		`#저택`,
	}

	for _, check := range checks {
		if !strings.Contains(html, check) {
			t.Errorf("theme page missing: %s", check)
		}
	}
}

func TestThemePageNotFound(t *testing.T) {
	router := newTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/themes/nonexistent", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rec.Code)
	}
}

func TestPrivacyPage(t *testing.T) {
	router := newTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/privacy", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.StatusCode)
	}

	body, _ := io.ReadAll(res.Body)
	html := string(body)

	checks := []string{
		`<title>개인정보처리방침 — Murder Mystery Platform</title>`,
		`개인정보의 수집`,
		`privacy@mmp.example.com`,
		`canonical`,
	}

	for _, check := range checks {
		if !strings.Contains(html, check) {
			t.Errorf("privacy page missing: %s", check)
		}
	}
}

func TestTermsPage(t *testing.T) {
	router := newTestRouter()

	req := httptest.NewRequest(http.MethodGet, "/terms", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	res := rec.Result()
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", res.StatusCode)
	}

	body, _ := io.ReadAll(res.Body)
	html := string(body)

	checks := []string{
		`<title>이용약관 — Murder Mystery Platform</title>`,
		`제1조`,
		`support@mmp.example.com`,
		`canonical`,
	}

	for _, check := range checks {
		if !strings.Contains(html, check) {
			t.Errorf("terms page missing: %s", check)
		}
	}
}
