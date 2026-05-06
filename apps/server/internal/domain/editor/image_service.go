package editor

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/infra/storage"
)

// Image upload constants.
const (
	MaxImageFileSize = 10 << 20 // 10MB

	ImageTargetCharacter = "character"
	ImageTargetClue      = "clue"
	ImageTargetLocation  = "location"
	ImageTargetCover     = "cover"
)

// AllowedImageMIMEs maps allowed image MIME types to their canonical extension.
var AllowedImageMIMEs = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// ImageUploadResponse is returned by RequestImageUpload.
type ImageUploadResponse struct {
	UploadKey string    `json:"upload_key"`
	UploadURL string    `json:"upload_url"`
	ExpiresAt time.Time `json:"expires_at"`
}

// ImageConfirmResponse is returned by ConfirmImageUpload.
type ImageConfirmResponse struct {
	TargetID uuid.UUID `json:"target_id"`
	Target   string    `json:"target"`
	ImageURL string    `json:"image_url"`
}

// RequestImageUploadRequest is the body for POST .../images/upload-url.
type RequestImageUploadRequest struct {
	Target      string     `json:"target"`       // "character" | "clue" | "location" | "cover"
	TargetID    *uuid.UUID `json:"target_id"`    // character, clue, or location UUID; omitted for "cover"
	ContentType string     `json:"content_type"` // image/jpeg | image/png | image/webp
	FileSize    int64      `json:"file_size"`    // bytes
}

// ConfirmImageUploadRequest is the body for POST .../images/confirm.
type ConfirmImageUploadRequest struct {
	UploadKey string `json:"upload_key"` // key returned by RequestImageUpload
}

// imageQueries is the subset of db.Queries that ImageService depends on.
type imageQueries interface {
	GetTheme(ctx context.Context, id uuid.UUID) (db.Theme, error)
	GetThemeCharacter(ctx context.Context, id uuid.UUID) (db.ThemeCharacter, error)
	UpdateThemeCharacter(ctx context.Context, arg db.UpdateThemeCharacterParams) (db.ThemeCharacter, error)
	GetClue(ctx context.Context, id uuid.UUID) (db.ThemeClue, error)
	UpdateClue(ctx context.Context, arg db.UpdateClueParams) (db.ThemeClue, error)
	GetLocation(ctx context.Context, id uuid.UUID) (db.ThemeLocation, error)
	UpdateLocation(ctx context.Context, arg db.UpdateLocationParams) (db.ThemeLocation, error)
	UpdateThemeCoverImage(ctx context.Context, arg db.UpdateThemeCoverImageParams) error
}

// ImageService handles image upload flow for character, clue, location, and cover images.
type ImageService struct {
	q       imageQueries
	storage storage.Provider
	logger  zerolog.Logger
}

// NewImageService constructs an ImageService.
func NewImageService(q *db.Queries, storageProvider storage.Provider, logger zerolog.Logger) *ImageService {
	return &ImageService{
		q:       q,
		storage: storageProvider,
		logger:  logger.With().Str("domain", "editor.image").Logger(),
	}
}

func (s *ImageService) requireStorage() error {
	if s.storage == nil {
		return apperror.New(apperror.ErrInternal, 503, "image storage is not configured")
	}
	return nil
}

