package apperror

import (
	"net/http"
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
