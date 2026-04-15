package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/rs/zerolog"
)

const maxDeleteBatch = 1000

// R2Config holds the configuration for Cloudflare R2 storage.
type R2Config struct {
	AccountID       string
	AccessKeyID     string
	SecretAccessKey string
	BucketName      string
	PublicURL       string // CDN URL prefix (e.g., https://media.mmp.app)
}

type r2Provider struct {
	client    *s3.Client
	presigner *s3.PresignClient
	bucket    string
	publicURL string
	log       zerolog.Logger
}

// NewR2Provider creates a new R2-backed storage provider.
func NewR2Provider(cfg R2Config, log zerolog.Logger) (Provider, error) {
	endpoint := fmt.Sprintf("https://%s.r2.cloudflarestorage.com", cfg.AccountID)

	sdkCfg, err := config.LoadDefaultConfig(context.Background(),
		config.WithRegion("auto"),
		config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
			cfg.AccessKeyID, cfg.SecretAccessKey, "",
		)),
	)
	if err != nil {
		return nil, fmt.Errorf("storage: failed to load aws config: %w", err)
	}

	client := s3.NewFromConfig(sdkCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(endpoint)
		o.UsePathStyle = true
	})

	return &r2Provider{
		client:    client,
		presigner: s3.NewPresignClient(client),
		bucket:    cfg.BucketName,
		publicURL: cfg.PublicURL,
		log:       log.With().Str("component", "storage").Logger(),
	}, nil
}

func (r *r2Provider) GenerateUploadURL(ctx context.Context, key string, contentType string, maxSize int64, expiry time.Duration) (string, error) {
	input := &s3.PutObjectInput{
		Bucket:        aws.String(r.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(maxSize),
	}

	resp, err := r.presigner.PresignPutObject(ctx, input, s3.WithPresignExpires(expiry))
	if err != nil {
		r.log.Error().Err(err).Str("key", key).Msg("failed to generate upload URL")
		return "", fmt.Errorf("storage: presign put: %w", err)
	}

	r.log.Debug().Str("key", key).Str("content_type", contentType).Int64("max_size", maxSize).Msg("generated upload URL")
	return resp.URL, nil
}

func (r *r2Provider) GenerateDownloadURL(ctx context.Context, key string, expiry time.Duration) (string, error) {
	input := &s3.GetObjectInput{
		Bucket: aws.String(r.bucket),
		Key:    aws.String(key),
	}

	resp, err := r.presigner.PresignGetObject(ctx, input, s3.WithPresignExpires(expiry))
	if err != nil {
		r.log.Error().Err(err).Str("key", key).Msg("failed to generate download URL")
		return "", fmt.Errorf("storage: presign get: %w", err)
	}

	r.log.Debug().Str("key", key).Msg("generated download URL")
	return resp.URL, nil
}

func (r *r2Provider) HeadObject(ctx context.Context, key string) (*ObjectMeta, error) {
	input := &s3.HeadObjectInput{
		Bucket: aws.String(r.bucket),
		Key:    aws.String(key),
	}

	resp, err := r.client.HeadObject(ctx, input)
	if err != nil {
		var notFound *types.NotFound
		if errors.As(err, &notFound) {
			return nil, ErrObjectNotFound
		}
		r.log.Error().Err(err).Str("key", key).Msg("failed to head object")
		return nil, fmt.Errorf("storage: head object: %w", err)
	}

	meta := &ObjectMeta{
		Key:  key,
		Size: aws.ToInt64(resp.ContentLength),
	}
	if resp.ContentType != nil {
		meta.ContentType = *resp.ContentType
	}
	if resp.ETag != nil {
		meta.ETag = *resp.ETag
	}

	return meta, nil
}

func (r *r2Provider) GetObjectRange(ctx context.Context, key string, offset int64, length int64) (io.ReadCloser, error) {
	rangeHeader := fmt.Sprintf("bytes=%d-%d", offset, offset+length-1)

	input := &s3.GetObjectInput{
		Bucket: aws.String(r.bucket),
		Key:    aws.String(key),
		Range:  aws.String(rangeHeader),
	}

	resp, err := r.client.GetObject(ctx, input)
	if err != nil {
		var noSuchKey *types.NoSuchKey
		if errors.As(err, &noSuchKey) {
			return nil, ErrObjectNotFound
		}
		r.log.Error().Err(err).Str("key", key).Str("range", rangeHeader).Msg("failed to get object range")
		return nil, fmt.Errorf("storage: get object range: %w", err)
	}

	r.log.Debug().Str("key", key).Int64("offset", offset).Int64("length", length).Msg("retrieved object range")
	return resp.Body, nil
}

func (r *r2Provider) DeleteObject(ctx context.Context, key string) error {
	input := &s3.DeleteObjectInput{
		Bucket: aws.String(r.bucket),
		Key:    aws.String(key),
	}

	if _, err := r.client.DeleteObject(ctx, input); err != nil {
		r.log.Error().Err(err).Str("key", key).Msg("failed to delete object")
		return fmt.Errorf("storage: delete object: %w", err)
	}

	r.log.Debug().Str("key", key).Msg("deleted object")
	return nil
}

func (r *r2Provider) DeleteObjects(ctx context.Context, keys []string) error {
	for i := 0; i < len(keys); i += maxDeleteBatch {
		end := i + maxDeleteBatch
		if end > len(keys) {
			end = len(keys)
		}
		batch := keys[i:end]

		objects := make([]types.ObjectIdentifier, len(batch))
		for j, key := range batch {
			objects[j] = types.ObjectIdentifier{
				Key: aws.String(key),
			}
		}

		input := &s3.DeleteObjectsInput{
			Bucket: aws.String(r.bucket),
			Delete: &types.Delete{
				Objects: objects,
				Quiet:   aws.Bool(true),
			},
		}

		resp, err := r.client.DeleteObjects(ctx, input)
		if err != nil {
			r.log.Error().Err(err).Int("batch_start", i).Int("batch_size", len(batch)).Msg("failed to delete objects batch")
			return fmt.Errorf("storage: delete objects batch at %d: %w", i, err)
		}

		if len(resp.Errors) > 0 {
			first := resp.Errors[0]
			r.log.Error().
				Str("key", aws.ToString(first.Key)).
				Str("code", aws.ToString(first.Code)).
				Str("message", aws.ToString(first.Message)).
				Int("error_count", len(resp.Errors)).
				Msg("partial delete failure")
			return fmt.Errorf("storage: %d objects failed to delete, first error: %s", len(resp.Errors), aws.ToString(first.Message))
		}

		r.log.Debug().Int("count", len(batch)).Int("batch_start", i).Msg("deleted objects batch")
	}

	return nil
}
