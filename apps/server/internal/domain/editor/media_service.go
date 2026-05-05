package editor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
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

// MediaService manages theme audio assets (file uploads + YouTube embeds).
type MediaService interface {
	ListMedia(ctx context.Context, creatorID, themeID uuid.UUID, mediaType string) ([]MediaResponse, error)
	RequestUpload(ctx context.Context, creatorID, themeID uuid.UUID, req RequestMediaUploadRequest) (*UploadURLResponse, error)
	ConfirmUpload(ctx context.Context, creatorID, themeID uuid.UUID, req ConfirmUploadRequest) (*MediaResponse, error)
	CreateYouTube(ctx context.Context, creatorID, themeID uuid.UUID, req CreateMediaYouTubeRequest) (*MediaResponse, error)
	UpdateMedia(ctx context.Context, creatorID, mediaID uuid.UUID, req UpdateMediaRequest) (*MediaResponse, error)
	DeleteMedia(ctx context.Context, creatorID, mediaID uuid.UUID) error
	GetEditorMediaDownloadURL(ctx context.Context, creatorID, mediaID uuid.UUID) (*MediaDownloadURLResponse, error)
	GetMediaPlayURL(ctx context.Context, sessionID, mediaID uuid.UUID) (string, error)
	ResolveMediaURL(ctx context.Context, sessionID, mediaID uuid.UUID, allowedTypes ...string) (string, string, error)
}

// mediaQueries is the subset of db.Queries that mediaService depends on.
// Defined as an interface so unit tests can substitute a fake implementation
// without spinning up Postgres.
type mediaQueries interface {
	GetTheme(ctx context.Context, id uuid.UUID) (db.Theme, error)
	GetMedia(ctx context.Context, id uuid.UUID) (db.ThemeMedium, error)
	GetMediaForSession(ctx context.Context, arg db.GetMediaForSessionParams) (db.ThemeMedium, error)
	GetMediaWithOwner(ctx context.Context, arg db.GetMediaWithOwnerParams) (db.ThemeMedium, error)
	ListMediaByTheme(ctx context.Context, themeID uuid.UUID) ([]db.ThemeMedium, error)
	ListMediaByThemeAndType(ctx context.Context, arg db.ListMediaByThemeAndTypeParams) ([]db.ThemeMedium, error)
	CountMediaByTheme(ctx context.Context, themeID uuid.UUID) (int64, error)
	SumMediaSizeByTheme(ctx context.Context, themeID uuid.UUID) (int64, error)
	SumMediaSizeByCreator(ctx context.Context, creatorID uuid.UUID) (int64, error)
	CreateMedia(ctx context.Context, arg db.CreateMediaParams) (db.ThemeMedium, error)
	UpdateMedia(ctx context.Context, arg db.UpdateMediaParams) (db.ThemeMedium, error)
	DeleteMedia(ctx context.Context, id uuid.UUID) error
	DeleteMediaWithOwner(ctx context.Context, arg db.DeleteMediaWithOwnerParams) (int64, error)
	FindMediaReferencesInReadingSections(ctx context.Context, arg db.FindMediaReferencesInReadingSectionsParams) ([]db.FindMediaReferencesInReadingSectionsRow, error)
	FindRoleSheetReferencesForMedia(ctx context.Context, arg db.FindRoleSheetReferencesForMediaParams) ([]db.FindRoleSheetReferencesForMediaRow, error)
}

type mediaService struct {
	q       mediaQueries
	storage storage.Provider
	logger  zerolog.Logger
}

// NewMediaService constructs a MediaService.
// Theme ownership checks are performed directly via db.Queries to minimize the dependency surface.
func NewMediaService(q *db.Queries, storageProvider storage.Provider, logger zerolog.Logger) MediaService {
	return newMediaServiceWith(q, storageProvider, logger)
}

// newMediaServiceWith is the test-friendly constructor that accepts the
// narrower mediaQueries interface so a fake can be injected.
func newMediaServiceWith(q mediaQueries, storageProvider storage.Provider, logger zerolog.Logger) *mediaService {
	return &mediaService{
		q:       q,
		storage: storageProvider,
		logger:  logger.With().Str("domain", "editor.media").Logger(),
	}
}

// --- ownership helpers ---

