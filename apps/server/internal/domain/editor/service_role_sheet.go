package editor

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

const maxRoleSheetBodyBytes = 50000

func roleSheetContentKey(characterID uuid.UUID) string {
	return fmt.Sprintf("role_sheet:%s", characterID.String())
}

func (s *service) GetCharacterRoleSheet(ctx context.Context, creatorID, charID uuid.UUID) (*RoleSheetResponse, error) {
	char, err := s.getOwnedCharacter(ctx, creatorID, charID)
	if err != nil {
		return nil, err
	}

	content, err := s.q.GetContent(ctx, db.GetContentParams{ThemeID: char.ThemeID, Key: roleSheetContentKey(charID)})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return emptyRoleSheetResponse(char), nil
		}
		s.logger.Error().Err(err).Msg("failed to get character role sheet")
		return nil, apperror.Internal("failed to get character role sheet")
	}

	resp := roleSheetResponseFromContent(char, content)
	return &resp, nil
}

func (s *service) UpsertCharacterRoleSheet(ctx context.Context, creatorID, charID uuid.UUID, req UpsertRoleSheetRequest) (*RoleSheetResponse, error) {
	if req.Format != RoleSheetFormatMarkdown {
		return nil, apperror.BadRequest("unsupported role sheet format")
	}
	if req.Markdown == nil {
		return nil, apperror.BadRequest("markdown role sheet body is required")
	}
	if len(req.Markdown.Body) > maxRoleSheetBodyBytes {
		return nil, apperror.BadRequest("role sheet body is too long")
	}

	char, err := s.getOwnedCharacter(ctx, creatorID, charID)
	if err != nil {
		return nil, err
	}

	content, err := s.q.UpsertContent(ctx, db.UpsertContentParams{
		ThemeID: char.ThemeID,
		Key:     roleSheetContentKey(charID),
		Body:    req.Markdown.Body,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to upsert character role sheet")
		return nil, apperror.Internal("failed to upsert character role sheet")
	}

	resp := roleSheetResponseFromContent(char, content)
	return &resp, nil
}

func (s *service) getOwnedCharacter(ctx context.Context, creatorID, charID uuid.UUID) (db.ThemeCharacter, error) {
	char, err := s.q.GetThemeCharacter(ctx, charID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.ThemeCharacter{}, apperror.NotFound("character not found")
		}
		s.logger.Error().Err(err).Msg("failed to get character")
		return db.ThemeCharacter{}, apperror.Internal("failed to get character")
	}
	if _, err := s.getOwnedTheme(ctx, creatorID, char.ThemeID); err != nil {
		return db.ThemeCharacter{}, err
	}
	return char, nil
}

func emptyRoleSheetResponse(char db.ThemeCharacter) *RoleSheetResponse {
	return &RoleSheetResponse{
		CharacterID: char.ID,
		ThemeID:     char.ThemeID,
		Format:      RoleSheetFormatMarkdown,
		Markdown:    &RoleSheetMarkdown{Body: ""},
	}
}

func roleSheetResponseFromContent(char db.ThemeCharacter, content db.ThemeContent) RoleSheetResponse {
	updatedAt := content.UpdatedAt
	return RoleSheetResponse{
		CharacterID: char.ID,
		ThemeID:     char.ThemeID,
		Format:      RoleSheetFormatMarkdown,
		Markdown:    &RoleSheetMarkdown{Body: content.Body},
		UpdatedAt:   &updatedAt,
	}
}
