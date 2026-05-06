package editor

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

type storyInfoQueries interface {
	GetTheme(ctx context.Context, id uuid.UUID) (db.Theme, error)
	GetMedia(ctx context.Context, id uuid.UUID) (db.ThemeMedium, error)
	GetThemeCharacter(ctx context.Context, id uuid.UUID) (db.ThemeCharacter, error)
	GetClue(ctx context.Context, id uuid.UUID) (db.ThemeClue, error)
	GetLocation(ctx context.Context, id uuid.UUID) (db.ThemeLocation, error)
	ListStoryInfosByTheme(ctx context.Context, arg db.ListStoryInfosByThemeParams) ([]db.StoryInfo, error)
	GetStoryInfoWithOwner(ctx context.Context, arg db.GetStoryInfoWithOwnerParams) (db.StoryInfo, error)
	CreateStoryInfo(ctx context.Context, arg db.CreateStoryInfoParams) (db.StoryInfo, error)
	UpdateStoryInfo(ctx context.Context, arg db.UpdateStoryInfoParams) (db.StoryInfo, error)
	DeleteStoryInfoWithOwner(ctx context.Context, arg db.DeleteStoryInfoWithOwnerParams) (uuid.UUID, error)
}

type StoryInfoService interface {
	List(ctx context.Context, creatorID, themeID uuid.UUID) ([]StoryInfoResponse, error)
	Create(ctx context.Context, creatorID, themeID uuid.UUID, req CreateStoryInfoRequest) (*StoryInfoResponse, error)
	Update(ctx context.Context, creatorID, infoID uuid.UUID, req UpdateStoryInfoRequest) (*StoryInfoResponse, error)
	Delete(ctx context.Context, creatorID, infoID uuid.UUID) (uuid.UUID, error)
}

type storyInfoService struct {
	q      storyInfoQueries
	logger zerolog.Logger
}

func NewStoryInfoService(q *db.Queries, logger zerolog.Logger) StoryInfoService {
	return newStoryInfoServiceWith(q, logger)
}

func newStoryInfoServiceWith(q storyInfoQueries, logger zerolog.Logger) *storyInfoService {
	return &storyInfoService{
		q:      q,
		logger: logger.With().Str("domain", "editor.story_info").Logger(),
	}
}

func (s *storyInfoService) List(ctx context.Context, creatorID, themeID uuid.UUID) ([]StoryInfoResponse, error) {
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListStoryInfosByTheme(ctx, db.ListStoryInfosByThemeParams{ThemeID: themeID, CreatorID: creatorID})
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to list story infos")
		return nil, apperror.Internal("failed to list story infos")
	}
	out := make([]StoryInfoResponse, 0, len(rows))
	for _, row := range rows {
		resp, convErr := toStoryInfoResponse(row)
		if convErr != nil {
			s.logger.Error().Err(convErr).Str("story_info_id", row.ID.String()).Msg("failed to decode story info references")
			return nil, apperror.Internal("corrupted story info data")
		}
		out = append(out, *resp)
	}
	return out, nil
}

