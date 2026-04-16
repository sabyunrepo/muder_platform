package editor

import (
	"context"
	"fmt"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
)

// ValidateTheme runs cross-entity consistency checks for a theme (characters,
// maps, locations, clues, culprit). Owned by the validation layer rather than
// the clue CRUD layer because the assertions span multiple aggregates.
func (s *service) ValidateTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ValidationResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}

	charCount, err := s.q.CountThemeCharacters(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count characters")
		return nil, apperror.Internal("failed to validate theme")
	}
	mapCount, err := s.q.CountMapsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count maps")
		return nil, apperror.Internal("failed to validate theme")
	}
	clueCount, err := s.q.CountCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count clues")
		return nil, apperror.Internal("failed to validate theme")
	}

	// count locations across all maps
	locs, err := s.q.ListLocationsByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list locations")
		return nil, apperror.Internal("failed to validate theme")
	}
	locCount := int64(len(locs))

	var errs []string
	if charCount < int64(theme.MinPlayers) {
		errs = append(errs, fmt.Sprintf("최소 %d명의 캐릭터가 필요합니다 (현재 %d명)", theme.MinPlayers, charCount))
	}
	if mapCount == 0 {
		errs = append(errs, "최소 1개의 맵이 필요합니다")
	}

	// check culprit character exists
	chars, err := s.q.GetThemeCharacters(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to get characters")
		return nil, apperror.Internal("failed to validate theme")
	}
	hasCulprit := false
	for _, c := range chars {
		if c.IsCulprit {
			hasCulprit = true
			break
		}
	}
	if !hasCulprit {
		errs = append(errs, "범인 캐릭터가 지정되어야 합니다")
	}

	return &ValidationResponse{
		Valid:  len(errs) == 0,
		Errors: errs,
		Stats: ValidationStats{
			Characters: int(charCount),
			Maps:       int(mapCount),
			Locations:  int(locCount),
			Clues:      int(clueCount),
		},
	}, nil
}
