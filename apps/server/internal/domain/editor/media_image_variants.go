package editor

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"time"

	"github.com/chai2010/webp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/image/draw"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/db"
	"github.com/mmp-platform/server/internal/infra/storage"
)

const (
	imageVariantMimeType       = "image/webp"
	imageVariantMaster         = "master"
	imageVariantPreview        = "preview"
	imageVariantThumbnail      = "thumbnail"
	imageMasterMaxDimension    = 2048
	imagePreviewMaxDimension   = 1280
	imageThumbnailMaxDimension = 360
	imageVariantQuality        = 86
)

type optimizedImageVariant struct {
	name        string
	key         string
	contentType string
	body        []byte
}

func mediaImageVariantKey(themeID, mediaID uuid.UUID, variant string) string {
	return fmt.Sprintf("themes/%s/media/%s/%s.webp", themeID.String(), mediaID.String(), variant)
}

func mediaImageUploadKey(themeID, mediaID uuid.UUID, ext string) string {
	return fmt.Sprintf("themes/%s/media/%s/uploads/original%s", themeID.String(), mediaID.String(), ext)
}

func mediaImageVariantKeysFor(m db.ThemeMedium) []string {
	if m.Type != MediaTypeImage || !m.StorageKey.Valid {
		return nil
	}
	keys := []string{m.StorageKey.String}
	if m.SourceType != SourceTypeFile {
		return keys
	}
	for _, variant := range []string{imageVariantMaster, imageVariantPreview, imageVariantThumbnail} {
		key := mediaImageVariantKey(m.ThemeID, m.ID, variant)
		if key != m.StorageKey.String {
			keys = append(keys, key)
		}
	}
	return dedupeStrings(keys)
}

func dedupeStrings(values []string) []string {
	seen := make(map[string]struct{}, len(values))
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func stringsWithout(values []string, excluded []string) []string {
	excludedSet := make(map[string]struct{}, len(excluded))
	for _, value := range excluded {
		excludedSet[value] = struct{}{}
	}
	out := make([]string, 0, len(values))
	for _, value := range values {
		if _, ok := excludedSet[value]; ok {
			continue
		}
		out = append(out, value)
	}
	return out
}

func optimizeImageVariants(themeID, mediaID uuid.UUID, declaredMime string, payload []byte) ([]optimizedImageVariant, int64, error) {
	img, err := decodeUploadedImage(declaredMime, payload)
	if err != nil {
		return nil, 0, apperror.New(apperror.ErrMediaInvalidType, 422, "failed to decode image")
	}
	specs := []struct {
		name string
		max  int
	}{
		{name: imageVariantMaster, max: imageMasterMaxDimension},
		{name: imageVariantPreview, max: imagePreviewMaxDimension},
		{name: imageVariantThumbnail, max: imageThumbnailMaxDimension},
	}
	var total int64
	variants := make([]optimizedImageVariant, 0, len(specs))
	for _, spec := range specs {
		resized := resizeImageToMax(img, spec.max)
		encoded, err := encodeWebP(resized)
		if err != nil {
			return nil, 0, apperror.Internal("failed to optimize image")
		}
		total += int64(len(encoded))
		variants = append(variants, optimizedImageVariant{
			name:        spec.name,
			key:         mediaImageVariantKey(themeID, mediaID, spec.name),
			contentType: imageVariantMimeType,
			body:        encoded,
		})
	}
	return variants, total, nil
}

func decodeUploadedImage(declaredMime string, payload []byte) (image.Image, error) {
	reader := bytes.NewReader(payload)
	switch declaredMime {
	case "image/jpeg":
		return jpeg.Decode(reader)
	case "image/png":
		return png.Decode(reader)
	case "image/webp":
		return webp.Decode(reader)
	default:
		return nil, fmt.Errorf("unsupported image MIME %s", declaredMime)
	}
}

func resizeImageToMax(src image.Image, maxDimension int) image.Image {
	bounds := src.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()
	if width <= 0 || height <= 0 || maxDimension <= 0 {
		return src
	}
	if width <= maxDimension && height <= maxDimension {
		return src
	}
	nextWidth := maxDimension
	nextHeight := maxDimension
	if width >= height {
		nextHeight = max(1, height*maxDimension/width)
	} else {
		nextWidth = max(1, width*maxDimension/height)
	}
	dst := image.NewRGBA(image.Rect(0, 0, nextWidth, nextHeight))
	draw.CatmullRom.Scale(dst, dst.Bounds(), src, bounds, draw.Over, nil)
	return dst
}

func encodeWebP(img image.Image) ([]byte, error) {
	var buf bytes.Buffer
	err := webp.Encode(&buf, img, &webp.Options{Quality: imageVariantQuality, Exact: true})
	return buf.Bytes(), err
}

func readStorageObject(ctx context.Context, provider storage.Provider, key string, size int64) ([]byte, error) {
	if size <= 0 || size > MaxMediaFileSize {
		return nil, apperror.New(apperror.ErrMediaTooLarge, 422, "uploaded file size mismatch")
	}
	rc, err := provider.GetObjectRange(ctx, key, 0, size)
	if err != nil {
		return nil, err
	}
	defer rc.Close()
	return io.ReadAll(io.LimitReader(rc, size+1))
}

func (s *mediaService) imageVariantDownloadURL(ctx context.Context, media db.ThemeMedium, variant string, fallbackKey string) *string {
	if s.storage == nil || media.Type != MediaTypeImage || media.SourceType != SourceTypeFile || !media.StorageKey.Valid {
		return nil
	}
	key := mediaImageVariantKey(media.ThemeID, media.ID, variant)
	if _, err := s.storage.HeadObject(ctx, key); err != nil {
		if fallbackKey == "" || !errors.Is(err, storage.ErrObjectNotFound) {
			key = media.StorageKey.String
		} else {
			key = fallbackKey
		}
	}
	url, err := s.storage.GenerateDownloadURL(ctx, key, 15*time.Minute)
	if err != nil {
		s.logger.Warn().Err(err).Str("media_id", media.ID.String()).Str("variant", variant).Msg("failed to generate image variant URL")
		return nil
	}
	return &url
}

func imageMediaFileParams(storageKey string, totalSize int64) (pgtype.Text, pgtype.Int8, pgtype.Text) {
	return pgtype.Text{String: storageKey, Valid: true},
		pgtype.Int8{Int64: totalSize, Valid: true},
		pgtype.Text{String: imageVariantMimeType, Valid: true}
}