func (s *mediaService) ownedTheme(ctx context.Context, creatorID, themeID uuid.UUID) (db.Theme, error) {
	theme, err := s.q.GetTheme(ctx, themeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Theme{}, apperror.NotFound("theme not found")
		}
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to get theme")
		return db.Theme{}, apperror.Internal("failed to get theme")
	}
	if theme.CreatorID != creatorID {
		// Return NotFound (not Forbidden) to avoid information disclosure — matches editor.getOwnedTheme pattern.
		return db.Theme{}, apperror.NotFound("theme not found")
	}
	return theme, nil
}

// requireStorage returns an error if the storage provider is not configured.
// Used to guard file-upload operations when R2 credentials are absent (e.g., local dev).
func (s *mediaService) requireStorage() error {
	if s.storage == nil {
		return apperror.New(apperror.ErrInternal, 503, "media storage is not configured")
	}
	return nil
}

// --- ListMedia ---

func (s *mediaService) ListMedia(ctx context.Context, creatorID, themeID uuid.UUID, mediaType string) ([]MediaResponse, error) {
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	var rows []db.ThemeMedium
	var err error
	if mediaType == "" {
		rows, err = s.q.ListMediaByTheme(ctx, themeID)
	} else {
		rows, err = s.q.ListMediaByThemeAndType(ctx, db.ListMediaByThemeAndTypeParams{
			ThemeID: themeID,
			Type:    mediaType,
		})
	}
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to list media")
		return nil, apperror.Internal("failed to list media")
	}

	out := make([]MediaResponse, 0, len(rows))
	for _, m := range rows {
		out = append(out, toMediaResponse(m))
	}
	return out, nil
}

// --- RequestUpload ---

func (s *mediaService) RequestUpload(ctx context.Context, creatorID, themeID uuid.UUID, req RequestMediaUploadRequest) (*UploadURLResponse, error) {
	// VIDEO type is YOUTUBE-only in Phase 7.7 (FileVideoPlayer not implemented).
	// Reject early before storage/ownership checks so the error is deterministic.
	if req.Type == MediaTypeVideo {
		return nil, apperror.New(apperror.ErrMediaInvalidType, 400, "VIDEO type requires YOUTUBE source in Phase 7.7")
	}
	if err := s.requireStorage(); err != nil {
		return nil, err
	}
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	ext, ok := uploadExtensionFor(req.Type, req.MimeType)
	if !ok {
		return nil, apperror.New(apperror.ErrMediaInvalidType, 422, "unsupported mime type")
	}
	if req.FileSize > MaxMediaFileSize {
		return nil, apperror.New(apperror.ErrMediaTooLarge, 422, "file exceeds maximum size")
	}

	count, err := s.q.CountMediaByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to count media")
		return nil, apperror.Internal("failed to count media")
	}
	if count >= MaxMediaPerTheme {
		return nil, apperror.New(apperror.ErrMediaLimitExceeded, 422, "media count limit exceeded")
	}

	themeUsed, err := s.q.SumMediaSizeByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to sum theme media size")
		return nil, apperror.Internal("failed to compute storage usage")
	}
	if themeUsed+req.FileSize > MaxStoragePerTheme {
		return nil, apperror.New(apperror.ErrMediaStorageFull, 422, "theme storage quota exceeded")
	}

	creatorUsed, err := s.q.SumMediaSizeByCreator(ctx, creatorID)
	if err != nil {
		s.logger.Error().Err(err).Str("creator_id", creatorID.String()).Msg("failed to sum creator media size")
		return nil, apperror.Internal("failed to compute storage usage")
	}
	if creatorUsed+req.FileSize > MaxStoragePerUser {
		return nil, apperror.New(apperror.ErrMediaStorageFull, 422, "user storage quota exceeded")
	}

	mediaID := uuid.New()
	storageKey := fmt.Sprintf("themes/%s/media/%s%s", themeID.String(), mediaID.String(), ext)

	created, err := s.q.CreateMedia(ctx, db.CreateMediaParams{
		ThemeID:    themeID,
		Name:       req.Name,
		Type:       req.Type,
		SourceType: SourceTypeFile,
		Url:        pgtype.Text{},
		StorageKey: pgtype.Text{String: storageKey, Valid: true},
		Duration:   pgtype.Int4{},
		FileSize:   pgtype.Int8{Int64: req.FileSize, Valid: true},
		MimeType:   pgtype.Text{String: req.MimeType, Valid: true},
		Tags:       []string{},
		SortOrder:  0,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to create media row")
		return nil, apperror.Internal("failed to create media record")
	}

	expiry := 5 * time.Minute
	uploadURL, err := s.storage.GenerateUploadURL(ctx, storageKey, req.MimeType, req.FileSize, expiry)
	if err != nil {
		s.logger.Error().Err(err).Str("storage_key", storageKey).Msg("failed to generate upload URL")
		// best-effort rollback — use WithoutCancel so rollback survives upstream ctx cancellation.
		cleanupCtx := context.WithoutCancel(ctx)
		if delErr := s.q.DeleteMedia(cleanupCtx, created.ID); delErr != nil {
			s.logger.Error().Err(delErr).Str("media_id", created.ID.String()).Msg("failed to rollback media row")
		}
		return nil, apperror.Internal("failed to generate upload URL")
	}

	return &UploadURLResponse{
		UploadID:  created.ID,
		UploadURL: uploadURL,
		ExpiresAt: time.Now().Add(expiry),
	}, nil
}

