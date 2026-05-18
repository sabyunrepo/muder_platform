package editor

import (
	"context"
	"errors"
	"strings"

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

func (s *mediaService) DeleteMedia(ctx context.Context, creatorID, mediaID uuid.UUID, opts DeleteMediaOptions) error {
	media, err := s.deleteMediaRecord(ctx, s.q, creatorID, mediaID, opts)
	if err != nil {
		return err
	}

	if media.SourceType == SourceTypeFile && media.StorageKey.Valid && s.storage != nil {
		keys := mediaImageVariantKeysFor(media)
		if len(keys) == 0 {
			keys = []string{media.StorageKey.String}
		}
		if delErr := s.storage.DeleteObjects(ctx, keys); delErr != nil {
			s.logger.Error().Err(delErr).Strs("storage_keys", keys).Msg("failed to delete storage object")
			return apperror.Internal("failed to delete storage object")
		}
	}
	return nil
}

func (s *mediaService) deleteMediaRecord(ctx context.Context, q mediaQueries, creatorID, mediaID uuid.UUID, opts DeleteMediaOptions) (db.ThemeMedium, error) {
	var media db.ThemeMedium
	if s.pool != nil && s.withTx != nil {
		err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
			var txErr error
			media, txErr = s.deleteMediaRecordWithQueries(ctx, s.withTx(tx), creatorID, mediaID, opts)
			return txErr
		})
		return media, err
	}
	return s.deleteMediaRecordWithQueries(ctx, q, creatorID, mediaID, opts)
}