func (s *storyInfoService) Create(ctx context.Context, creatorID, themeID uuid.UUID, req CreateStoryInfoRequest) (*StoryInfoResponse, error) {
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	title, body, err := validateStoryInfoText(req.Title, req.Body)
	if err != nil {
		return nil, err
	}
	imageParam, err := s.resolveStoryInfoImage(ctx, themeID, req.ImageMediaID)
	if err != nil {
		return nil, err
	}
	charRefs, clueRefs, locationRefs, err := s.resolveStoryInfoRefs(ctx, themeID, req.RelatedCharacterIDs, req.RelatedClueIDs, req.RelatedLocationIDs)
	if err != nil {
		return nil, err
	}
	row, err := s.q.CreateStoryInfo(ctx, db.CreateStoryInfoParams{
		ThemeID:             themeID,
		Title:               title,
		Body:                body,
		ImageMediaID:        imageParam,
		RelatedCharacterIds: charRefs,
		RelatedClueIds:      clueRefs,
		RelatedLocationIds:  locationRefs,
		SortOrder:           req.SortOrder,
		CreatorID:           creatorID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to create story info")
		return nil, apperror.Internal("failed to create story info")
	}
	return toStoryInfoResponse(row)
}

func (s *storyInfoService) Update(ctx context.Context, creatorID, infoID uuid.UUID, req UpdateStoryInfoRequest) (*StoryInfoResponse, error) {
	current, err := s.ownedInfo(ctx, creatorID, infoID)
	if err != nil {
		return nil, err
	}
	resp, err := toStoryInfoResponse(current)
	if err != nil {
		return nil, apperror.Internal("corrupted story info data")
	}
	title := resp.Title
	if req.Title != nil {
		title = *req.Title
	}
	body := resp.Body
	if req.Body != nil {
		body = *req.Body
	}
	title, body, err = validateStoryInfoText(title, body)
	if err != nil {
		return nil, err
	}
	sortOrder := current.SortOrder
	if req.SortOrder != nil {
		sortOrder = *req.SortOrder
	}
	imageParam := current.ImageMediaID
	switch {
	case req.ImageMediaID == nil:
	case *req.ImageMediaID == nil:
		imageParam = pgtype.UUID{}
	default:
		imageParam, err = s.resolveStoryInfoImage(ctx, current.ThemeID, *req.ImageMediaID)
		if err != nil {
			return nil, err
		}
	}
	charIDs := resp.RelatedCharacterIDs
	if req.RelatedCharacterIDs != nil {
		charIDs = *req.RelatedCharacterIDs
	}
	clueIDs := resp.RelatedClueIDs
	if req.RelatedClueIDs != nil {
		clueIDs = *req.RelatedClueIDs
	}
	locationIDs := resp.RelatedLocationIDs
	if req.RelatedLocationIDs != nil {
		locationIDs = *req.RelatedLocationIDs
	}
	charRefs, clueRefs, locationRefs, err := s.resolveStoryInfoRefs(ctx, current.ThemeID, charIDs, clueIDs, locationIDs)
	if err != nil {
		return nil, err
	}
	row, err := s.q.UpdateStoryInfo(ctx, db.UpdateStoryInfoParams{
		ID:                  infoID,
		Title:               title,
		Body:                body,
		ImageMediaID:        imageParam,
		RelatedCharacterIds: charRefs,
		RelatedClueIds:      clueRefs,
		RelatedLocationIds:  locationRefs,
		SortOrder:           sortOrder,
		Version:             req.Version,
		CreatorID:           creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.New(apperror.ErrConflict, 409, "version mismatch")
		}
		s.logger.Error().Err(err).Str("story_info_id", infoID.String()).Msg("failed to update story info")
		return nil, apperror.Internal("failed to update story info")
	}
	return toStoryInfoResponse(row)
}

func (s *storyInfoService) Delete(ctx context.Context, creatorID, infoID uuid.UUID) (uuid.UUID, error) {
	themeID, err := s.q.DeleteStoryInfoWithOwner(ctx, db.DeleteStoryInfoWithOwnerParams{
		ID:        infoID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return uuid.Nil, apperror.NotFound("story info not found")
		}
		s.logger.Error().Err(err).Str("story_info_id", infoID.String()).Msg("failed to delete story info")
		return uuid.Nil, apperror.Internal("failed to delete story info")
	}
	return themeID, nil
}

func (s *storyInfoService) ownedTheme(ctx context.Context, creatorID, themeID uuid.UUID) (db.Theme, error) {
	theme, err := s.q.GetTheme(ctx, themeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Theme{}, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to get theme")
		return db.Theme{}, apperror.Internal("failed to get theme")
	}
	if theme.CreatorID != creatorID {
		return db.Theme{}, apperror.NotFound("theme not found")
	}
	return theme, nil
}

func (s *storyInfoService) ownedInfo(ctx context.Context, creatorID, infoID uuid.UUID) (db.StoryInfo, error) {
	row, err := s.q.GetStoryInfoWithOwner(ctx, db.GetStoryInfoWithOwnerParams{ID: infoID, CreatorID: creatorID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.StoryInfo{}, apperror.NotFound("story info not found")
		}
		s.logger.Error().Err(err).Str("story_info_id", infoID.String()).Msg("failed to get story info")
		return db.StoryInfo{}, apperror.Internal("failed to get story info")
	}
	return row, nil
}

func validateStoryInfoText(title string, body string) (string, string, error) {
	title = strings.TrimSpace(title)
	if title == "" {
		return "", "", apperror.New(apperror.ErrValidation, 422, "story info title is required")
	}
	if len([]rune(title)) > MaxStoryInfoTitleLength {
		return "", "", apperror.New(apperror.ErrValidation, 422, "story info title is too long")
	}
	if len([]rune(body)) > MaxStoryInfoBodyLength {
		return "", "", apperror.New(apperror.ErrValidation, 422, "story info body is too long")
	}
	return title, body, nil
}

func (s *storyInfoService) resolveStoryInfoImage(ctx context.Context, themeID uuid.UUID, raw *string) (pgtype.UUID, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return pgtype.UUID{}, nil
	}
	mediaID, err := uuid.Parse(strings.TrimSpace(*raw))
	if err != nil {
		return pgtype.UUID{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "invalid imageMediaId")
	}
	media, err := s.q.GetMedia(ctx, mediaID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return pgtype.UUID{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "media not found")
		}
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to verify story info image")
		return pgtype.UUID{}, apperror.Internal("failed to verify media reference")
	}
	if media.ThemeID != themeID || media.Type != MediaTypeImage {
		return pgtype.UUID{}, apperror.New(apperror.ErrMediaNotInTheme, 400, "media has wrong type for story info image")
	}
	return pgtype.UUID{Bytes: mediaID, Valid: true}, nil
}

