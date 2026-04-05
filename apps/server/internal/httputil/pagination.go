package httputil

import (
	"net/http"
	"strconv"
)

// Pagination holds parsed pagination parameters.
type Pagination struct {
	Limit  int32
	Offset int32
}

// ParsePagination extracts limit/offset from query params with bounds.
func ParsePagination(r *http.Request, defaultLimit, maxLimit int32) Pagination {
	limit := defaultLimit
	offset := int32(0)
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = int32(min(n, int(maxLimit)))
		}
	}
	if v := r.URL.Query().Get("offset"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n >= 0 {
			offset = int32(n)
		}
	}
	return Pagination{Limit: limit, Offset: offset}
}
