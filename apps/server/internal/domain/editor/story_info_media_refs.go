package editor

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

type storyInfoMediaRef struct {
	mediaID   uuid.UUID
	usage     string
	sortOrder int32
}

type storyInfoMediaEmbed struct {
	mediaID uuid.UUID
	rawType string
}

var (
	storyInfoMediaEmbedRe = regexp.MustCompile(`(?s)<MediaEmbed\b([^>]*)/?>`)
	storyInfoAttrRe       = regexp.MustCompile(`\b(mediaId|type)\s*=\s*"([^"]*)"`)
)

func (s *storyInfoService) createStoryInfoWithRefs(ctx context.Context, arg db.CreateStoryInfoParams, refs []storyInfoMediaRef) (db.StoryInfo, error) {
	var row db.StoryInfo
	if s.pool != nil && s.withTx != nil {
		err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
			var txErr error
			row, txErr = s.createStoryInfoWithRefsUsing(ctx, s.withTx(tx), arg, refs)
			return txErr
		})
		return row, err
	}
	return s.createStoryInfoWithRefsUsing(ctx, s.q, arg, refs)
}

func (s *storyInfoService) createStoryInfoWithRefsUsing(ctx context.Context, q storyInfoQueries, arg db.CreateStoryInfoParams, refs []storyInfoMediaRef) (db.StoryInfo, error) {
	row, err := q.CreateStoryInfo(ctx, arg)
	if err != nil {
		return db.StoryInfo{}, err
	}
	if err := s.replaceStoryInfoMediaRefs(ctx, q, row.ID, refs); err != nil {
		return db.StoryInfo{}, err
	}
	return row, nil
}

func (s *storyInfoService) updateStoryInfoWithRefs(ctx context.Context, arg db.UpdateStoryInfoParams, refs []storyInfoMediaRef) (db.StoryInfo, error) {
	var row db.StoryInfo
	if s.pool != nil && s.withTx != nil {
		err := pgx.BeginTxFunc(ctx, s.pool, pgx.TxOptions{}, func(tx pgx.Tx) error {
			var txErr error
			row, txErr = s.updateStoryInfoWithRefsUsing(ctx, s.withTx(tx), arg, refs)
			return txErr
		})
		return row, err
	}
	return s.updateStoryInfoWithRefsUsing(ctx, s.q, arg, refs)
}

func (s *storyInfoService) updateStoryInfoWithRefsUsing(ctx context.Context, q storyInfoQueries, arg db.UpdateStoryInfoParams, refs []storyInfoMediaRef) (db.StoryInfo, error) {
	row, err := q.UpdateStoryInfo(ctx, arg)
	if err != nil {
		return db.StoryInfo{}, err
	}
	if err := s.replaceStoryInfoMediaRefs(ctx, q, row.ID, refs); err != nil {
		return db.StoryInfo{}, err
	}
	return row, nil
}

func (s *storyInfoService) replaceStoryInfoMediaRefs(ctx context.Context, q storyInfoQueries, infoID uuid.UUID, refs []storyInfoMediaRef) error {
	if err := q.DeleteStoryInfoMediaRefs(ctx, infoID); err != nil {
		return err
	}
	for _, ref := range refs {
		if err := q.CreateStoryInfoMediaRef(ctx, db.CreateStoryInfoMediaRefParams{
			StoryInfoID: infoID,
			MediaID:     ref.mediaID,
			Usage:       ref.usage,
			SortOrder:   ref.sortOrder,
		}); err != nil {
			return err
		}
	}
	return nil
}

func (s *storyInfoService) resolveStoryInfoMediaRefs(ctx context.Context, themeID uuid.UUID, imageMediaID pgtype.UUID, body string) ([]storyInfoMediaRef, error) {
	refs := []storyInfoMediaRef{}
	sortOrder := int32(0)
	if imageMediaID.Valid {
		refs = append(refs, storyInfoMediaRef{
			mediaID:   uuid.UUID(imageMediaID.Bytes),
			usage:     "cover",
			sortOrder: sortOrder,
		})
		sortOrder++
	}
	for _, embed := range extractStoryInfoMediaEmbeds(body) {
		media, err := s.resolveStoryInfoEmbeddedMedia(ctx, themeID, embed)
		if err != nil {
			return nil, err
		}
		usage := "embedded_image"
		if media.Type == MediaTypeVideo {
			usage = "embedded_video"
		}
		refs = append(refs, storyInfoMediaRef{
			mediaID:   embed.mediaID,
			usage:     usage,
			sortOrder: sortOrder,
		})
		sortOrder++
	}
	return refs, nil
}

func extractStoryInfoMediaEmbeds(body string) []storyInfoMediaEmbed {
	matches := storyInfoMediaEmbedRe.FindAllStringSubmatch(body, -1)
	out := make([]storyInfoMediaEmbed, 0, len(matches))
	for _, match := range matches {
		attrs := map[string]string{}
		for _, attr := range storyInfoAttrRe.FindAllStringSubmatch(match[1], -1) {
			attrs[attr[1]] = attr[2]
		}
		id, err := uuid.Parse(strings.TrimSpace(attrs["mediaId"]))
		if err != nil {
			out = append(out, storyInfoMediaEmbed{})
			continue
		}
		out = append(out, storyInfoMediaEmbed{
			mediaID: id,
			rawType: strings.ToLower(strings.TrimSpace(attrs["type"])),
		})
	}
	return out
}

func (s *storyInfoService) resolveStoryInfoEmbeddedMedia(ctx context.Context, themeID uuid.UUID, embed storyInfoMediaEmbed) (db.ThemeMedium, error) {
	if embed.mediaID == uuid.Nil {
		return db.ThemeMedium{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "invalid MediaEmbed mediaId")
	}
	media, err := s.q.GetMedia(ctx, embed.mediaID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.ThemeMedium{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "embedded media not found")
		}
		s.logger.Error().Err(err).Str("media_id", embed.mediaID.String()).Msg("failed to verify story info embedded media")
		return db.ThemeMedium{}, apperror.Internal("failed to verify embedded media reference")
	}
	if media.ThemeID != themeID || (media.Type != MediaTypeImage && media.Type != MediaTypeVideo) {
		return db.ThemeMedium{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "embedded media has wrong type or theme")
	}
	if media.Type == MediaTypeVideo && media.SourceType != SourceTypeYouTube {
		return db.ThemeMedium{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "MediaEmbed video must reference a YouTube media item")
	}
	switch embed.rawType {
	case "":
	case "image":
		if media.Type != MediaTypeImage {
			return db.ThemeMedium{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "MediaEmbed type does not match media")
		}
	case "video":
		if media.Type != MediaTypeVideo {
			return db.ThemeMedium{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "MediaEmbed type does not match media")
		}
	default:
		return db.ThemeMedium{}, apperror.New(apperror.ErrValidation, 422, "unsupported MediaEmbed type")
	}
	return media, nil
}
