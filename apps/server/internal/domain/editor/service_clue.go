package editor

import (
	"context"
	"errors"
	"fmt"
	"regexp"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
)

var validContentKeyRe = regexp.MustCompile(`^(story|rules|epilogue|role:[a-z0-9_-]{1,50})$`)

// --- Clues ---

func (s *service) ListClues(ctx context.Context, creatorID, themeID uuid.UUID) ([]ClueResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	clues, err := s.q.ListCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to list clues")
		return nil, apperror.Internal("failed to list clues")
	}
	out := make([]ClueResponse, len(clues))
	for i, c := range clues {
		out[i] = toClueResponse(c)
	}
	return out, nil
}

func (s *service) CreateClue(ctx context.Context, creatorID, themeID uuid.UUID, req CreateClueRequest) (*ClueResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	if err := validateClueRoundOrder(req.RevealRound, req.HideRound); err != nil {
		return nil, err
	}
	count, err := s.q.CountCluesByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to count clues")
		return nil, apperror.Internal("failed to count clues")
	}
	if count >= MaxCluesPerTheme {
		return nil, apperror.BadRequest(fmt.Sprintf("theme cannot have more than %d clues", MaxCluesPerTheme))
	}
	clue, err := s.q.CreateClue(ctx, db.CreateClueParams{
		ThemeID:     themeID,
		LocationID:  uuidPtrToPgtype(req.LocationID),
		Name:        req.Name,
		Description: ptrToText(req.Description),
		ImageUrl:    ptrToText(req.ImageURL),
		IsCommon:    req.IsCommon,
		Level:       req.Level,
		SortOrder:   req.SortOrder,
		IsUsable:    req.IsUsable,
		UseEffect:   ptrToText(req.UseEffect),
		UseTarget:   ptrToText(req.UseTarget),
		UseConsumed: req.UseConsumed,
		RevealRound: int32PtrToPgtype(req.RevealRound),
		HideRound:   int32PtrToPgtype(req.HideRound),
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to create clue")
		return nil, apperror.Internal("failed to create clue")
	}
	resp := toClueResponse(clue)
	return &resp, nil
}

func (s *service) UpdateClue(ctx context.Context, creatorID, clueID uuid.UUID, req UpdateClueRequest) (*ClueResponse, error) {
	if err := validateClueRoundOrder(req.RevealRound, req.HideRound); err != nil {
		return nil, err
	}
	c, err := s.q.GetClueWithOwner(ctx, db.GetClueWithOwnerParams{ID: clueID, CreatorID: creatorID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("clue not found")
		}
		s.logger.Error().Err(err).Msg("failed to get clue")
		return nil, apperror.Internal("failed to get clue")
	}
	updated, err := s.q.UpdateClue(ctx, db.UpdateClueParams{
		ID:          c.ID,
		LocationID:  uuidPtrToPgtype(req.LocationID),
		Name:        req.Name,
		Description: ptrToText(req.Description),
		ImageUrl:    ptrToText(req.ImageURL),
		IsCommon:    req.IsCommon,
		Level:       req.Level,
		SortOrder:   req.SortOrder,
		IsUsable:    req.IsUsable,
		UseEffect:   ptrToText(req.UseEffect),
		UseTarget:   ptrToText(req.UseTarget),
		UseConsumed: req.UseConsumed,
		RevealRound: int32PtrToPgtype(req.RevealRound),
		HideRound:   int32PtrToPgtype(req.HideRound),
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to update clue")
		return nil, apperror.Internal("failed to update clue")
	}
	resp := toClueResponse(updated)
	return &resp, nil
}

// validateClueRoundOrder ensures reveal_round <= hide_round when both are set.
// Matches the DB CHECK in migration 00025 but returns a friendly 400 instead
// of letting the constraint fire as a 500.
func validateClueRoundOrder(reveal, hide *int32) error {
	if reveal != nil && hide != nil && *reveal > *hide {
		return apperror.BadRequest("reveal_round must not be greater than hide_round")
	}
	return nil
}

func (s *service) DeleteClue(ctx context.Context, creatorID, clueID uuid.UUID) error {
	n, err := s.q.DeleteClueWithOwner(ctx, db.DeleteClueWithOwnerParams{ID: clueID, CreatorID: creatorID})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to delete clue")
		return apperror.Internal("failed to delete clue")
	}
	if n == 0 {
		return apperror.NotFound("clue not found")
	}
	return nil
}

// --- Contents ---

func (s *service) GetContent(ctx context.Context, creatorID, themeID uuid.UUID, key string) (*ContentResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	if !validContentKeyRe.MatchString(key) {
		return nil, apperror.BadRequest("invalid content key format")
	}
	content, err := s.q.GetContent(ctx, db.GetContentParams{ThemeID: themeID, Key: key})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &ContentResponse{ThemeID: themeID, Key: key, Body: ""}, nil
		}
		s.logger.Error().Err(err).Msg("failed to get content")
		return nil, apperror.Internal("failed to get content")
	}
	resp := toContentResponse(content)
	return &resp, nil
}

func (s *service) UpsertContent(ctx context.Context, creatorID, themeID uuid.UUID, key string, body string) (*ContentResponse, error) {
	if _, err := s.getOwnedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}
	if !validContentKeyRe.MatchString(key) {
		return nil, apperror.BadRequest("invalid content key format")
	}
	content, err := s.q.UpsertContent(ctx, db.UpsertContentParams{
		ThemeID: themeID,
		Key:     key,
		Body:    body,
	})
	if err != nil {
		s.logger.Error().Err(err).Msg("failed to upsert content")
		return nil, apperror.Internal("failed to upsert content")
	}
	resp := toContentResponse(content)
	return &resp, nil
}

// --- Response mappers ---

func toClueResponse(c db.ThemeClue) ClueResponse {
	return ClueResponse{
		ID:          c.ID,
		ThemeID:     c.ThemeID,
		LocationID:  pgtypeUUIDToPtr(c.LocationID),
		Name:        c.Name,
		Description: textToPtr(c.Description),
		ImageURL:    textToPtr(c.ImageUrl),
		IsCommon:    c.IsCommon,
		Level:       c.Level,
		SortOrder:   c.SortOrder,
		CreatedAt:   c.CreatedAt,
		IsUsable:    c.IsUsable,
		UseEffect:   textToPtr(c.UseEffect),
		UseTarget:   textToPtr(c.UseTarget),
		UseConsumed: c.UseConsumed,
		RevealRound: pgtypeInt4ToPtr(c.RevealRound),
		HideRound:   pgtypeInt4ToPtr(c.HideRound),
	}
}

func toContentResponse(c db.ThemeContent) ContentResponse {
	return ContentResponse{
		ID:        c.ID,
		ThemeID:   c.ThemeID,
		Key:       c.Key,
		Body:      c.Body,
		UpdatedAt: c.UpdatedAt,
	}
}

func uuidPtrToPgtype(u *uuid.UUID) pgtype.UUID {
	if u == nil {
		return pgtype.UUID{}
	}
	return pgtype.UUID{Bytes: *u, Valid: true}
}

func pgtypeUUIDToPtr(u pgtype.UUID) *uuid.UUID {
	if !u.Valid {
		return nil
	}
	id := uuid.UUID(u.Bytes)
	return &id
}