// --- ConfirmUpload ---

func (s *mediaService) ConfirmUpload(ctx context.Context, creatorID, themeID uuid.UUID, req ConfirmUploadRequest) (*MediaResponse, error) {
	if err := s.requireStorage(); err != nil {
		return nil, err
	}
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	media, err := s.q.GetMediaWithOwner(ctx, db.GetMediaWithOwnerParams{
		ID:        req.UploadID,
		CreatorID: creatorID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NotFound("upload not found")
		}
		s.logger.Error().Err(err).Str("media_id", req.UploadID.String()).Msg("failed to get media")
		return nil, apperror.Internal("failed to get media")
	}
	if media.ThemeID != themeID {
		return nil, apperror.NotFound("upload not found")
	}
	if media.SourceType != SourceTypeFile || !media.StorageKey.Valid {
		return nil, apperror.New(apperror.ErrMediaInvalidType, 422, "media is not a file upload")
	}

	storageKey := media.StorageKey.String
	declaredSize := media.FileSize.Int64
	declaredMime := media.MimeType.String

	meta, err := s.storage.HeadObject(ctx, storageKey)
	if err != nil {
		if errors.Is(err, storage.ErrObjectNotFound) {
			s.logger.Warn().Str("storage_key", storageKey).Msg("upload not found in storage")
			_ = s.q.DeleteMedia(ctx, media.ID)
			return nil, apperror.New(apperror.ErrMediaUploadExpired, 410, "upload expired or missing")
		}
		s.logger.Error().Err(err).Str("storage_key", storageKey).Msg("failed to head object")
		return nil, apperror.Internal("failed to verify upload")
	}
	if meta.Size != declaredSize {
		s.logger.Warn().
			Str("storage_key", storageKey).
			Int64("declared", declaredSize).
			Int64("actual", meta.Size).
			Msg("upload size mismatch")
		cleanupCtx := context.WithoutCancel(ctx)
		_ = s.storage.DeleteObject(cleanupCtx, storageKey)
		_ = s.q.DeleteMedia(cleanupCtx, media.ID)
		return nil, apperror.New(apperror.ErrMediaTooLarge, 422, "uploaded file size mismatch")
	}
	// Post-upload hard cap: reject files above the absolute maximum even if declared smaller.
	if meta.Size > MaxMediaFileSize {
		cleanupCtx := context.WithoutCancel(ctx)
		_ = s.storage.DeleteObject(cleanupCtx, storageKey)
		_ = s.q.DeleteMedia(cleanupCtx, media.ID)
		return nil, apperror.New(apperror.ErrMediaTooLarge, 422, "uploaded file exceeds maximum size")
	}

	rc, err := s.storage.GetObjectRange(ctx, storageKey, 0, 512)
	if err != nil {
		s.logger.Error().Err(err).Str("storage_key", storageKey).Msg("failed to read object header")
		return nil, apperror.Internal("failed to verify upload")
	}
	header, err := io.ReadAll(io.LimitReader(rc, 512))
	_ = rc.Close()
	if err != nil {
		s.logger.Error().Err(err).Str("storage_key", storageKey).Msg("failed to read object header bytes")
		return nil, apperror.Internal("failed to verify upload")
	}

	if err := validateMediaMagicBytes(header, media.Type, declaredMime); err != nil {
		s.logger.Warn().Str("storage_key", storageKey).Str("mime", declaredMime).Msg("magic bytes mismatch")
		cleanupCtx := context.WithoutCancel(ctx)
		_ = s.storage.DeleteObject(cleanupCtx, storageKey)
		_ = s.q.DeleteMedia(cleanupCtx, media.ID)
		return nil, err
	}

	resp := toMediaResponse(media)
	return &resp, nil
}

