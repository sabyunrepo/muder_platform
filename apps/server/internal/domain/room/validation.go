package room

import (
	"fmt"
	"net/http"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// resolveMaxPlayers returns the effective MaxPlayers for a new room, using the
// theme's MaxPlayers when reqMax is nil (fallback). When reqMax is non-nil it
// must lie within [theme.MinPlayers, theme.MaxPlayers], otherwise a
// VALIDATION_ERROR AppError is returned. The fallback bool signals whether the
// theme default was used (used by the caller for structured logging).
//
// This helper is split out of service.go to keep that file under the 500-line
// hard limit and to enable pure-function table-driven tests in service_test.go.
func resolveMaxPlayers(theme db.Theme, reqMax *int32) (int32, bool, error) {
	if reqMax == nil {
		return theme.MaxPlayers, true, nil
	}
	v := *reqMax
	if v < theme.MinPlayers || v > theme.MaxPlayers {
		return 0, false, apperror.New(
			apperror.ErrValidation,
			http.StatusBadRequest,
			fmt.Sprintf(
				"max_players %d is outside theme range [%d, %d]",
				v, theme.MinPlayers, theme.MaxPlayers,
			),
		)
	}
	return v, false, nil
}
