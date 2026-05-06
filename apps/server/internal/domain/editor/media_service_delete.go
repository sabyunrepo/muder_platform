package editor

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

func (s *mediaService) PreviewDeleteMedia(ctx context.Context, creatorID, mediaID uuid.UUID) (*MediaDeletePreviewResponse, error) {
	media, err := s.q.GetMediaWithOwner(ctx, db.GetMediaWithOwnerParams{
		ID:        mediaID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("media not found")
		}
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to get media")
		return nil, apperror.Internal("failed to get media")
	}
	refs, err := s.collectMediaReferences(ctx, media, mediaID)
	if err != nil {
		return nil, err
	}
	return &MediaDeletePreviewResponse{References: toMediaReferenceResponses(refs)}, nil
}

func (s *mediaService) DeleteMedia(ctx context.Context, creatorID, mediaID uuid.UUID) error {
	media, err := s.q.GetMediaWithOwner(ctx, db.GetMediaWithOwnerParams{
		ID:        mediaID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.NotFound("media not found")
		}
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to get media")
		return apperror.Internal("failed to get media")
	}

	if err := s.cleanupMediaReferences(ctx, creatorID, media, mediaID); err != nil {
		return err
	}

	if media.SourceType == SourceTypeFile && media.StorageKey.Valid && s.storage != nil {
		if delErr := s.storage.DeleteObject(ctx, media.StorageKey.String); delErr != nil {
			s.logger.Warn().Err(delErr).Str("storage_key", media.StorageKey.String).Msg("failed to delete storage object")
		}
	}

	rows, err := s.q.DeleteMediaWithOwner(ctx, db.DeleteMediaWithOwnerParams{
		ID:        mediaID,
		CreatorID: creatorID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to delete media")
		return apperror.Internal("failed to delete media")
	}
	if rows == 0 {
		return apperror.NotFound("media not found")
	}
	return nil
}

func (s *mediaService) collectMediaReferences(ctx context.Context, media db.ThemeMedium, mediaID uuid.UUID) ([]mediaReferenceInfo, error) {
	refList := []mediaReferenceInfo{}

	refs, err := s.q.FindMediaReferencesInReadingSections(ctx, db.FindMediaReferencesInReadingSectionsParams{
		ThemeID: media.ThemeID,
		MediaID: mediaID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check media references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range refs {
		refList = append(refList, mediaReferenceInfo{Type: "reading_section", ID: r.ID.String(), Name: r.Name})
	}

	themeCoverRefs, err := s.q.FindThemeCoverReferencesForMedia(ctx, db.FindThemeCoverReferencesForMediaParams{
		ThemeID: media.ThemeID,
		MediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check theme cover media references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range themeCoverRefs {
		refList = append(refList, mediaReferenceInfo{Type: "theme_cover", ID: r.ID.String(), Name: r.Title})
	}

	mapRefs, err := s.q.FindMapReferencesForMedia(ctx, db.FindMapReferencesForMediaParams{
		ThemeID: media.ThemeID,
		MediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check map media references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range mapRefs {
		refList = append(refList, mediaReferenceInfo{Type: "map", ID: r.ID.String(), Name: r.Name})
	}

	roleSheetRefs, err := s.q.FindRoleSheetReferencesForMedia(ctx, db.FindRoleSheetReferencesForMediaParams{
		ThemeID: media.ThemeID,
		Body:    `"media_id"\s*:\s*"` + mediaID.String() + `"`,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check role sheet references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range roleSheetRefs {
		refList = append(refList, mediaReferenceInfo{Type: "role_sheet", ID: r.Key, Name: r.Key})
	}

	theme, err := s.q.GetTheme(ctx, media.ThemeID)
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", media.ThemeID.String()).Msg("failed to get theme for media references")
		return nil, apperror.Internal("failed to check media references")
	}
	configRefs, err := findMediaReferencesInThemeConfig(theme.ConfigJson, mediaID)
	if err != nil {
		s.logger.Warn().Err(err).Str("media_id", mediaID.String()).Msg("failed to scan theme config media references")
		return nil, apperror.New(apperror.ErrValidation, 422, "theme config contains invalid media references")
	}
	refList = append(refList, configRefs...)
	return refList, nil
}

func (s *mediaService) cleanupMediaReferences(ctx context.Context, creatorID uuid.UUID, media db.ThemeMedium, mediaID uuid.UUID) error {
	if _, err := s.collectMediaReferences(ctx, media, mediaID); err != nil {
		return err
	}
	if _, err := s.q.ClearReadingSectionMediaReferencesWithOwner(ctx, db.ClearReadingSectionMediaReferencesWithOwnerParams{
		MediaID:   mediaID,
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear reading section media references")
		return apperror.Internal("failed to clear media references")
	}

	if _, err := s.q.ClearRoleSheetMediaReferencesWithOwner(ctx, db.ClearRoleSheetMediaReferencesWithOwnerParams{
		MediaID:   mediaID.String(),
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear role sheet media references")
		return apperror.Internal("failed to clear media references")
	}

	theme, err := s.q.GetTheme(ctx, media.ThemeID)
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", media.ThemeID.String()).Msg("failed to get theme for media reference cleanup")
		return apperror.Internal("failed to clear media references")
	}
	cleaned, changed, err := clearMediaReferencesInThemeConfig(theme.ConfigJson, mediaID)
	if err != nil {
		s.logger.Warn().Err(err).Str("media_id", mediaID.String()).Msg("failed to clean theme config media references")
		return apperror.New(apperror.ErrValidation, 422, "theme config contains invalid media references")
	}
	if changed {
		if _, err := s.q.UpdateThemeConfigJsonWithOwner(ctx, db.UpdateThemeConfigJsonWithOwnerParams{
			ID:         media.ThemeID,
			CreatorID:  creatorID,
			ConfigJson: cleaned,
		}); err != nil {
			s.logger.Error().Err(err).Str("theme_id", media.ThemeID.String()).Msg("failed to update theme config after media cleanup")
			return apperror.Internal("failed to clear media references")
		}
	}
	return nil
}

func toMediaReferenceResponses(refs []mediaReferenceInfo) []MediaReferenceResponse {
	out := make([]MediaReferenceResponse, 0, len(refs))
	for _, ref := range refs {
		out = append(out, MediaReferenceResponse{Type: ref.Type, ID: ref.ID, Name: ref.Name})
	}
	return out
}