// --- CreateYouTube ---

func (s *mediaService) CreateYouTube(ctx context.Context, creatorID, themeID uuid.UUID, req CreateMediaYouTubeRequest) (*MediaResponse, error) {
	if _, err := s.ownedTheme(ctx, creatorID, themeID); err != nil {
		return nil, err
	}

	videoID := parseYouTubeVideoID(req.URL)
	if videoID == "" {
		return nil, apperror.New(apperror.ErrMediaInvalidURL, 400, "invalid YouTube URL")
	}

	count, err := s.q.CountMediaByTheme(ctx, themeID)
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to count media")
		return nil, apperror.Internal("failed to count media")
	}
	if count >= MaxMediaPerTheme {
		return nil, apperror.New(apperror.ErrMediaLimitExceeded, 422, "media count limit exceeded")
	}

	embed, err := fetchYouTubeOEmbed(ctx, videoID)
	if err != nil {
		s.logger.Error().Err(err).Str("video_id", videoID).Msg("failed to fetch youtube oembed")
		return nil, apperror.New(apperror.ErrMediaOEmbedFailed, 502, "failed to fetch YouTube metadata")
	}

	name := req.Name
	if name == "" && embed.Title != "" {
		name = embed.Title
	}

	canonicalURL := fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID)

	created, err := s.q.CreateMedia(ctx, db.CreateMediaParams{
		ThemeID:    themeID,
		Name:       name,
		Type:       req.Type,
		SourceType: SourceTypeYouTube,
		Url:        pgtype.Text{String: canonicalURL, Valid: true},
		StorageKey: pgtype.Text{},
		Duration:   pgtype.Int4{},
		FileSize:   pgtype.Int8{},
		MimeType:   pgtype.Text{},
		Tags:       []string{},
		SortOrder:  0,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("theme_id", themeID.String()).Msg("failed to create youtube media")
		return nil, apperror.Internal("failed to create media record")
	}

	resp := toMediaResponse(created)
	return &resp, nil
}

// --- UpdateMedia ---

