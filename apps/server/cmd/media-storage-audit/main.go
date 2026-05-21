package main

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/chai2010/webp"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/image/draw"

	appconfig "github.com/mmp-platform/server/internal/config"
	"github.com/mmp-platform/server/internal/infra/postgres"
)

const defaultHeadTimeout = 10 * time.Second
const imageVariantMimeType = "image/webp"
const imageVariantQuality = 86

type options struct {
	themeID        string
	envFile        string
	format         string
	includeObjects bool
	apply          bool
}

type mediaRow struct {
	ID         uuid.UUID
	ThemeID    uuid.UUID
	Name       string
	StorageKey sql.NullString
	MimeType   sql.NullString
	FileSize   sql.NullInt64
}

type characterRef struct {
	ID           uuid.UUID
	Name         string
	ImageMediaID uuid.UUID
}

type keyStatus struct {
	Key         string `json:"key"`
	Kind        string `json:"kind"`
	Exists      bool   `json:"exists"`
	Size        int64  `json:"size,omitempty"`
	ContentType string `json:"content_type,omitempty"`
	Error       string `json:"error,omitempty"`
}

type mediaAudit struct {
	MediaID            string      `json:"media_id"`
	MediaName          string      `json:"media_name"`
	DBStorageKey       string      `json:"db_storage_key,omitempty"`
	CharacterRefs      []string    `json:"character_refs"`
	Status             string      `json:"status"`
	IsLegacy           bool        `json:"is_legacy"`
	BackfillEligible   bool        `json:"backfill_eligible"`
	BackfillSourceKey  string      `json:"backfill_source_key,omitempty"`
	MissingVariantKeys []string    `json:"missing_variant_keys,omitempty"`
	MissingObjects     []string    `json:"missing_objects,omitempty"`
	Applied            bool        `json:"applied"`
	ApplyError         string      `json:"apply_error,omitempty"`
	CleanupError       string      `json:"cleanup_error,omitempty"`
	Candidates         []keyStatus `json:"candidates"`
}

type auditReport struct {
	ThemeID          string       `json:"theme_id"`
	GeneratedAt      time.Time    `json:"generated_at"`
	Media            []mediaAudit `json:"media"`
	UnmatchedObjects []string     `json:"unmatched_objects,omitempty"`
	Summary          auditSummary `json:"summary"`
}

type auditSummary struct {
	MediaCount            int `json:"media_count"`
	CharacterRefCount     int `json:"character_ref_count"`
	AvailableMediaCount   int `json:"available_media_count"`
	MissingAllMediaCount  int `json:"missing_all_media_count"`
	UnmatchedObjectCount  int `json:"unmatched_object_count"`
	LegacyMediaCount      int `json:"legacy_media_count"`
	VariantCompleteCount  int `json:"variant_complete_count"`
	BackfillEligibleCount int `json:"backfill_eligible_count"`
	MissingObjectCount    int `json:"missing_object_count"`
	BackfilledCount       int `json:"backfilled_count"`
	BackfillFailedCount   int `json:"backfill_failed_count"`
}

type auditStorage interface {
	HeadObject(ctx context.Context, key string) keyStatus
	ListObjectKeys(ctx context.Context, prefix string) ([]string, error)
}

type backfillStorage interface {
	GetObject(ctx context.Context, key string, size int64) ([]byte, error)
	PutObject(ctx context.Context, key string, body []byte, contentType string) error
	DeleteObjects(ctx context.Context, keys []string) error
}

type mediaFileUpdater interface {
	UpdateMediaFile(ctx context.Context, media mediaRow, nextStorageKey string, nextFileSize int64, nextMimeType string) error
}

type s3ObjectStore struct {
	client *s3.Client
	bucket string
}

type pgMediaFileUpdater struct {
	pool *pgxpool.Pool
}

type imageVariant struct {
	Name        string
	Key         string
	Body        []byte
	ContentType string
}

type imageVariantBuilder func(themeID, mediaID uuid.UUID, declaredMime string, payload []byte) ([]imageVariant, error)

var errObjectMissing = errors.New("object missing")