func (s *storyInfoService) resolveStoryInfoRefs(ctx context.Context, themeID uuid.UUID, characterIDs []string, clueIDs []string, locationIDs []string) (json.RawMessage, json.RawMessage, json.RawMessage, error) {
	chars, err := s.validateRelatedIDs(ctx, themeID, characterIDs, "character")
	if err != nil {
		return nil, nil, nil, err
	}
	clues, err := s.validateRelatedIDs(ctx, themeID, clueIDs, "clue")
	if err != nil {
		return nil, nil, nil, err
	}
	locations, err := s.validateRelatedIDs(ctx, themeID, locationIDs, "location")
	if err != nil {
		return nil, nil, nil, err
	}
	charJSON, _ := json.Marshal(chars)
	clueJSON, _ := json.Marshal(clues)
	locationJSON, _ := json.Marshal(locations)
	return json.RawMessage(charJSON), json.RawMessage(clueJSON), json.RawMessage(locationJSON), nil
}

func (s *storyInfoService) validateRelatedIDs(ctx context.Context, themeID uuid.UUID, raw []string, kind string) ([]string, error) {
	if len(raw) > MaxStoryInfoRefs {
		return nil, apperror.New(apperror.ErrValidation, 422, "too many related "+kind+" references")
	}
	seen := map[string]struct{}{}
	out := make([]string, 0, len(raw))
	for _, item := range raw {
		idText := strings.TrimSpace(item)
		if idText == "" {
			continue
		}
		id, err := uuid.Parse(idText)
		if err != nil {
			return nil, apperror.New(apperror.ErrValidation, 422, "invalid related "+kind+" id")
		}
		if _, ok := seen[id.String()]; ok {
			continue
		}
		if err := s.assertRelatedIDInTheme(ctx, themeID, id, kind); err != nil {
			return nil, err
		}
		seen[id.String()] = struct{}{}
		out = append(out, id.String())
	}
	return out, nil
}

func (s *storyInfoService) assertRelatedIDInTheme(ctx context.Context, themeID uuid.UUID, id uuid.UUID, kind string) error {
	switch kind {
	case "character":
		row, err := s.q.GetThemeCharacter(ctx, id)
		if err != nil {
			return s.relatedIDError(err, "character", id)
		}
		if row.ThemeID != themeID {
			return apperror.New(apperror.ErrValidation, 422, "related character does not belong to this theme")
		}
	case "clue":
		row, err := s.q.GetClue(ctx, id)
		if err != nil {
			return s.relatedIDError(err, "clue", id)
		}
		if row.ThemeID != themeID {
			return apperror.New(apperror.ErrValidation, 422, "related clue does not belong to this theme")
		}
	case "location":
		row, err := s.q.GetLocation(ctx, id)
		if err != nil {
			return s.relatedIDError(err, "location", id)
		}
		if row.ThemeID != themeID {
			return apperror.New(apperror.ErrValidation, 422, "related location does not belong to this theme")
		}
	}
	return nil
}

func (s *storyInfoService) relatedIDError(err error, kind string, id uuid.UUID) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return apperror.New(apperror.ErrValidation, 422, "related "+kind+" does not belong to this theme")
	}
	s.logger.Error().Err(err).Str(kind+"_id", id.String()).Msg("failed to verify related " + kind)
	return apperror.Internal("failed to verify related " + kind)
}

func toStoryInfoResponse(row db.StoryInfo) (*StoryInfoResponse, error) {
	charIDs, err := decodeStoryInfoRefs(row.RelatedCharacterIds)
	if err != nil {
		return nil, err
	}
	clueIDs, err := decodeStoryInfoRefs(row.RelatedClueIds)
	if err != nil {
		return nil, err
	}
	locationIDs, err := decodeStoryInfoRefs(row.RelatedLocationIds)
	if err != nil {
		return nil, err
	}
	resp := &StoryInfoResponse{
		ID:                  row.ID,
		ThemeID:             row.ThemeID,
		Title:               row.Title,
		Body:                row.Body,
		RelatedCharacterIDs: charIDs,
		RelatedClueIDs:      clueIDs,
		RelatedLocationIDs:  locationIDs,
		SortOrder:           row.SortOrder,
		Version:             row.Version,
		CreatedAt:           row.CreatedAt,
		UpdatedAt:           row.UpdatedAt,
	}
	if row.ImageMediaID.Valid {
		id := uuid.UUID(row.ImageMediaID.Bytes).String()
		resp.ImageMediaID = &id
	}
	return resp, nil
}

func decodeStoryInfoRefs(raw json.RawMessage) ([]string, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return []string{}, nil
	}
	out := []string{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, err
	}
	return out, nil
}