func (s *ImageService) ownedTheme(ctx context.Context, creatorID, themeID uuid.UUID) (db.Theme, error) {
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

// RequestImageUpload validates the request, checks ownership, and returns a
// presigned (or local) upload URL for the image.
func (s *ImageService) RequestImageUpload(
	ctx context.Context,
	userID, themeID uuid.UUID,
	req RequestImageUploadRequest,
) (*ImageUploadResponse, error) {
	if err := s.requireStorage(); err != nil {
		return nil, err
	}

	if req.Target != ImageTargetCharacter && req.Target != ImageTargetClue && req.Target != ImageTargetLocation && req.Target != ImageTargetCover {
		return nil, apperror.New(apperror.ErrImageInvalidTarget, 400,
			fmt.Sprintf("target must be %q, %q, %q, or %q", ImageTargetCharacter, ImageTargetClue, ImageTargetLocation, ImageTargetCover))
	}

	ext, ok := AllowedImageMIMEs[req.ContentType]
	if !ok {
		return nil, apperror.New(apperror.ErrImageInvalidType, 422,
			"content_type must be image/jpeg, image/png, or image/webp")
	}

	if req.FileSize <= 0 || req.FileSize > MaxImageFileSize {
		return nil, apperror.New(apperror.ErrImageTooLarge, 422,
			fmt.Sprintf("file_size must be between 1 and %d bytes", MaxImageFileSize))
	}

	if _, err := s.ownedTheme(ctx, userID, themeID); err != nil {
		return nil, err
	}

	// Verify target exists and belongs to the theme.
	var targetID uuid.UUID
	if req.TargetID != nil {
		targetID = *req.TargetID
	}
	storageKey, err := s.buildStorageKey(ctx, themeID, req.Target, targetID, ext)
	if err != nil {
		return nil, err
	}

	expiry := 5 * time.Minute
	uploadURL, err := s.storage.GenerateUploadURL(ctx, storageKey, req.ContentType, req.FileSize, expiry)
	if err != nil {
		s.logger.Error().Err(err).Str("storage_key", storageKey).Msg("failed to generate image upload URL")
		return nil, apperror.Internal("failed to generate upload URL")
	}

	return &ImageUploadResponse{
		UploadKey: storageKey,
		UploadURL: uploadURL,
		ExpiresAt: time.Now().Add(expiry),
	}, nil
}

// ConfirmImageUpload verifies the upload exists in storage and updates the
// image_url on the target record.
func (s *ImageService) ConfirmImageUpload(
	ctx context.Context,
	userID, themeID uuid.UUID,
	req ConfirmImageUploadRequest,
) (*ImageConfirmResponse, error) {
	if err := s.requireStorage(); err != nil {
		return nil, err
	}
	if _, err := s.ownedTheme(ctx, userID, themeID); err != nil {
		return nil, err
	}

	uploadKey := req.UploadKey
	if uploadKey == "" {
		return nil, apperror.BadRequest("upload_key is required")
	}

	// Verify file was actually uploaded before proceeding.
	if _, err := s.storage.HeadObject(ctx, uploadKey); err != nil {
		return nil, apperror.BadRequest("file has not been uploaded yet")
	}

	// Derive download URL (permanent for R2 CDN; same URL for local).
	downloadURL, err := s.storage.GenerateDownloadURL(ctx, uploadKey, 0)
	if err != nil {
		s.logger.Error().Err(err).Str("key", uploadKey).Msg("failed to generate download URL")
		return nil, apperror.Internal("failed to generate download URL")
	}

	// Parse target and targetID from the key.
	// Key format:
	//   themes/{themeId}/characters/{charId}/avatar.{ext}
	//   themes/{themeId}/clues/{clueId}/image.{ext}
	//   themes/{themeId}/locations/{locationId}/image.{ext}
	target, targetID, err := parseUploadKey(uploadKey)
	if err != nil {
		return nil, apperror.BadRequest("invalid upload_key format")
	}

	// Verify key belongs to this theme.
	if !strings.HasPrefix(uploadKey, fmt.Sprintf("themes/%s/", themeID.String())) {
		return nil, apperror.NotFound("upload key does not belong to this theme")
	}

	switch target {
	case ImageTargetCharacter:
		char, err := s.q.GetThemeCharacter(ctx, targetID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apperror.NotFound("character not found")
			}
			s.logger.Error().Err(err).Str("character_id", targetID.String()).Msg("failed to get character")
			return nil, apperror.Internal("failed to get character")
		}
		if char.ThemeID != themeID {
			return nil, apperror.NotFound("character not found")
		}
		_, err = s.q.UpdateThemeCharacter(ctx, db.UpdateThemeCharacterParams{
			ID:                char.ID,
			Name:              char.Name,
			Description:       char.Description,
			ImageUrl:          pgtype.Text{String: downloadURL, Valid: true},
			IsCulprit:         char.IsCulprit,
			MysteryRole:       char.MysteryRole,
			SortOrder:         char.SortOrder,
			IsPlayable:        char.IsPlayable,
			ShowInIntro:       char.ShowInIntro,
			CanSpeakInReading: char.CanSpeakInReading,
			IsVotingCandidate: char.IsVotingCandidate,
			EndcardTitle:      char.EndcardTitle,
			EndcardBody:       char.EndcardBody,
			EndcardImageUrl:   char.EndcardImageUrl,
			AliasRules:        char.AliasRules,
		})
		if err != nil {
			s.logger.Error().Err(err).Str("character_id", targetID.String()).Msg("failed to update character image_url")
			return nil, apperror.Internal("failed to update character image")
		}

	case ImageTargetClue:
		clue, err := s.q.GetClue(ctx, targetID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apperror.NotFound("clue not found")
			}
			s.logger.Error().Err(err).Str("clue_id", targetID.String()).Msg("failed to get clue")
			return nil, apperror.Internal("failed to get clue")
		}
		if clue.ThemeID != themeID {
			return nil, apperror.NotFound("clue not found")
		}
		_, err = s.q.UpdateClue(ctx, db.UpdateClueParams{
			ID:          clue.ID,
			LocationID:  clue.LocationID,
			Name:        clue.Name,
			Description: clue.Description,
			ImageUrl:    pgtype.Text{String: downloadURL, Valid: true},
			IsCommon:    clue.IsCommon,
			Level:       clue.Level,
			SortOrder:   clue.SortOrder,
			IsUsable:    clue.IsUsable,
			UseEffect:   clue.UseEffect,
			UseTarget:   clue.UseTarget,
			UseConsumed: clue.UseConsumed,
			RevealRound: clue.RevealRound,
			HideRound:   clue.HideRound,
		})
		if err != nil {
			s.logger.Error().Err(err).Str("clue_id", targetID.String()).Msg("failed to update clue image_url")
			return nil, apperror.Internal("failed to update clue image")
		}

	case ImageTargetLocation:
		loc, err := s.q.GetLocation(ctx, targetID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, apperror.NotFound("location not found")
			}
			s.logger.Error().Err(err).Str("location_id", targetID.String()).Msg("failed to get location")
			return nil, apperror.Internal("failed to get location")
		}
		if loc.ThemeID != themeID {
			return nil, apperror.NotFound("location not found")
		}
		_, err = s.q.UpdateLocation(ctx, db.UpdateLocationParams{
			ID:                   loc.ID,
			Name:                 loc.Name,
			RestrictedCharacters: loc.RestrictedCharacters,
			SortOrder:            loc.SortOrder,
			FromRound:            loc.FromRound,
			UntilRound:           loc.UntilRound,
			ImageUrl:             pgtype.Text{String: downloadURL, Valid: true},
			ImageMediaID:         loc.ImageMediaID,
		})
		if err != nil {
			s.logger.Error().Err(err).Str("location_id", targetID.String()).Msg("failed to update location image_url")
			return nil, apperror.Internal("failed to update location image")
		}

	case ImageTargetCover:
		err = s.q.UpdateThemeCoverImage(ctx, db.UpdateThemeCoverImageParams{
			ID:         themeID,
			CoverImage: pgtype.Text{String: downloadURL, Valid: true},
		})
		if err != nil {
			s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to update theme cover_image")
			return nil, apperror.Internal("failed to update theme cover image")
		}

	default:
		return nil, apperror.BadRequest("unrecognized upload key target")
	}

	return &ImageConfirmResponse{
		TargetID: targetID,
		Target:   target,
		ImageURL: downloadURL,
	}, nil
}