func main() {
	if err := run(context.Background(), os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "media-storage-audit: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, args []string) error {
	opts := parseFlags(args)
	if opts.themeID == "" {
		return errors.New("--theme-id is required")
	}
	themeID, err := uuid.Parse(opts.themeID)
	if err != nil {
		return fmt.Errorf("invalid --theme-id: %w", err)
	}
	if opts.format != "text" && opts.format != "json" {
		return errors.New("--format must be text or json")
	}
	if opts.envFile != "" {
		if err := loadDotEnv(opts.envFile); err != nil {
			return err
		}
	}

	cfg, err := appconfig.Load()
	if err != nil {
		return err
	}
	if !cfg.HasR2StorageConfig() {
		return fmt.Errorf("missing R2 storage env: %s", strings.Join(cfg.MissingR2StorageEnv(), ", "))
	}

	pool, err := postgres.New(cfg.DatabaseURL)
	if err != nil {
		return err
	}
	defer pool.Close()

	client, err := newR2Client(ctx, cfg)
	if err != nil {
		return err
	}

	store := s3ObjectStore{client: client, bucket: cfg.R2BucketName}
	report, err := auditThemeMedia(ctx, pool, store, pgMediaFileUpdater{pool: pool}, themeID, opts.includeObjects, opts.apply)
	if err != nil {
		return err
	}

	switch opts.format {
	case "json":
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		return enc.Encode(report)
	default:
		printTextReport(report)
		return nil
	}
}

func parseFlags(args []string) options {
	fs := flag.NewFlagSet("media-storage-audit", flag.ExitOnError)
	opts := options{}
	fs.StringVar(&opts.themeID, "theme-id", "", "theme UUID to audit")
	fs.StringVar(&opts.envFile, "env-file", ".env", "dotenv file to load before reading environment")
	fs.StringVar(&opts.format, "format", "text", "output format: text or json")
	fs.BoolVar(&opts.includeObjects, "include-objects", true, "list R2 objects under the theme media prefix to report unmatched keys")
	fs.BoolVar(&opts.apply, "apply", false, "write missing image variants to R2 and reconcile DB storage metadata")
	_ = fs.Parse(args)
	return opts
}

func loadDotEnv(path string) error {
	file, err := os.Open(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return fmt.Errorf("open env file: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	lineNo := 0
	for scanner.Scan() {
		lineNo++
		key, value, ok, err := parseDotEnvLine(scanner.Text())
		if err != nil {
			return fmt.Errorf("%s:%d: %w", path, lineNo, err)
		}
		if !ok {
			continue
		}
		if _, exists := os.LookupEnv(key); exists {
			continue
		}
		if err := os.Setenv(key, value); err != nil {
			return fmt.Errorf("set env %s: %w", key, err)
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read env file: %w", err)
	}
	return nil
}

func parseDotEnvLine(line string) (string, string, bool, error) {
	line = strings.TrimSpace(line)
	if line == "" || strings.HasPrefix(line, "#") {
		return "", "", false, nil
	}
	key, value, ok := strings.Cut(line, "=")
	if !ok {
		return "", "", false, fmt.Errorf("invalid dotenv line")
	}
	key = strings.TrimSpace(strings.TrimPrefix(key, "export "))
	if key == "" {
		return "", "", false, fmt.Errorf("empty env key")
	}
	value = strings.TrimSpace(value)
	value = strings.Trim(value, `"'`)
	return key, value, true, nil
}

func newR2Client(ctx context.Context, cfg *appconfig.Config) (*s3.Client, error) {
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.R2AccountID)
	sdkCfg, err := config.LoadDefaultConfig(ctx,
		config.WithRegion("auto"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.R2AccessKeyID,
			cfg.R2SecretAccessKey,
			"",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}
	return s3.NewFromConfig(sdkCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	}), nil
}

func auditThemeMedia(ctx context.Context, pool *pgxpool.Pool, storage auditStorage, updater mediaFileUpdater, themeID uuid.UUID, includeObjects bool, apply bool) (auditReport, error) {
	mediaRows, err := fetchImageMedia(ctx, pool, themeID)
	if err != nil {
		return auditReport{}, err
	}
	characterRefs, err := fetchCharacterRefs(ctx, pool, themeID)
	if err != nil {
		return auditReport{}, err
	}

	refsByMedia := make(map[uuid.UUID][]string)
	for _, ref := range characterRefs {
		label := ref.Name
		refsByMedia[ref.ImageMediaID] = append(refsByMedia[ref.ImageMediaID], label)
	}

	allCandidateKeys := make(map[string]struct{})
	report := auditReport{
		ThemeID:     themeID.String(),
		GeneratedAt: time.Now().UTC(),
		Media:       make([]mediaAudit, 0, len(mediaRows)),
		Summary: auditSummary{
			MediaCount:        len(mediaRows),
			CharacterRefCount: len(characterRefs),
		},
	}

	for _, media := range mediaRows {
		candidates := candidateKeys(themeID, media.ID, media.StorageKey.String)
		statuses := make([]keyStatus, 0, len(candidates))
		hasAvailable := false
		for _, candidate := range candidates {
			allCandidateKeys[candidate.Key] = struct{}{}
			status := storage.HeadObject(ctx, candidate.Key)
			status.Kind = candidate.Kind
			if status.Exists {
				hasAvailable = true
			}
			statuses = append(statuses, status)
		}

		audit := planMediaBackfill(themeID, media, statuses)
		if hasAvailable {
			report.Summary.AvailableMediaCount++
		} else {
			report.Summary.MissingAllMediaCount++
		}
		if audit.IsLegacy {
			report.Summary.LegacyMediaCount++
		}
		if len(audit.MissingVariantKeys) == 0 {
			report.Summary.VariantCompleteCount++
		}
		if audit.BackfillEligible {
			report.Summary.BackfillEligibleCount++
		}
		report.Summary.MissingObjectCount += len(audit.MissingObjects)

		refLabels := refsByMedia[media.ID]
		sort.Strings(refLabels)
		audit.CharacterRefs = refLabels
		if apply {
			backfillStore, ok := storage.(backfillStorage)
			if !ok {
				audit.ApplyError = "storage backend does not support backfill writes"
			} else {
				audit, err = applyMediaBackfill(ctx, backfillStore, updater, themeID, media, audit, buildImageVariants)
				if err != nil {
					audit.ApplyError = redactError(err)
				}
			}
			if audit.Applied {
				report.Summary.BackfilledCount++
			}
			if audit.ApplyError != "" {
				report.Summary.BackfillFailedCount++
			}
		}
		report.Media = append(report.Media, audit)
	}

	if includeObjects {
		prefix := fmt.Sprintf("themes/%s/media/", themeID)
		objects, err := storage.ListObjectKeys(ctx, prefix)
		if err != nil {
			return auditReport{}, err
		}
		for _, key := range objects {
			if _, ok := allCandidateKeys[key]; !ok {
				report.UnmatchedObjects = append(report.UnmatchedObjects, key)
			}
		}
		sort.Strings(report.UnmatchedObjects)
		report.Summary.UnmatchedObjectCount = len(report.UnmatchedObjects)
	}

	sort.Slice(report.Media, func(i, j int) bool {
		return report.Media[i].MediaName < report.Media[j].MediaName
	})
	return report, nil
}

func planMediaBackfill(themeID uuid.UUID, media mediaRow, statuses []keyStatus) mediaAudit {
	masterKey := imageVariantKey(themeID, media.ID, "master")
	previewKey := imageVariantKey(themeID, media.ID, "preview")
	thumbnailKey := imageVariantKey(themeID, media.ID, "thumbnail")
	variantKeys := []string{masterKey, previewKey, thumbnailKey}
	statusByKey := make(map[string]keyStatus, len(statuses))
	anyExists := false
	for _, status := range statuses {
		statusByKey[status.Key] = status
		if status.Exists {
			anyExists = true
		}
	}

	audit := mediaAudit{
		MediaID:      media.ID.String(),
		MediaName:    media.Name,
		DBStorageKey: media.StorageKey.String,
		IsLegacy:     media.StorageKey.String != masterKey || media.MimeType.String != imageVariantMimeType,
		Candidates:   statuses,
	}
	for _, key := range variantKeys {
		if !statusByKey[key].Exists {
			audit.MissingVariantKeys = append(audit.MissingVariantKeys, key)
			audit.MissingObjects = append(audit.MissingObjects, key)
		}
	}

	if statusByKey[masterKey].Exists {
		audit.BackfillEligible = true
		audit.BackfillSourceKey = masterKey
	} else if media.StorageKey.String != "" && statusByKey[media.StorageKey.String].Exists {
		audit.BackfillEligible = true
		audit.BackfillSourceKey = media.StorageKey.String
	} else if media.StorageKey.String != "" {
		audit.MissingObjects = appendIfMissing(audit.MissingObjects, media.StorageKey.String)
	}

	switch {
	case audit.IsLegacy && audit.BackfillEligible:
		audit.Status = "legacy_backfill_eligible"
	case audit.IsLegacy:
		audit.Status = "missing_source"
	case !anyExists:
		audit.Status = "missing_all"
	case len(audit.MissingVariantKeys) > 0 && audit.BackfillEligible:
		audit.Status = "variant_backfill_eligible"
	case len(audit.MissingVariantKeys) > 0:
		audit.Status = "missing_source"
	default:
		audit.Status = "variant_complete"
	}
	sort.Strings(audit.MissingObjects)
	return audit
}

func applyMediaBackfill(ctx context.Context, storage backfillStorage, updater mediaFileUpdater, themeID uuid.UUID, media mediaRow, audit mediaAudit, build imageVariantBuilder) (mediaAudit, error) {
	if !audit.BackfillEligible {
		return audit, nil
	}
	masterKey := imageVariantKey(themeID, media.ID, "master")
	if !audit.IsLegacy && len(audit.MissingVariantKeys) == 0 {
		return audit, nil
	}

	existingSizes := existingVariantSizes(audit.Candidates)
	missing := stringSet(audit.MissingVariantKeys)
	generatedByKey := map[string]imageVariant{}
	if len(missing) > 0 {
		sourceSize := sourceObjectSize(audit.BackfillSourceKey, media, audit.Candidates)
		payload, err := storage.GetObject(ctx, audit.BackfillSourceKey, sourceSize)
		if err != nil {
			return audit, fmt.Errorf("read source object %s: %w", audit.BackfillSourceKey, err)
		}
		variants, err := build(themeID, media.ID, sourceMimeType(audit.BackfillSourceKey, media, audit.Candidates), payload)
		if err != nil {
			return audit, err
		}
		for _, variant := range variants {
			generatedByKey[variant.Key] = variant
		}
	}

	written := make([]string, 0, len(missing))
	for _, key := range audit.MissingVariantKeys {
		variant, ok := generatedByKey[key]
		if !ok {
			return failAfterCleanup(ctx, storage, audit, written, fmt.Errorf("missing generated variant for %s", key))
		}
		if err := storage.PutObject(ctx, variant.Key, variant.Body, variant.ContentType); err != nil {
			return failAfterCleanup(ctx, storage, audit, written, fmt.Errorf("write variant %s: %w", variant.Key, err))
		}
		written = append(written, variant.Key)
	}

	totalSize, err := reconciledVariantSize([]string{
		masterKey,
		imageVariantKey(themeID, media.ID, "preview"),
		imageVariantKey(themeID, media.ID, "thumbnail"),
	}, existingSizes, generatedByKey)
	if err != nil {
		return failAfterCleanup(ctx, storage, audit, written, err)
	}
	if err := updater.UpdateMediaFile(ctx, media, masterKey, totalSize, imageVariantMimeType); err != nil {
		return failAfterCleanup(ctx, storage, audit, written, fmt.Errorf("update media row: %w", err))
	}
	audit.Applied = true
	audit.Status = "backfilled"
	return audit, nil
}

func failAfterCleanup(ctx context.Context, storage backfillStorage, audit mediaAudit, written []string, cause error) (mediaAudit, error) {
	if cleanupErr := storage.DeleteObjects(ctx, written); cleanupErr != nil {
		audit.CleanupError = redactError(cleanupErr)
		return audit, fmt.Errorf("%w; cleanup generated variants: %v", cause, cleanupErr)
	}
	return audit, cause
}

func appendIfMissing(values []string, value string) []string {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	return append(values, value)
}

func stringSet(values []string) map[string]struct{} {
	out := make(map[string]struct{}, len(values))
	for _, value := range values {
		out[value] = struct{}{}
	}
	return out
}

func existingVariantSizes(statuses []keyStatus) map[string]int64 {
	out := make(map[string]int64, len(statuses))
	for _, status := range statuses {
		if status.Exists {
			out[status.Key] = status.Size
		}
	}
	return out
}

func sourceObjectSize(sourceKey string, media mediaRow, statuses []keyStatus) int64 {
	for _, status := range statuses {
		if status.Key == sourceKey && status.Size > 0 {
			return status.Size
		}
	}
	if media.StorageKey.String == sourceKey && media.FileSize.Valid {
		return media.FileSize.Int64
	}
	return 0
}

func sourceMimeType(sourceKey string, media mediaRow, statuses []keyStatus) string {
	for _, status := range statuses {
		if status.Key == sourceKey && status.ContentType != "" {
			return status.ContentType
		}
	}
	if media.MimeType.Valid && media.MimeType.String != "" {
		return media.MimeType.String
	}
	for _, status := range statuses {
		if status.ContentType != "" {
			return status.ContentType
		}
	}
	return imageVariantMimeType
}

func reconciledVariantSize(keys []string, existing map[string]int64, generated map[string]imageVariant) (int64, error) {
	var total int64
	for _, key := range keys {
		if size, ok := existing[key]; ok {
			total += size
			continue
		}
		variant, ok := generated[key]
		if !ok {
			return 0, fmt.Errorf("missing variant size for %s", key)
		}
		total += int64(len(variant.Body))
	}
	return total, nil
}

func buildImageVariants(themeID, mediaID uuid.UUID, declaredMime string, payload []byte) ([]imageVariant, error) {
	img, err := decodeImage(declaredMime, payload)
	if err != nil {
		return nil, fmt.Errorf("decode image: %w", err)
	}
	specs := []struct {
		name string
		max  int
	}{
		{name: "master", max: 2048},
		{name: "preview", max: 1280},
		{name: "thumbnail", max: 360},
	}
	variants := make([]imageVariant, 0, len(specs))
	for _, spec := range specs {
		encoded, err := encodeWebP(resizeImageToMax(img, spec.max))
		if err != nil {
			return nil, fmt.Errorf("encode %s variant: %w", spec.name, err)
		}
		variants = append(variants, imageVariant{
			Name:        spec.name,
			Key:         imageVariantKey(themeID, mediaID, spec.name),
			Body:        encoded,
			ContentType: imageVariantMimeType,
		})
	}
	return variants, nil
}

func decodeImage(declaredMime string, payload []byte) (image.Image, error) {
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

func fetchImageMedia(ctx context.Context, pool *pgxpool.Pool, themeID uuid.UUID) ([]mediaRow, error) {
	rows, err := pool.Query(ctx, `
SELECT id, theme_id, name, storage_key, mime_type, file_size
FROM theme_media
WHERE theme_id = $1
  AND type = 'IMAGE'
  AND source_type = 'FILE'
ORDER BY sort_order, created_at, name
`, themeID)
	if err != nil {
		return nil, fmt.Errorf("query image media: %w", err)
	}
	defer rows.Close()

	var media []mediaRow
	for rows.Next() {
		var row mediaRow
		if err := rows.Scan(&row.ID, &row.ThemeID, &row.Name, &row.StorageKey, &row.MimeType, &row.FileSize); err != nil {
			return nil, fmt.Errorf("scan image media: %w", err)
		}
		media = append(media, row)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate image media: %w", err)
	}
	return media, nil
}

func fetchCharacterRefs(ctx context.Context, pool *pgxpool.Pool, themeID uuid.UUID) ([]characterRef, error) {
	rows, err := pool.Query(ctx, `
SELECT id, name, image_media_id
FROM theme_characters
WHERE theme_id = $1
  AND image_media_id IS NOT NULL
ORDER BY sort_order, name
`, themeID)
	if err != nil {
		return nil, fmt.Errorf("query character refs: %w", err)
	}
	defer rows.Close()

	var refs []characterRef
	for rows.Next() {
		var ref characterRef
		if err := rows.Scan(&ref.ID, &ref.Name, &ref.ImageMediaID); err != nil {
			return nil, fmt.Errorf("scan character refs: %w", err)
		}
		refs = append(refs, ref)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate character refs: %w", err)
	}
	return refs, nil
}

type candidateKey struct {
	Kind string
	Key  string
}

func candidateKeys(themeID, mediaID uuid.UUID, storageKey string) []candidateKey {
	raw := []candidateKey{
		{Kind: "preview", Key: imageVariantKey(themeID, mediaID, "preview")},
		{Kind: "master", Key: imageVariantKey(themeID, mediaID, "master")},
		{Kind: "thumbnail", Key: imageVariantKey(themeID, mediaID, "thumbnail")},
	}
	if storageKey != "" {
		raw = append(raw, candidateKey{Kind: "db_storage_key", Key: storageKey})
	}
	seen := make(map[string]struct{}, len(raw))
	out := make([]candidateKey, 0, len(raw))
	for _, candidate := range raw {
		if candidate.Key == "" {
			continue
		}
		if _, ok := seen[candidate.Key]; ok {
			continue
		}
		seen[candidate.Key] = struct{}{}
		out = append(out, candidate)
	}
	return out
}

func imageVariantKey(themeID, mediaID uuid.UUID, variant string) string {
	return fmt.Sprintf("themes/%s/media/%s/%s.webp", themeID, mediaID, variant)
}

func (s s3ObjectStore) HeadObject(ctx context.Context, key string) keyStatus {
	headCtx, cancel := context.WithTimeout(ctx, defaultHeadTimeout)
	defer cancel()

	resp, err := s.client.HeadObject(headCtx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		if isS3NotFound(err) {
			return keyStatus{Key: key, Exists: false}
		}
		return keyStatus{Key: key, Exists: false, Error: redactError(err)}
	}
	status := keyStatus{
		Key:    key,
		Exists: true,
		Size:   aws.ToInt64(resp.ContentLength),
	}
	if resp.ContentType != nil {
		status.ContentType = *resp.ContentType
	}
	return status
}

func (s s3ObjectStore) GetObject(ctx context.Context, key string, size int64) ([]byte, error) {
	input := &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	}
	if size > 0 {
		input.Range = aws.String(fmt.Sprintf("bytes=0-%d", size-1))
	}
	resp, err := s.client.GetObject(ctx, input)
	if err != nil {
		if isS3NotFound(err) {
			return nil, errObjectMissing
		}
		return nil, err
	}
	defer resp.Body.Close()
	if size > 0 {
		return io.ReadAll(io.LimitReader(resp.Body, size+1))
	}
	return io.ReadAll(resp.Body)
}

func (s s3ObjectStore) PutObject(ctx context.Context, key string, body []byte, contentType string) error {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(body),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(int64(len(body))),
	})
	return err
}

func (s s3ObjectStore) DeleteObjects(ctx context.Context, keys []string) error {
	if len(keys) == 0 {
		return nil
	}
	objects := make([]types.ObjectIdentifier, 0, len(keys))
	for _, key := range keys {
		objects = append(objects, types.ObjectIdentifier{Key: aws.String(key)})
	}
	resp, err := s.client.DeleteObjects(ctx, &s3.DeleteObjectsInput{
		Bucket: aws.String(s.bucket),
		Delete: &types.Delete{Objects: objects, Quiet: aws.Bool(true)},
	})
	if err != nil {
		return err
	}
	if len(resp.Errors) > 0 {
		first := resp.Errors[0]
		return fmt.Errorf("%d objects failed to delete, first error: %s", len(resp.Errors), aws.ToString(first.Message))
	}
	return nil
}

func isS3NotFound(err error) bool {
	var notFound *types.NotFound
	var noSuchKey *types.NoSuchKey
	return errors.As(err, &notFound) || errors.As(err, &noSuchKey) || strings.Contains(err.Error(), "NotFound")
}

func redactError(err error) string {
	if err == nil {
		return ""
	}
	msg := err.Error()
	if len(msg) > 180 {
		msg = msg[:180] + "..."
	}
	return msg
}

func (s s3ObjectStore) ListObjectKeys(ctx context.Context, prefix string) ([]string, error) {
	var keys []string
	var token *string
	for {
		resp, err := s.client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket:            aws.String(s.bucket),
			Prefix:            aws.String(prefix),
			ContinuationToken: token,
		})
		if err != nil {
			return nil, fmt.Errorf("list objects: %w", err)
		}
		for _, obj := range resp.Contents {
			keys = append(keys, aws.ToString(obj.Key))
		}
		if !aws.ToBool(resp.IsTruncated) {
			break
		}
		token = resp.NextContinuationToken
	}
	sort.Strings(keys)
	return keys, nil
}

