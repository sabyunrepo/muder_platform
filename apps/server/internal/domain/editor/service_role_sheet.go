package editor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

const maxRoleSheetBodyBytes = 50000

type storedRoleSheet struct {
	Format   string             `json:"format"`
	Markdown *RoleSheetMarkdown `json:"markdown,omitempty"`
	PDF      *RoleSheetPDF      `json:"pdf,omitempty"`
}

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
	if err := validateRoleSheetRequestShape(req); err != nil {
		return nil, err
	}

	char, err := s.getOwnedCharacter(ctx, creatorID, charID)
	if err != nil {
		return nil, err
	}

	body, err := s.roleSheetStorageBody(ctx, creatorID, char, req)
	if err != nil {
		return nil, err
	}

	content, err := s.q.UpsertContent(ctx, db.UpsertContentParams{
		ThemeID: char.ThemeID,
		Key:     roleSheetContentKey(charID),
		Body:    body,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to upsert character role sheet")
		return nil, apperror.Internal("failed to upsert character role sheet")
	}

	resp := roleSheetResponseFromContent(char, content)
	return &resp, nil
}

func validateRoleSheetRequestShape(req UpsertRoleSheetRequest) error {
	switch req.Format {
	case RoleSheetFormatMarkdown:
		if req.Markdown == nil {
			return apperror.BadRequest("markdown role sheet body is required")
		}
		if len(req.Markdown.Body) > maxRoleSheetBodyBytes {
			return apperror.BadRequest("role sheet body is too long")
		}
	case RoleSheetFormatPDF:
		if req.PDF == nil || req.PDF.MediaID == uuid.Nil {
			return apperror.BadRequest("pdf role sheet media_id is required")
		}
	default:
		return apperror.BadRequest("unsupported role sheet format")
	}
	return nil
}

func (s *service) roleSheetStorageBody(ctx context.Context, creatorID uuid.UUID, char db.ThemeCharacter, req UpsertRoleSheetRequest) (string, error) {
	switch req.Format {
	case RoleSheetFormatMarkdown:
		return req.Markdown.Body, nil
	case RoleSheetFormatPDF:
		if err := s.assertRoleSheetPDFMedia(ctx, creatorID, char.ThemeID, req.PDF.MediaID); err != nil {
			return "", err
		}
		body, err := json.Marshal(storedRoleSheet{Format: RoleSheetFormatPDF, PDF: req.PDF})
		if err != nil {
			s.logger.Error().Err(err).Msg("failed to marshal pdf role sheet")
			return "", apperror.Internal("failed to store role sheet")
		}
		return string(body), nil
	default:
		return "", apperror.BadRequest("unsupported role sheet format")
	}
}

func (s *service) assertRoleSheetPDFMedia(ctx context.Context, creatorID, themeID, mediaID uuid.UUID) error {
	media, err := s.q.GetMediaWithOwner(ctx, db.GetMediaWithOwnerParams{
		ID:        mediaID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.BadRequest("pdf role sheet media not found")
		}
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to get role sheet pdf media")
		return apperror.Internal("failed to validate role sheet media")
	}
	if media.ThemeID != themeID {
		return apperror.BadRequest("pdf role sheet media must belong to the same theme")
	}
	if media.Type != MediaTypeDocument || !media.MimeType.Valid || media.MimeType.String != "application/pdf" {
		return apperror.BadRequest("pdf role sheet media must be a PDF document")
	}
	return nil
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
	if stored, ok := parseStoredRoleSheet(content.Body); ok {
		return RoleSheetResponse{
			CharacterID: char.ID,
			ThemeID:     char.ThemeID,
			Format:      stored.Format,
			Markdown:    stored.Markdown,
			PDF:         stored.PDF,
			UpdatedAt:   &updatedAt,
		}
	}
	return RoleSheetResponse{
		CharacterID: char.ID,
		ThemeID:     char.ThemeID,
		Format:      RoleSheetFormatMarkdown,
		Markdown:    &RoleSheetMarkdown{Body: content.Body},
		UpdatedAt:   &updatedAt,
	}
}

func parseStoredRoleSheet(body string) (storedRoleSheet, bool) {
	var stored storedRoleSheet
	if err := json.Unmarshal([]byte(body), &stored); err != nil {
		return storedRoleSheet{}, false
	}
	switch stored.Format {
	case RoleSheetFormatPDF:
		return stored, stored.PDF != nil && stored.PDF.MediaID != uuid.Nil
	default:
		return storedRoleSheet{}, false
	}
}
