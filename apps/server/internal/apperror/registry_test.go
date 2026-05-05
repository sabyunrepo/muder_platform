package apperror

import (
	"net/http"
	"os"
	"regexp"
	"testing"
)

func TestLookupDefinition_KnownCode(t *testing.T) {
	defn, ok := LookupDefinition(ErrMediaReferenceInUse)
	if !ok {
		t.Fatal("expected media reference definition")
	}

	if defn.Domain != "media" {
		t.Errorf("Domain = %q, want media", defn.Domain)
	}
	if defn.HTTPStatus != http.StatusConflict {
		t.Errorf("HTTPStatus = %d, want %d", defn.HTTPStatus, http.StatusConflict)
	}
	if defn.UserAction != "review_references" {
		t.Errorf("UserAction = %q, want review_references", defn.UserAction)
	}
	if defn.DefaultKR == "" {
		t.Error("DefaultKR should be set for creator-facing message fallback")
	}
}

func TestAllPublicErrorCodesHaveRegistryDefinition(t *testing.T) {
	codes := errorCodesFromSource(t)
	seen := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		if _, duplicated := seen[code]; duplicated {
			t.Fatalf("duplicate public error code in invariant list: %s", code)
		}
		seen[code] = struct{}{}

		defn, ok := LookupDefinition(code)
		if !ok {
			t.Errorf("missing registry definition for %s", code)
			continue
		}
		if defn.Code != code {
			t.Errorf("%s definition Code = %s", code, defn.Code)
		}
		if defn.Domain == "" {
			t.Errorf("%s definition Domain must be set", code)
		}
		if defn.Layer == "" {
			t.Errorf("%s definition Layer must be set", code)
		}
		if defn.Severity == "" {
			t.Errorf("%s definition Severity must be set", code)
		}
		if defn.HTTPStatus < 400 {
			t.Errorf("%s definition HTTPStatus = %d, want >= 400", code, defn.HTTPStatus)
		}
		if defn.UserAction == "" {
			t.Errorf("%s definition UserAction must be set", code)
		}
		if defn.DefaultKR == "" {
			t.Errorf("%s definition DefaultKR must be set", code)
		}
	}
}

func errorCodesFromSource(t *testing.T) []string {
	t.Helper()

	source, err := os.ReadFile("codes.go")
	if err != nil {
		t.Fatalf("failed to read codes.go: %v", err)
	}

	matches := regexp.MustCompile(`Err[A-Za-z0-9_]+\s*=\s*"([^"]+)"`).FindAllSubmatch(source, -1)
	if len(matches) == 0 {
		t.Fatal("no public error codes found in codes.go")
	}

	codes := make([]string, 0, len(matches))
	for _, match := range matches {
		codes = append(codes, string(match[1]))
	}
	return codes
}

func TestDefinitionForResponse_PreservesOccurrenceStatus(t *testing.T) {
	appErr := New(ErrBadRequest, http.StatusUnprocessableEntity, "domain validation failed")

	defn := definitionForResponse(appErr)

	if defn.HTTPStatus != http.StatusUnprocessableEntity {
		t.Errorf("HTTPStatus = %d, want occurrence status %d", defn.HTTPStatus, http.StatusUnprocessableEntity)
	}
	if defn.Code != ErrBadRequest {
		t.Errorf("Code = %q, want %q", defn.Code, ErrBadRequest)
	}
}

func TestSeverityForStatus(t *testing.T) {
	tests := []struct {
		name   string
		status int
		want   Severity
	}{
		{name: "server", status: http.StatusBadGateway, want: SeverityHigh},
		{name: "unauthorized", status: http.StatusUnauthorized, want: SeverityHigh},
		{name: "forbidden", status: http.StatusForbidden, want: SeverityHigh},
		{name: "client", status: http.StatusBadRequest, want: SeverityMedium},
		{name: "success fallback", status: http.StatusOK, want: SeverityLow},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := severityForStatus(tt.status); got != tt.want {
				t.Errorf("severityForStatus(%d) = %q, want %q", tt.status, got, tt.want)
			}
		})
	}
}

func TestDefaultActionForStatus(t *testing.T) {
	tests := []struct {
		name   string
		status int
		want   string
	}{
		{name: "login", status: http.StatusUnauthorized, want: "login"},
		{name: "access", status: http.StatusForbidden, want: "request_access"},
		{name: "timeout", status: http.StatusRequestTimeout, want: "retry_later"},
		{name: "server", status: http.StatusInternalServerError, want: "retry_later"},
		{name: "client", status: http.StatusBadRequest, want: "fix_input"},
		{name: "success fallback", status: http.StatusOK, want: "none"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := defaultActionForStatus(tt.status); got != tt.want {
				t.Errorf("defaultActionForStatus(%d) = %q, want %q", tt.status, got, tt.want)
			}
		})
	}
}
