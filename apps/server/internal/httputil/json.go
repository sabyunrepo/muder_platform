package httputil

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/go-playground/validator/v10"
	"github.com/mmp-platform/server/internal/apperror"
)

var validate = validator.New()

// maxBodySize is the maximum allowed request body size (1 MB).
const maxBodySize = 1 << 20

// WriteJSON writes a JSON response with the given status code.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("httputil.WriteJSON: encode error: %v", err)
	}
}

// ReadJSON reads a JSON request body into dst and validates it.
// The body is limited to 1 MB to prevent DoS attacks.
func ReadJSON(r *http.Request, dst any) error {
	if r.Body == nil {
		return apperror.BadRequest("request body is required")
	}
	r.Body = http.MaxBytesReader(nil, r.Body, maxBodySize)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		return apperror.BadRequest("invalid JSON: " + err.Error())
	}
	if err := validate.Struct(dst); err != nil {
		return apperror.New(apperror.ErrValidation, http.StatusBadRequest, err.Error())
	}
	return nil
}
