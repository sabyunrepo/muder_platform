package editor

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

// --- Publication lifecycle ---

// PublishTheme directly publishes a theme (admin-only use).
func (s *service) PublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}
	if theme.Status != "DRAFT" {
		return nil, apperror.BadRequest("only draft themes can be published")
	}

	charCount, err := s.q.CountThemeCharacters(ctx, theme.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count characters")
		return nil, apperror.Internal("failed to count characters")
	}
	if charCount < int64(theme.MinPlayers) {
		return nil, apperror.BadRequest(fmt.Sprintf("theme requires at least %d characters, has %d", theme.MinPlayers, charCount))
	}

	if len(theme.ConfigJson) == 0 || string(theme.ConfigJson) == "{}" || string(theme.ConfigJson) == "null" {
		return nil, apperror.BadRequest("theme config_json must be set before publishing")
	}

	updated, err := s.q.UpdateThemeStatus(ctx, db.UpdateThemeStatusParams{
		ID:     theme.ID,
		Status: "PUBLISHED",
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to publish theme")
		return nil, apperror.Internal("failed to publish theme")
	}
	return toThemeResponse(updated), nil
}

// UnpublishTheme moves a published theme to UNPUBLISHED status.
func (s *service) UnpublishTheme(ctx context.Context, creatorID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, creatorID, themeID)
	if err != nil {
		return nil, err
	}
	if theme.Status != "PUBLISHED" {
		return nil, apperror.BadRequest("only published themes can be unpublished")
	}

	updated, err := s.q.UnpublishTheme(ctx, theme.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to unpublish theme")
		return nil, apperror.Internal("failed to unpublish theme")
	}
	return toThemeResponse(updated), nil
}

// SubmitForReview submits a theme for admin review.
// Trusted creators are auto-approved and published immediately.
func (s *service) SubmitForReview(ctx context.Context, userID, themeID uuid.UUID) (*ThemeResponse, error) {
	theme, err := s.getOwnedTheme(ctx, userID, themeID)
	if err != nil {
		return nil, err
	}

	if theme.Status != "DRAFT" && theme.Status != "REJECTED" {
		return nil, apperror.BadRequest("only draft or rejected themes can be submitted for review")
	}

	charCount, err := s.q.CountThemeCharacters(ctx, theme.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count characters")
		return nil, apperror.Internal("failed to count characters")
	}
	if charCount < int64(theme.MinPlayers) {
		return nil, apperror.BadRequest(fmt.Sprintf("theme requires at least %d characters, has %d", theme.MinPlayers, charCount))
	}
	if len(theme.ConfigJson) == 0 || string(theme.ConfigJson) == "{}" || string(theme.ConfigJson) == "null" {
		return nil, apperror.BadRequest("theme config_json must be set before submitting")
	}

	trusted, err := s.q.GetUserTrustedCreator(ctx, userID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to check trusted creator status")
		return nil, apperror.Internal("failed to check trusted creator status")
	}

	if trusted {
		updated, err := s.q.ApproveTheme(ctx, db.ApproveThemeParams{
			ID:         theme.ID,
			ReviewedBy: pgtype.UUID{Bytes: userID, Valid: true},
			ReviewNote: pgtype.Text{String: "auto-approved (trusted creator)", Valid: true},
		})
		if err != nil {
			s.logger.Error().Err(err).Msg("failed to auto-approve theme")
			return nil, apperror.Internal("failed to auto-approve theme")
		}
		return toThemeResponse(updated), nil
	}

	updated, err := s.q.SubmitThemeForReview(ctx, theme.ID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to submit theme for review")
		return nil, apperror.Internal("failed to submit theme for review")
	}
	return toThemeResponse(updated), nil
}