// buildStorageKey constructs the storage key and verifies the target belongs
// to the given theme.
func (s *ImageService) buildStorageKey(
	ctx context.Context,
	themeID uuid.UUID,
	target string,
	targetID uuid.UUID,
	ext string,
) (string, error) {
	switch target {
	case ImageTargetCharacter:
		char, err := s.q.GetThemeCharacter(ctx, targetID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return "", apperror.NotFound("character not found")
			}
			s.logger.Error().Err(err).Str("character_id", targetID.String()).Msg("failed to get character")
			return "", apperror.Internal("failed to get character")
		}
		if char.ThemeID != themeID {
			return "", apperror.NotFound("character not found")
		}
		return fmt.Sprintf("themes/%s/characters/%s/avatar%s", themeID, targetID, ext), nil

	case ImageTargetClue:
		clue, err := s.q.GetClue(ctx, targetID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return "", apperror.NotFound("clue not found")
			}
			s.logger.Error().Err(err).Str("clue_id", targetID.String()).Msg("failed to get clue")
			return "", apperror.Internal("failed to get clue")
		}
		if clue.ThemeID != themeID {
			return "", apperror.NotFound("clue not found")
		}
		return fmt.Sprintf("themes/%s/clues/%s/image%s", themeID, targetID, ext), nil

	case ImageTargetLocation:
		loc, err := s.q.GetLocation(ctx, targetID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return "", apperror.NotFound("location not found")
			}
			s.logger.Error().Err(err).Str("location_id", targetID.String()).Msg("failed to get location")
			return "", apperror.Internal("failed to get location")
		}
		if loc.ThemeID != themeID {
			return "", apperror.NotFound("location not found")
		}
		return fmt.Sprintf("themes/%s/locations/%s/image%s", themeID, targetID, ext), nil

	case ImageTargetCover:
		return fmt.Sprintf("themes/%s/cover%s", themeID, ext), nil

	default:
		return "", apperror.New(apperror.ErrImageInvalidTarget, 400, "unknown target")
	}
}

