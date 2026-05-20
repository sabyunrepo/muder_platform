package main

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	appconfig "github.com/mmp-platform/server/internal/config"
	"github.com/mmp-platform/server/internal/infra/postgres"
)

const defaultHeadTimeout = 10 * time.Second

type options struct {
	themeID        string
	envFile        string
	format         string
	includeObjects bool
}

type mediaRow struct {
	ID         uuid.UUID
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
	MediaID       string      `json:"media_id"`
	MediaName     string      `json:"media_name"`
	DBStorageKey  string      `json:"db_storage_key,omitempty"`
	CharacterRefs []string    `json:"character_refs"`
	Status        string      `json:"status"`
	Candidates    []keyStatus `json:"candidates"`
}

type auditReport struct {
	ThemeID          string       `json:"theme_id"`
	GeneratedAt      time.Time    `json:"generated_at"`
	Media            []mediaAudit `json:"media"`
	UnmatchedObjects []string     `json:"unmatched_objects,omitempty"`
	Summary          auditSummary `json:"summary"`
}

type auditSummary struct {
	MediaCount           int `json:"media_count"`
	CharacterRefCount    int `json:"character_ref_count"`
	AvailableMediaCount  int `json:"available_media_count"`
	MissingAllMediaCount int `json:"missing_all_media_count"`
	UnmatchedObjectCount int `json:"unmatched_object_count"`
}

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

	report, err := auditThemeMedia(ctx, pool, client, cfg.R2BucketName, themeID, opts.includeObjects)
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

func auditThemeMedia(ctx context.Context, pool *pgxpool.Pool, client *s3.Client, bucket string, themeID uuid.UUID, includeObjects bool) (auditReport, error) {
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
			status := headKey(ctx, client, bucket, candidate.Key)
			status.Kind = candidate.Kind
			if status.Exists {
				hasAvailable = true
			}
			statuses = append(statuses, status)
		}
		status := "missing_all"
		if hasAvailable {
			status = "available"
			report.Summary.AvailableMediaCount++
		} else {
			report.Summary.MissingAllMediaCount++
		}

		refLabels := refsByMedia[media.ID]
		sort.Strings(refLabels)
		report.Media = append(report.Media, mediaAudit{
			MediaID:       media.ID.String(),
			MediaName:     media.Name,
			DBStorageKey:  media.StorageKey.String,
			CharacterRefs: refLabels,
			Status:        status,
			Candidates:    statuses,
		})
	}

	if includeObjects {
		prefix := fmt.Sprintf("themes/%s/media/", themeID)
		objects, err := listObjectKeys(ctx, client, bucket, prefix)
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

func fetchImageMedia(ctx context.Context, pool *pgxpool.Pool, themeID uuid.UUID) ([]mediaRow, error) {
	rows, err := pool.Query(ctx, `
SELECT id, name, storage_key, mime_type, file_size
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
		if err := rows.Scan(&row.ID, &row.Name, &row.StorageKey, &row.MimeType, &row.FileSize); err != nil {
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

func headKey(ctx context.Context, client *s3.Client, bucket string, key string) keyStatus {
	headCtx, cancel := context.WithTimeout(ctx, defaultHeadTimeout)
	defer cancel()

	resp, err := client.HeadObject(headCtx, &s3.HeadObjectInput{
		Bucket: aws.String(bucket),
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

func listObjectKeys(ctx context.Context, client *s3.Client, bucket string, prefix string) ([]string, error) {
	var keys []string
	var token *string
	for {
		resp, err := client.ListObjectsV2(ctx, &s3.ListObjectsV2Input{
			Bucket:            aws.String(bucket),
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

func printTextReport(report auditReport) {
	fmt.Printf("Theme: %s\n", report.ThemeID)
	fmt.Printf("Generated: %s\n", report.GeneratedAt.Format(time.RFC3339))
	fmt.Printf("Summary: media=%d character_refs=%d available=%d missing_all=%d unmatched_objects=%d\n\n",
		report.Summary.MediaCount,
		report.Summary.CharacterRefCount,
		report.Summary.AvailableMediaCount,
		report.Summary.MissingAllMediaCount,
		report.Summary.UnmatchedObjectCount,
	)
	for _, media := range report.Media {
		fmt.Printf("- media %s (%s): %s\n", media.MediaID, media.MediaName, media.Status)
		if media.DBStorageKey != "" {
			fmt.Printf("  db_storage_key: %s\n", media.DBStorageKey)
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
