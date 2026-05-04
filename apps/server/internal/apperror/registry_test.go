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
