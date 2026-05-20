package editor

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/infra/storage"
)

func (s *mediaService) RequestReplacementUpload(ctx context.Context, creatorID, mediaID uuid.UUID, req RequestMediaReplacementUploadRequest) (*UploadURLResponse, error) {
	if err := s.requireStorage(); err != nil {
		return nil, err
	}
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
	if media.SourceType != SourceTypeFile {
		return nil, apperror.New(apperror.ErrMediaInvalidType, 422, "only file media can be replaced")
	}
	ext, ok := uploadExtensionFor(media.Type, req.MimeType)
	if !ok {
		return nil, apperror.New(apperror.ErrMediaInvalidType, 422, "unsupported mime type")
	}
	if req.FileSize > MaxMediaFileSize {
		return nil, apperror.New(apperror.ErrMediaTooLarge, 422, "file exceeds maximum size")
	}

	uploadID := uuid.New()
	storageKey := fmt.Sprintf("themes/%s/media/%s/replacements/%s%s", media.ThemeID.String(), mediaID.String(), uploadID.String(), ext)
	pending, err := s.q.CreateMediaReplacementUpload(ctx, db.CreateMediaReplacementUploadParams{
		MediaID:    mediaID,
		StorageKey: storageKey,
		FileSize:   req.FileSize,
		MimeType:   req.MimeType,
		CreatorID:  creatorID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to create media replacement upload")
		return nil, apperror.Internal("failed to create media replacement upload")
	}

	expiry := 5 * time.Minute
	uploadURL, err := s.storage.GenerateUploadURL(ctx, storageKey, req.MimeType, req.FileSize, expiry)
	if err != nil {
		s.logger.Error().Err(err).Str("storage_key", storageKey).Msg("failed to generate replacement upload URL")
		cleanupCtx, cancel := storageCleanupContext(ctx)
		defer cancel()
		_ = s.q.DeleteMediaReplacementUpload(cleanupCtx, pending.ID)
		return nil, apperror.Internal("failed to generate upload URL")
	}
	return &UploadURLResponse{UploadID: pending.ID, UploadURL: uploadURL, ExpiresAt: time.Now().Add(expiry)}, nil
}

func (s *mediaService) UploadReplacementObject(ctx context.Context, creatorID, mediaID, uploadID uuid.UUID, body io.Reader) error {
	if err := s.requireStorage(); err != nil {
		return err
	}
	pending, err := s.q.GetMediaReplacementUploadWithOwner(ctx, db.GetMediaReplacementUploadWithOwnerParams{
		ID:        uploadID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.NotFound("replacement upload not found")
		}
		s.logger.Error().Err(err).Str("upload_id", uploadID.String()).Msg("failed to get replacement upload")
		return apperror.Internal("failed to get replacement upload")
	}
	if pending.MediaID != mediaID {
		return apperror.NotFound("replacement upload not found")
	}
	if pending.FileSize <= 0 || pending.FileSize > MaxMediaFileSize {
		return apperror.New(apperror.ErrMediaTooLarge, 422, "file exceeds maximum size")
	}
	payload, err := io.ReadAll(io.LimitReader(body, pending.FileSize+1))
	if err != nil {
		return apperror.Internal("failed to read upload body")
	}
	if int64(len(payload)) != pending.FileSize {
		cleanupCtx, cancel := storageCleanupContext(ctx)
		defer cancel()
		_ = s.storage.DeleteObject(cleanupCtx, pending.StorageKey)
		return apperror.New(apperror.ErrMediaTooLarge, 422, "uploaded file size mismatch")
	}
	if err := s.storage.PutObject(ctx, pending.StorageKey, bytes.NewReader(payload), pending.MimeType, pending.FileSize); err != nil {
		s.logger.Error().Err(err).Str("storage_key", pending.StorageKey).Msg("failed to upload replacement object through server")
		return apperror.Internal("failed to upload replacement object")
	}
	meta, err := s.storage.HeadObject(ctx, pending.StorageKey)
	if err != nil {
		s.logger.Error().Err(err).Str("storage_key", pending.StorageKey).Msg("failed to verify server-uploaded replacement object")
		return apperror.Internal("failed to verify upload")
	}
	if meta.Size != pending.FileSize {
		cleanupCtx, cancel := storageCleanupContext(ctx)
		defer cancel()
		_ = s.storage.DeleteObject(cleanupCtx, pending.StorageKey)
		return apperror.New(apperror.ErrMediaTooLarge, 422, "uploaded file size mismatch")
	}
	return nil
}

func (s *mediaService) ConfirmReplacementUpload(ctx context.Context, creatorID, mediaID uuid.UUID, req ConfirmUploadRequest) (*MediaResponse, error) {
	if err := s.requireStorage(); err != nil {
		return nil, err
	}
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
	pending, err := s.q.GetMediaReplacementUploadWithOwner(ctx, db.GetMediaReplacementUploadWithOwnerParams{
		ID:        req.UploadID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("replacement upload not found")
		}
		s.logger.Error().Err(err).Str("upload_id", req.UploadID.String()).Msg("failed to get replacement upload")
		return nil, apperror.Internal("failed to get replacement upload")
	}
	if pending.MediaID != mediaID {
		return nil, apperror.NotFound("replacement upload not found")
	}

	if err := s.verifyUploadedObject(ctx, pending.StorageKey, pending.FileSize, pending.MimeType, media.Type); err != nil {
		cleanupCtx, cancel := storageCleanupContext(ctx)
		defer cancel()
		_ = s.storage.DeleteObject(cleanupCtx, pending.StorageKey)
		_ = s.q.DeleteMediaReplacementUpload(cleanupCtx, pending.ID)
		return nil, err
	}
	if media.Type == MediaTypeImage {
		return s.confirmImageReplacementUpload(ctx, creatorID, media, pending)
	}

	oldStorageKey := ""
	if media.StorageKey.Valid {
		oldStorageKey = media.StorageKey.String
	}
	updated, err := s.q.UpdateMediaFileWithOwner(ctx, db.UpdateMediaFileWithOwnerParams{
		ID:         mediaID,
		CreatorID:  creatorID,
		StorageKey: pgtype.Text{String: pending.StorageKey, Valid: true},
		FileSize:   pgtype.Int8{Int64: pending.FileSize, Valid: true},
		MimeType:   pgtype.Text{String: pending.MimeType, Valid: true},
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to replace media file")
		return nil, apperror.Internal("failed to replace media file")
	}
	cleanupCtx, cancel := storageCleanupContext(ctx)
	defer cancel()
	_ = s.q.DeleteMediaReplacementUpload(cleanupCtx, pending.ID)
	if oldStorageKey != "" && oldStorageKey != pending.StorageKey {
		if delErr := s.storage.DeleteObject(cleanupCtx, oldStorageKey); delErr != nil {
			s.logger.Warn().Err(delErr).Str("storage_key", oldStorageKey).Msg("failed to delete old media object")
		}
	}
	resp := toMediaResponse(updated)
	return &resp, nil
}

func (s *mediaService) confirmImageReplacementUpload(ctx context.Context, creatorID uuid.UUID, media db.ThemeMedium, pending db.ThemeMediaReplacementUpload) (*MediaResponse, error) {
	payload, err := readStorageObject(ctx, s.storage, pending.StorageKey, pending.FileSize)
	if err != nil {
		s.logger.Error().Err(err).Str("storage_key", pending.StorageKey).Msg("failed to read replacement image")
		cleanupCtx, cancel := storageCleanupContext(ctx)
		defer cancel()
		_ = s.storage.DeleteObject(cleanupCtx, pending.StorageKey)
		_ = s.q.DeleteMediaReplacementUpload(cleanupCtx, pending.ID)
		return nil, apperror.Internal("failed to read replacement image")
	}
	if int64(len(payload)) != pending.FileSize {
		cleanupCtx, cancel := storageCleanupContext(ctx)
		defer cancel()
		_ = s.storage.DeleteObject(cleanupCtx, pending.StorageKey)
		_ = s.q.DeleteMediaReplacementUpload(cleanupCtx, pending.ID)
		return nil, apperror.New(apperror.ErrMediaTooLarge, 422, "uploaded file size mismatch")
	}
	variants, totalSize, err := optimizeImageVariants(media.ThemeID, media.ID, pending.MimeType, payload)
	if err != nil {
		cleanupCtx, cancel := storageCleanupContext(ctx)
		defer cancel()
		_ = s.storage.DeleteObject(cleanupCtx, pending.StorageKey)
		_ = s.q.DeleteMediaReplacementUpload(cleanupCtx, pending.ID)
		return nil, err
	}
	writtenKeys := make([]string, 0, len(variants))
	for _, variant := range variants {
		if err := s.storage.PutObject(ctx, variant.key, bytes.NewReader(variant.body), variant.contentType, int64(len(variant.body))); err != nil {
			s.logger.Error().Err(err).Str("storage_key", variant.key).Msg("failed to store replacement image variant")
			cleanupCtx, cancel := storageCleanupContext(ctx)
			defer cancel()
			_ = s.storage.DeleteObjects(cleanupCtx, append(writtenKeys, pending.StorageKey))
			_ = s.q.DeleteMediaReplacementUpload(cleanupCtx, pending.ID)
			return nil, apperror.Internal("failed to optimize image")
		}
		writtenKeys = append(writtenKeys, variant.key)
	}
	oldKeys := stringsWithout(mediaImageVariantKeysFor(media), writtenKeys)
	masterKey := mediaImageVariantKey(media.ThemeID, media.ID, imageVariantMaster)
	storageParam, sizeParam, mimeParam := imageMediaFileParams(masterKey, totalSize)
	updated, err := s.q.UpdateMediaFileWithOwner(ctx, db.UpdateMediaFileWithOwnerParams{
		ID:         media.ID,
		CreatorID:  creatorID,
		StorageKey: storageParam,
		FileSize:   sizeParam,
		MimeType:   mimeParam,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", media.ID.String()).Msg("failed to replace optimized image")
		cleanupCtx, cancel := storageCleanupContext(ctx)
		defer cancel()
		_ = s.storage.DeleteObjects(cleanupCtx, append(writtenKeys, pending.StorageKey))
		return nil, apperror.Internal("failed to replace media file")
	}
	cleanupCtx, cancel := storageCleanupContext(ctx)
	defer cancel()
	_ = s.q.DeleteMediaReplacementUpload(cleanupCtx, pending.ID)
	_ = s.storage.DeleteObject(cleanupCtx, pending.StorageKey)
	if len(oldKeys) > 0 {
		if delErr := s.storage.DeleteObjects(cleanupCtx, oldKeys); delErr != nil {
			s.logger.Warn().Err(delErr).Str("media_id", media.ID.String()).Msg("failed to delete old image variants")
		}
	}
	resp := s.toMediaResponse(ctx, updated)
	return &resp, nil
}

func (s *mediaService) verifyUploadedObject(ctx context.Context, storageKey string, declaredSize int64, declaredMime string, mediaType string) error {
	meta, err := s.storage.HeadObject(ctx, storageKey)
	if err != nil {
		if errors.Is(err, storage.ErrObjectNotFound) {
			return apperror.New(apperror.ErrMediaUploadExpired, 410, "upload expired or missing")
		}
		s.logger.Error().Err(err).Str("storage_key", storageKey).Msg("failed to head object")
		return apperror.Internal("failed to verify upload")
	}
	if meta.Size != declaredSize || meta.Size > MaxMediaFileSize {
		return apperror.New(apperror.ErrMediaTooLarge, 422, "uploaded file size mismatch")
	}
	rc, err := s.storage.GetObjectRange(ctx, storageKey, 0, 512)
	if err != nil {
		s.logger.Error().Err(err).Str("storage_key", storageKey).Msg("failed to read object header")
		return apperror.Internal("failed to verify upload")
	}
	header, readErr := io.ReadAll(io.LimitReader(rc, 512))
	_ = rc.Close()
	if readErr != nil {
		s.logger.Error().Err(readErr).Str("storage_key", storageKey).Msg("failed to read object header bytes")
		return apperror.Internal("failed to verify upload")
	}
	return validateMediaMagicBytes(header, mediaType, declaredMime)
}
