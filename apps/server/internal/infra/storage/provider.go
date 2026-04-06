package storage

import (
	"context"
	"errors"
	"io"
	"time"
)

// ErrObjectNotFound is returned when a requested object does not exist.
var ErrObjectNotFound = errors.New("storage: object not found")

// ObjectMeta contains metadata about a stored object.
type ObjectMeta struct {
	Key         string
	Size        int64
	ContentType string
	ETag        string
}

// Provider defines the interface for object storage operations.
type Provider interface {
	GenerateUploadURL(ctx context.Context, key string, contentType string, maxSize int64, expiry time.Duration) (string, error)
	GenerateDownloadURL(ctx context.Context, key string, expiry time.Duration) (string, error)
	HeadObject(ctx context.Context, key string) (*ObjectMeta, error)
	GetObjectRange(ctx context.Context, key string, offset int64, length int64) (io.ReadCloser, error)
	DeleteObject(ctx context.Context, key string) error
	DeleteObjects(ctx context.Context, keys []string) error
}