func (p pgMediaFileUpdater) UpdateMediaFile(ctx context.Context, media mediaRow, nextStorageKey string, nextFileSize int64, nextMimeType string) error {
	tag, err := p.pool.Exec(ctx, `
UPDATE theme_media
SET source_type = 'FILE',
    url = NULL,
    storage_key = $4,
    file_size = $5,
    mime_type = $6,
    duration = NULL,
    updated_at = NOW()
WHERE id = $1
  AND theme_id = $2
  AND type = 'IMAGE'
  AND source_type = 'FILE'
  AND storage_key IS NOT DISTINCT FROM $3
`, media.ID, media.ThemeID, nullableStringValue(media.StorageKey), nextStorageKey, nextFileSize, nextMimeType)
	if err != nil {
		return err
	}
	if tag.RowsAffected() != 1 {
		return fmt.Errorf("media row not found or changed since audit")
	}
	return nil
}

func nullableStringValue(value sql.NullString) any {
	if !value.Valid {
		return nil
	}
	return value.String
}

func printTextReport(report auditReport) {
	fmt.Printf("Theme: %s\n", report.ThemeID)
	fmt.Printf("Generated: %s\n", report.GeneratedAt.Format(time.RFC3339))
	fmt.Printf("Summary: media=%d character_refs=%d available=%d missing_all=%d unmatched_objects=%d legacy=%d variant_complete=%d backfill_eligible=%d missing_objects=%d backfilled=%d backfill_failed=%d\n\n",
		report.Summary.MediaCount,
		report.Summary.CharacterRefCount,
		report.Summary.AvailableMediaCount,
		report.Summary.MissingAllMediaCount,
		report.Summary.UnmatchedObjectCount,
		report.Summary.LegacyMediaCount,
		report.Summary.VariantCompleteCount,
		report.Summary.BackfillEligibleCount,
		report.Summary.MissingObjectCount,
		report.Summary.BackfilledCount,
		report.Summary.BackfillFailedCount,
	)
	for _, media := range report.Media {
		fmt.Printf("- media %s (%s): %s\n", media.MediaID, media.MediaName, media.Status)
		if media.DBStorageKey != "" {
			fmt.Printf("  db_storage_key: %s\n", media.DBStorageKey)
		}
		fmt.Printf("  legacy=%v backfill_eligible=%v applied=%v\n", media.IsLegacy, media.BackfillEligible, media.Applied)
		if media.BackfillSourceKey != "" {
			fmt.Printf("  backfill_source_key: %s\n", media.BackfillSourceKey)
		}
		if len(media.MissingVariantKeys) > 0 {
			fmt.Printf("  missing_variant_keys: %s\n", strings.Join(media.MissingVariantKeys, ", "))
		}
		if len(media.MissingObjects) > 0 {
			fmt.Printf("  missing_objects: %s\n", strings.Join(media.MissingObjects, ", "))
		}
		if media.ApplyError != "" {
			fmt.Printf("  apply_error: %s\n", media.ApplyError)
		}
		if media.CleanupError != "" {
			fmt.Printf("  cleanup_error: %s\n", media.CleanupError)
		}
		if len(media.CharacterRefs) > 0 {
			fmt.Printf("  character_refs: %s\n", strings.Join(media.CharacterRefs, ", "))
		}
		for _, candidate := range media.Candidates {
			result := "missing"
			if candidate.Exists {
				result = fmt.Sprintf("exists size=%d type=%s", candidate.Size, candidate.ContentType)
			}
			if candidate.Error != "" {
				result = "error: " + candidate.Error
			}
			fmt.Printf("  [%s] %s -> %s\n", candidate.Kind, candidate.Key, result)
		}
	}
	if len(report.UnmatchedObjects) > 0 {
		fmt.Println("\nUnmatched objects under theme media prefix:")
		for _, key := range report.UnmatchedObjects {
			fmt.Printf("- %s\n", key)
		}
	}
}