// parseUploadKey extracts the target type and target UUID from a storage key.
// Expected formats:
//
//	themes/{themeId}/characters/{charId}/avatar.{ext}  → "character", charId
//	themes/{themeId}/clues/{clueId}/image.{ext}        → "clue", clueId
//	themes/{themeId}/locations/{locationId}/image.{ext} → "location", locationId
//	themes/{themeId}/cover.{ext}                       → "cover", themeId
func parseUploadKey(key string) (target string, id uuid.UUID, err error) {
	parts := strings.Split(key, "/")
	if len(parts) < 3 || parts[0] != "themes" {
		return "", uuid.Nil, fmt.Errorf("unexpected key format")
	}

	// Cover: themes/{themeId}/cover.{ext}
	if len(parts) == 3 && strings.HasPrefix(parts[2], "cover") {
		themeID, parseErr := uuid.Parse(parts[1])
		if parseErr != nil {
			return "", uuid.Nil, fmt.Errorf("invalid theme uuid in key: %w", parseErr)
		}
		return ImageTargetCover, themeID, nil
	}

	// characters/clues/locations: themes / {themeId} / characters|clues|locations / {id} / filename
	if len(parts) != 5 {
		return "", uuid.Nil, fmt.Errorf("unexpected key format")
	}
	switch parts[2] {
	case "characters":
		target = ImageTargetCharacter
	case "clues":
		target = ImageTargetClue
	case "locations":
		target = ImageTargetLocation
	default:
		return "", uuid.Nil, fmt.Errorf("unknown target segment: %s", parts[2])
	}
	// Strip extension from the ID segment (it is actually the filename, not the ID — ID is parts[3]).
	id, err = uuid.Parse(parts[3])
	if err != nil {
		return "", uuid.Nil, fmt.Errorf("invalid target uuid in key: %w", err)
	}
	_ = filepath.Ext(parts[4]) // just for documentation clarity
	return target, id, nil
}
