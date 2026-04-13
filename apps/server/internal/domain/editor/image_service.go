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
	MaxImageFileSize = 5 << 20 // 5MB

	ImageTargetCharacter = "character"
	ImageTargetClue      = "clue"
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
	Target      string    `json:"target"`       // "character" | "clue"
	TargetID    uuid.UUID `json:"target_id"`    // character or clue UUID
	ContentType string    `json:"content_type"` // image/jpeg | image/png | image/webp
	FileSize    int64     `json:"file_size"`    // bytes
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
}

// ImageService handles image upload flow for character avatars and clue images.
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

	if req.Target != ImageTargetCharacter && req.Target != ImageTargetClue {
		return nil, apperror.New(apperror.ErrImageInvalidTarget, 400,
			fmt.Sprintf("target must be %q or %q", ImageTargetCharacter, ImageTargetClue))
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
	storageKey, err := s.buildStorageKey(ctx, themeID, req.Target, req.TargetID, ext)
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
// image_url on the character or clue record.
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
			ID:          char.ID,
			Name:        char.Name,
			Description: char.Description,
			ImageUrl:    pgtype.Text{String: downloadURL, Valid: true},
			IsCulprit:   char.IsCulprit,
			SortOrder:   char.SortOrder,
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
			ClueType:    clue.ClueType,
			SortOrder:   clue.SortOrder,
		})
		if err != nil {
			s.logger.Error().Err(err).Str("clue_id", targetID.String()).Msg("failed to update clue image_url")
			return nil, apperror.Internal("failed to update clue image")
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

	default:
		return "", apperror.New(apperror.ErrImageInvalidTarget, 400, "unknown target")
	}
}

// parseUploadKey extracts the target type and target UUID from a storage key.
// Expected formats:
//
//	themes/{themeId}/characters/{charId}/avatar.{ext}  → "character", charId
//	themes/{themeId}/clues/{clueId}/image.{ext}        → "clue", clueId
func parseUploadKey(key string) (target string, id uuid.UUID, err error) {
	parts := strings.Split(key, "/")
	// themes / {themeId} / characters|clues / {id} / filename
	if len(parts) != 5 || parts[0] != "themes" {
		return "", uuid.Nil, fmt.Errorf("unexpected key format")
	}
	switch parts[2] {
	case "characters":
		target = ImageTargetCharacter
	case "clues":
		target = ImageTargetClue
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
