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
//
// Phase 18.8 follow-up (#2 oracle defense): 에러 detail 에 theme 의 [Min, Max]
// 범위를 직접 노출하지 않는다. 비공개/REVIEW_PENDING theme ID 를 추측한
// 공격자에게 인원 메타데이터를 제공할 수 있어, 일반화된 메시지만 반환한다.
// 정확한 값은 caller 가 zerolog 구조 로그로 남긴다.
func resolveMaxPlayers(theme db.Theme, reqMax *int32) (int32, bool, error) {
	if reqMax == nil {
		return theme.MaxPlayers, true, nil
	}
	v := *reqMax
	if v < theme.MinPlayers || v > theme.MaxPlayers {
		return 0, false, apperror.New(
			apperror.ErrValidation,
			http.StatusBadRequest,
			fmt.Sprintf("max_players %d is not allowed for this theme", v),
		)
	}
	return v, false, nil
}