func (s *mediaService) UpdateMedia(ctx context.Context, creatorID, mediaID uuid.UUID, req UpdateMediaRequest) (*MediaResponse, error) {
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

	if req.Type != media.Type {
		return nil, apperror.New(apperror.ErrMediaInvalidType, 422, "media type cannot be changed")
	}

	tags := req.Tags
	if tags == nil {
		tags = []string{}
	}

	var duration pgtype.Int4
	if req.Duration != nil {
		duration = pgtype.Int4{Int32: *req.Duration, Valid: true}
	} else if media.Duration.Valid {
		duration = media.Duration
	}

	updated, err := s.q.UpdateMedia(ctx, db.UpdateMediaParams{
		ID:        mediaID,
		Name:      req.Name,
		Type:      req.Type,
		Duration:  duration,
		Tags:      tags,
		SortOrder: req.SortOrder,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to update media")
		return nil, apperror.Internal("failed to update media")
	}

	resp := toMediaResponse(updated)
	return &resp, nil
}

// --- DeleteMedia ---

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

	// Block deletion if the media is referenced by any reading section
	// (either as bgmMediaId or inside a line's voiceMediaId).
	refs, err := s.q.FindMediaReferencesInReadingSections(ctx, db.FindMediaReferencesInReadingSectionsParams{
		ThemeID: media.ThemeID,
		MediaID: mediaID,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check media references")
		return apperror.Internal("failed to check media references")
	}
	if len(refs) > 0 {
		refList := make([]map[string]string, len(refs))
		for i, r := range refs {
			refList[i] = map[string]string{
				"type": "reading_section",
				"id":   r.ID.String(),
				"name": r.Name,
			}
		}
		return apperror.New(apperror.ErrMediaReferenceInUse, 409, "media is referenced by reading sections").
			WithParams(map[string]any{"references": refList})
	}

	roleSheetRefs, err := s.q.FindRoleSheetReferencesForMedia(ctx, db.FindRoleSheetReferencesForMediaParams{
		ThemeID: media.ThemeID,
		Body:    `"media_id"\s*:\s*"` + mediaID.String() + `"`,
	})
	if err != nil {
		s.logger.Error().Err(err).Str("media_id", mediaID.String()).Msg("failed to check role sheet references")
		return apperror.Internal("failed to check media references")
	}
	if len(roleSheetRefs) > 0 {
		refList := make([]map[string]string, len(roleSheetRefs))
		for i, r := range roleSheetRefs {
			refList[i] = map[string]string{
				"type": "role_sheet",
				"id":   r.Key,
				"name": r.Key,
			}
		}
		return apperror.New(apperror.ErrMediaReferenceInUse, 409, "media is referenced by role sheets").
			WithParams(map[string]any{"references": refList})
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

// --- GetEditorMediaDownloadURL ---

func (s *mediaService) GetEditorMediaDownloadURL(ctx context.Context, creatorID, mediaID uuid.UUID) (*MediaDownloadURLResponse, error) {
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
	if media.SourceType != SourceTypeFile || !media.StorageKey.Valid {
		return nil, apperror.New(apperror.ErrMediaInvalidType, 422, "media is not a file upload")
	}
	if err := s.requireStorage(); err != nil {
		return nil, err
	}
	expiry := 15 * time.Minute
	url, err := s.storage.GenerateDownloadURL(ctx, media.StorageKey.String, expiry)
	if err != nil {
		s.logger.Error().Err(err).Str("storage_key", media.StorageKey.String).Msg("failed to generate download URL")
		return nil, apperror.Internal("failed to generate download URL")
	}
	return &MediaDownloadURLResponse{URL: url, ExpiresAt: time.Now().Add(expiry)}, nil
}

// --- GetMediaPlayURL ---

func (s *mediaService) GetMediaPlayURL(ctx context.Context, sessionID, mediaID uuid.UUID) (string, error) {
	url, _, err := s.ResolveMediaURL(ctx, sessionID, mediaID)
	return url, err
}

func (s *mediaService) ResolveMediaURL(ctx context.Context, sessionID, mediaID uuid.UUID, allowedTypes ...string) (string, string, error) {
	media, err := s.q.GetMediaForSession(ctx, db.GetMediaForSessionParams{
		SessionID: sessionID,
		MediaID:   mediaID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", apperror.NotFound("media not found")
		}
		s.logger.Error().
			Err(err).
			Str("session_id", sessionID.String()).
			Str("media_id", mediaID.String()).
			Msg("failed to get media for session")
		return "", "", apperror.Internal("failed to get media")
	}

	if len(allowedTypes) > 0 {
		allowed := false
		for _, t := range allowedTypes {
			if media.Type == t {
				allowed = true
				break
			}
		}
		if !allowed {
			return "", "", apperror.New(apperror.ErrMediaInvalidType, 422, "media type is not allowed for this action")
		}
	}

	switch media.SourceType {
	case SourceTypeYouTube:
		if !media.Url.Valid {
			return "", "", apperror.Internal("media has no url")
		}
		return media.Url.String, SourceTypeYouTube, nil
	case SourceTypeFile:
		if !media.StorageKey.Valid {
			return "", "", apperror.Internal("media has no storage key")
		}
		if err := s.requireStorage(); err != nil {
			return "", "", err
		}
		url, err := s.storage.GenerateDownloadURL(ctx, media.StorageKey.String, 15*time.Minute)
		if err != nil {
			s.logger.Error().Err(err).Str("storage_key", media.StorageKey.String).Msg("failed to generate download URL")
			return "", "", apperror.Internal("failed to generate download URL")
		}
		return url, SourceTypeFile, nil
	default:
		return "", "", apperror.Internal("unknown media source type")
	}
}

// --- helpers ---

var (
	youtubeHosts = map[string]bool{
		"youtube.com":       true,
		"www.youtube.com":   true,
		"m.youtube.com":     true,
		"music.youtube.com": true,
		"youtu.be":          true,
	}
	youtubeVideoIDRe = regexp.MustCompile(`^[a-zA-Z0-9_-]{11}$`)
)

// parseYouTubeVideoID accepts any https YouTube URL (watch, shorts, youtu.be, music)
// and returns the 11-char video ID, or "" if invalid.
func parseYouTubeVideoID(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil || u.Scheme != "https" {
		return ""
	}
	host := strings.ToLower(u.Host)
	if !youtubeHosts[host] {
		return ""
	}

	// youtu.be/{id}
	if host == "youtu.be" {
		id := strings.TrimPrefix(u.Path, "/")
		if youtubeVideoIDRe.MatchString(id) {
			return id
		}
		return ""
	}

	// youtube.com/watch?v={id}
	if strings.HasPrefix(u.Path, "/watch") {
		id := u.Query().Get("v")
		if youtubeVideoIDRe.MatchString(id) {
			return id
		}
	}

	// youtube.com/shorts/{id} | /embed/{id} | /live/{id}
	for _, prefix := range []string{"/shorts/", "/embed/", "/live/", "/v/"} {
		if strings.HasPrefix(u.Path, prefix) {
			rest := strings.TrimPrefix(u.Path, prefix)
			id := strings.SplitN(rest, "/", 2)[0]
			if youtubeVideoIDRe.MatchString(id) {
				return id
			}
		}
	}

	return ""
}

type youtubeOEmbed struct {
	Title      string `json:"title"`
	AuthorName string `json:"author_name"`
	Thumbnail  string `json:"thumbnail_url"`
}

func fetchYouTubeOEmbed(ctx context.Context, videoID string) (*youtubeOEmbed, error) {
	client := &http.Client{
		Timeout: 5 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	reqURL := fmt.Sprintf("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=%s&format=json", videoID)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("youtube oembed returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, err
	}

	var out youtubeOEmbed
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func uploadExtensionFor(mediaType, mimeType string) (string, bool) {
	if mediaType == MediaTypeDocument {
		ext, ok := AllowedDocumentMIMEs[mimeType]
		return ext, ok
	}
	if mediaType == MediaTypeImage {
		ext, ok := AllowedMediaImageMIMEs[mimeType]
		return ext, ok
	}
	ext, ok := AllowedAudioMIMEs[mimeType]
	return ext, ok
}

func validateMediaMagicBytes(header []byte, mediaType, declaredMime string) error {
	if mediaType == MediaTypeDocument {
		return validateDocumentMagicBytes(header, declaredMime)
	}
	if mediaType == MediaTypeImage {
		return validateImageMagicBytes(header, declaredMime)
	}
	return validateAudioMagicBytes(header, declaredMime)
}

func validateAudioMagicBytes(header []byte, declaredMime string) error {
	switch declaredMime {
	case "audio/mpeg":
		if len(header) >= 3 && header[0] == 0xFF && (header[1]&0xF6 == 0xF2) {
			// MPEG audio frame sync (0xFFFB / 0xFFF3 / 0xFFF2)
			return nil
		}
		if len(header) >= 3 && string(header[:3]) == "ID3" {
			return nil
		}
	case "audio/ogg":
		if len(header) >= 4 && string(header[:4]) == "OggS" {
			return nil
		}
	case "audio/wav":
		if len(header) >= 12 && string(header[:4]) == "RIFF" && string(header[8:12]) == "WAVE" {
			return nil
		}
	}
	return apperror.New(apperror.ErrMediaInvalidType, 422, "file content does not match declared type")
}

func validateDocumentMagicBytes(header []byte, declaredMime string) error {
	if declaredMime == "application/pdf" && len(header) >= 5 && string(header[:5]) == "%PDF-" {
		return nil
	}
	return apperror.New(apperror.ErrMediaInvalidType, 422, "file content does not match declared type")
}

func validateImageMagicBytes(header []byte, declaredMime string) error {
	switch declaredMime {
	case "image/jpeg":
		if len(header) >= 3 && header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF {
			return nil
		}
	case "image/png":
		if len(header) >= 8 &&
			header[0] == 0x89 &&
			string(header[1:4]) == "PNG" &&
			header[4] == 0x0D &&
			header[5] == 0x0A &&
			header[6] == 0x1A &&
			header[7] == 0x0A {
			return nil
		}
	case "image/webp":
		if len(header) >= 12 && string(header[:4]) == "RIFF" && string(header[8:12]) == "WEBP" {
			return nil
		}
	}
	return apperror.New(apperror.ErrMediaInvalidType, 422, "file content does not match declared type")
}

func toMediaResponse(m db.ThemeMedium) MediaResponse {
	resp := MediaResponse{
		ID:         m.ID,
		ThemeID:    m.ThemeID,
		Name:       m.Name,
		Type:       m.Type,
		SourceType: m.SourceType,
		Tags:       m.Tags,
		SortOrder:  m.SortOrder,
		CreatedAt:  m.CreatedAt,
	}
	if resp.Tags == nil {
		resp.Tags = []string{}
	}
	if m.Url.Valid {
		s := m.Url.String
		resp.URL = &s
	}
	if m.Duration.Valid {
		d := m.Duration.Int32
		resp.Duration = &d
	}
	if m.FileSize.Valid {
		size := m.FileSize.Int64
		resp.FileSize = &size
	}
	if m.MimeType.Valid {
		mt := m.MimeType.String
		resp.MimeType = &mt
	}
	return resp
}
