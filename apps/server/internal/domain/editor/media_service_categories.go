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

func (s *mediaService) ownedCategory(ctx context.Context, creatorID, categoryID uuid.UUID) (db.ThemeMediaCategory, error) {
	category, err := s.q.GetMediaCategoryWithOwner(ctx, db.GetMediaCategoryWithOwnerParams{
		ID:        categoryID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.ThemeMediaCategory{}, apperror.NotFound("media category not found")
		}
		s.logger.Error().Err(err).Str("category_id", categoryID.String()).Msg("failed to get media category")
		return db.ThemeMediaCategory{}, apperror.Internal("failed to get media category")
	}
	return category, nil
}

func (s *mediaService) ListCategories(ctx context.Context, creatorID, themeID uuid.UUID) ([]MediaCategoryResponse, error) {
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListMediaCategoriesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to list media categories")
		return nil, apperror.Internal("failed to list media categories")
	}
	out := make([]MediaCategoryResponse, 0, len(rows))
	for _, row := range rows {
		out = append(out, toMediaCategoryResponse(row))
	}
	return out, nil
}

func (s *mediaService) CreateCategory(ctx context.Context, creatorID, themeID uuid.UUID, req MediaCategoryRequest) (*MediaCategoryResponse, error) {
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	row, err := s.q.CreateMediaCategory(ctx, db.CreateMediaCategoryParams{
		ThemeID:   themeID,
		Name:      strings.TrimSpace(req.Name),
		SortOrder: req.SortOrder,
		CreatorID: creatorID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to create media category")
		return nil, apperror.Internal("failed to create media category")
	}
	resp := toMediaCategoryResponse(row)
	return &resp, nil
}

func (s *mediaService) UpdateCategory(ctx context.Context, creatorID, categoryID uuid.UUID, req MediaCategoryRequest) (*MediaCategoryResponse, error) {
	row, err := s.q.UpdateMediaCategory(ctx, db.UpdateMediaCategoryParams{
		ID:        categoryID,
		Name:      strings.TrimSpace(req.Name),
		SortOrder: req.SortOrder,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("media category not found")
		}
		s.logger.Error().Err(err).Str("category_id", categoryID.String()).Msg("failed to update media category")
		return nil, apperror.Internal("failed to update media category")
	}
	resp := toMediaCategoryResponse(row)
	return &resp, nil
}

func (s *mediaService) DeleteCategory(ctx context.Context, creatorID, categoryID uuid.UUID) error {
	rows, err := s.q.DeleteMediaCategoryWithOwner(ctx, db.DeleteMediaCategoryWithOwnerParams{
		ID:        categoryID,
		CreatorID: creatorID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("category_id", categoryID.String()).Msg("failed to delete media category")
		return apperror.Internal("failed to delete media category")
	}
	if rows == 0 {
		return apperror.NotFound("media category not found")
	}
	return nil
}

func (s *mediaService) mediaCategoryParam(ctx context.Context, creatorID, themeID uuid.UUID, categoryID *uuid.UUID) (pgtype.UUID, error) {
	if categoryID == nil {
		return pgtype.UUID{}, nil
	}
	category, err := s.ownedCategory(ctx, creatorID, *categoryID)
	if err != nil {
		return pgtype.UUID{}, err
	}
	if category.ThemeID != themeID {
		return pgtype.UUID{}, apperror.NotFound("media category not found")
	}
	return pgtype.UUID{Bytes: *categoryID, Valid: true}, nil
}