func (s *mediaService) deleteMediaRecordWithQueries(ctx context.Context, q mediaQueries, creatorID, mediaID uuid.UUID, opts DeleteMediaOptions) (db.ThemeMedium, error) {
	media, err := q.GetMediaWithOwner(ctx, db.GetMediaWithOwnerParams{
		ID:        mediaID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.ThemeMedium{}, apperror.NotFound("media not found")
		}
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to get media")
		return db.ThemeMedium{}, apperror.Internal("failed to get media")
	}

	refs, err := s.collectMediaReferencesWithQueries(ctx, q, media, mediaID)
	if err != nil {
		return db.ThemeMedium{}, err
	}
	if len(refs) > 0 && !opts.DetachReferences {
		return db.ThemeMedium{}, apperror.New(apperror.ErrMediaReferenceInUse, 409, "media is referenced by editor content").
			WithParams(map[string]any{"references": toMediaReferenceResponses(refs)})
	}

	if err := s.cleanupMediaReferences(ctx, q, creatorID, media, mediaID); err != nil {
		return db.ThemeMedium{}, err
	}

	rows, err := q.DeleteMediaWithOwner(ctx, db.DeleteMediaWithOwnerParams{
		ID:        mediaID,
		CreatorID: creatorID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to delete media")
		return db.ThemeMedium{}, apperror.Internal("failed to delete media")
	}
	if rows == 0 {
		return db.ThemeMedium{}, apperror.NotFound("media not found")
	}
	return media, nil
}

func (s *mediaService) collectMediaReferences(ctx context.Context, media db.ThemeMedium, mediaID uuid.UUID) ([]mediaReferenceInfo, error) {
	return s.collectMediaReferencesWithQueries(ctx, s.q, media, mediaID)
}

func (s *mediaService) collectMediaReferencesWithQueries(ctx context.Context, q mediaQueries, media db.ThemeMedium, mediaID uuid.UUID) ([]mediaReferenceInfo, error) {
	refList := []mediaReferenceInfo{}

	refs, err := q.FindMediaReferencesInReadingSections(ctx, db.FindMediaReferencesInReadingSectionsParams{
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

	themeCoverRefs, err := q.FindThemeCoverReferencesForMedia(ctx, db.FindThemeCoverReferencesForMediaParams{
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

	mapRefs, err := q.FindMapReferencesForMedia(ctx, db.FindMapReferencesForMediaParams{
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

	clueRefs, err := q.FindClueReferencesForMedia(ctx, db.FindClueReferencesForMediaParams{
		ThemeID: media.ThemeID,
		MediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check clue media references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range clueRefs {
		refList = append(refList, mediaReferenceInfo{Type: "clue_image", ID: r.ID.String(), Name: r.Name})
	}

	locationRefs, err := q.FindLocationReferencesForMedia(ctx, db.FindLocationReferencesForMediaParams{
		ThemeID: media.ThemeID,
		MediaID: pgtype.UUID{Bytes: mediaID, Valid: true},
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check location media references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range locationRefs {
		refList = append(refList, mediaReferenceInfo{Type: "location_image", ID: r.ID.String(), Name: r.Name})
	}

	characterImageRefs, err := q.FindCharacterImageReferencesForMedia(ctx, db.FindCharacterImageReferencesForMediaParams{
		ThemeID: media.ThemeID,
		MediaID: mediaID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check character image media references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range characterImageRefs {
		refList = append(refList, mediaReferenceInfo{Type: characterImageMediaReferenceType(r.Usage), ID: r.ID.String(), Name: r.Name})
	}

	storyInfoRefs, err := q.FindStoryInfoReferencesForMedia(ctx, db.FindStoryInfoReferencesForMediaParams{
		ThemeID: media.ThemeID,
		MediaID: mediaID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check story info media references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range storyInfoRefs {
		refList = append(refList, mediaReferenceInfo{Type: storyInfoMediaReferenceType(r.Usage), ID: r.ID.String(), Name: r.Title})
	}

	roleSheetRefs, err := q.FindRoleSheetReferencesForMedia(ctx, db.FindRoleSheetReferencesForMediaParams{
		ThemeID: media.ThemeID,
		Body:    mediaID.String(),
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check role sheet references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range roleSheetRefs {
		refList = append(refList, mediaReferenceInfo{Type: roleSheetMediaReferenceType(r.Body, mediaID, media.Type), ID: r.Key, Name: r.Key})
	}

	aliasIconRefs, err := q.FindCharacterAliasIconReferencesForMedia(ctx, db.FindCharacterAliasIconReferencesForMediaParams{
		ThemeID: media.ThemeID,
		MediaID: mediaID.String(),
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check character alias icon references")
		return nil, apperror.Internal("failed to check media references")
	}
	for _, r := range aliasIconRefs {
		refList = append(refList, mediaReferenceInfo{Type: "character_alias_icon", ID: r.ID.String(), Name: r.Name})
	}

	theme, err := q.GetTheme(ctx, media.ThemeID)
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

func (s *mediaService) cleanupMediaReferences(ctx context.Context, q mediaQueries, creatorID uuid.UUID, media db.ThemeMedium, mediaID uuid.UUID) error {
	if _, err := s.collectMediaReferencesWithQueries(ctx, q, media, mediaID); err != nil {
		return err
	}
	if _, err := q.ClearReadingSectionMediaReferencesWithOwner(ctx, db.ClearReadingSectionMediaReferencesWithOwnerParams{
		MediaID:   mediaID,
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear reading section media references")
		return apperror.Internal("failed to clear media references")
	}

	if _, err := q.ClearRoleSheetMediaReferencesWithOwner(ctx, db.ClearRoleSheetMediaReferencesWithOwnerParams{
		MediaID:   mediaID.String(),
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear role sheet media references")
		return apperror.Internal("failed to clear media references")
	}

	if _, err := q.ClearCharacterAliasIconMediaReferencesWithOwner(ctx, db.ClearCharacterAliasIconMediaReferencesWithOwnerParams{
		MediaID:   mediaID.String(),
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear character alias icon media references")
		return apperror.Internal("failed to clear media references")
	}

	if _, err := q.ClearCharacterImageMediaReferencesWithOwner(ctx, db.ClearCharacterImageMediaReferencesWithOwnerParams{
		MediaID:   mediaID,
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear character image media references")
		return apperror.Internal("failed to clear media references")
	}

	if _, err := q.ClearThemeCoverMediaReferencesWithOwner(ctx, db.ClearThemeCoverMediaReferencesWithOwnerParams{
		MediaID:   pgtype.UUID{Bytes: mediaID, Valid: true},
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear theme cover media references")
		return apperror.Internal("failed to clear media references")
	}

	if _, err := q.ClearMapMediaReferencesWithOwner(ctx, db.ClearMapMediaReferencesWithOwnerParams{
		MediaID:   pgtype.UUID{Bytes: mediaID, Valid: true},
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear map media references")
		return apperror.Internal("failed to clear media references")
	}

	if _, err := q.ClearClueMediaReferencesWithOwner(ctx, db.ClearClueMediaReferencesWithOwnerParams{
		MediaID:   pgtype.UUID{Bytes: mediaID, Valid: true},
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear clue media references")
		return apperror.Internal("failed to clear media references")
	}

	if _, err := q.ClearLocationMediaReferencesWithOwner(ctx, db.ClearLocationMediaReferencesWithOwnerParams{
		MediaID:   pgtype.UUID{Bytes: mediaID, Valid: true},
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear location media references")
		return apperror.Internal("failed to clear media references")
	}

	if _, err := q.ClearStoryInfoMediaReferencesWithOwner(ctx, db.ClearStoryInfoMediaReferencesWithOwnerParams{
		MediaID:   mediaID,
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to clear story info media references")
		return apperror.Internal("failed to clear media references")
	}
	if _, err := q.DeleteStoryInfoMediaRefsForMediaWithOwner(ctx, db.DeleteStoryInfoMediaRefsForMediaWithOwnerParams{
		MediaID:   mediaID,
		CreatorID: creatorID,
		ThemeID:   media.ThemeID,
	}); err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to delete story info media refs")
		return apperror.Internal("failed to clear media references")
	}

	theme, err := q.GetTheme(ctx, media.ThemeID)
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
		if _, err := q.UpdateThemeConfigJsonWithOwner(ctx, db.UpdateThemeConfigJsonWithOwnerParams{
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

func roleSheetMediaReferenceType(body string, mediaID uuid.UUID, mediaType string) string {
	for _, embed := range extractRoleSheetMediaEmbeds(body) {
		if embed.mediaID != mediaID {
			continue
		}
		if embed.rawType == "video" || (embed.rawType == "" && mediaType == MediaTypeVideo) {
			return "role_sheet_embedded_video"
		}
		if embed.rawType == "image" || (embed.rawType == "" && mediaType == MediaTypeImage) {
			return "role_sheet_embedded_image"
		}
		return "role_sheet"
	}
	if strings.Contains(body, `"image_media_ids"`) && strings.Contains(body, mediaID.String()) {
		return "role_sheet_image_page"
	}
	return "role_sheet"
}

func storyInfoMediaReferenceType(usage string) string {
	switch usage {
	case "cover":
		return "story_info_cover"
	case "embedded_image":
		return "story_info_embedded_image"
	case "embedded_video":
		return "story_info_embedded_video"
	default:
		return "story_info"
	}
}

func characterImageMediaReferenceType(usage string) string {
	switch usage {
	case "endcard":
		return "character_endcard_image"
	default:
		return "character_image"
	}
}

func toMediaReferenceResponses(refs []mediaReferenceInfo) []MediaReferenceResponse {
	out := make([]MediaReferenceResponse, 0, len(refs))
	for _, ref := range refs {
		out = append(out, MediaReferenceResponse{Type: ref.Type, ID: ref.ID, Name: ref.Name})
	}
	return out
}
