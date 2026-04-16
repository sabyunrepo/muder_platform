package editor

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/engine"
)

// --- Characters ---

func (s *service) CreateCharacter(ctx context.Context, creatorID, themeID uuid.UUID, req CreateCharacterRequest) (*CharacterResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	char, err := s.q.CreateThemeCharacter(ctx, db.CreateThemeCharacterParams{
		ThemeID:     themeID,
		Name:        req.Name,
		Description: ptrToText(req.Description),
		ImageUrl:    ptrToText(req.ImageURL),
		IsCulprit:   req.IsCulprit,
		SortOrder:   req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create character")
		return nil, apperror.Internal("failed to create character")
	}
	return toCharacterResponse(char), nil
}

func (s *service) UpdateCharacter(ctx context.Context, creatorID, charID uuid.UUID, req UpdateCharacterRequest) (*CharacterResponse, error) {
	char, err := s.q.GetThemeCharacter(ctx, charID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("character not found")
		}
		s.logger.Error().Err(err).Msg("failed to get character")
		return nil, apperror.Internal("failed to get character")
	}
	if _, err := s.getOwnedTheme(ctx, creatorID, char.ThemeID); err != nil {
		return nil, err
	}

	updated, err := s.q.UpdateThemeCharacter(ctx, db.UpdateThemeCharacterParams{
		ID:          charID,
		Name:        req.Name,
		Description: ptrToText(req.Description),
		ImageUrl:    ptrToText(req.ImageURL),
		IsCulprit:   req.IsCulprit,
		SortOrder:   req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update character")
		return nil, apperror.Internal("failed to update character")
	}
	return toCharacterResponse(updated), nil
}

func (s *service) DeleteCharacter(ctx context.Context, creatorID, charID uuid.UUID) error {
	char, err := s.q.GetThemeCharacter(ctx, charID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.NotFound("character not found")
		}
		s.logger.Error().Err(err).Msg("failed to get character")
		return apperror.Internal("failed to get character")
	}
	if _, err := s.getOwnedTheme(ctx, creatorID, char.ThemeID); err != nil {
		return err
	}

	if err := s.q.DeleteThemeCharacter(ctx, charID); err != nil {
		s.logger.Error().Err(err).Msg("failed to delete character")
		return apperror.Internal("failed to delete character")
	}
	return nil
}

func (s *service) ListCharacters(ctx context.Context, creatorID, themeID uuid.UUID) ([]CharacterResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	chars, err := s.q.GetThemeCharacters(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list characters")
		return nil, apperror.Internal("failed to list characters")
	}
	out := make([]CharacterResponse, len(chars))
	for i, c := range chars {
		out[i] = *toCharacterResponse(c)
	}
	return out, nil
}

func toCharacterResponse(c db.ThemeCharacter) *CharacterResponse {
	return &CharacterResponse{
		ID:          c.ID,
		ThemeID:     c.ThemeID,
		Name:        c.Name,
		Description: textToPtr(c.Description),
		ImageURL:    textToPtr(c.ImageUrl),
		IsCulprit:   c.IsCulprit,
		SortOrder:   c.SortOrder,
	}
}

// --- Module schemas ---

// GetModuleSchemas returns JSON Schema for all registered modules that implement ConfigSchema.
func (s *service) GetModuleSchemas(_ context.Context) (map[string]json.RawMessage, error) {
	names := engine.RegisteredModules()
	schemas := make(map[string]json.RawMessage, len(names))

	for _, name := range names {
		mod, err := engine.CreateModule(name)
		if err != nil {
			s.logger.Warn().Str("module", name).Err(err).Msg("failed to create module for schema collection")
			continue
		}
		cs, ok := mod.(engine.ConfigSchema)
		if !ok {
			continue
		}
		schemas[name] = cs.Schema()
	}

	return schemas, nil
}
