package storage

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

// LocalProvider is a dev-only storage provider that saves files to a local
// directory and serves them via a simple HTTP endpoint.
// It should NEVER be used in production.
type LocalProvider struct {
	baseDir string
	baseURL string
	log     zerolog.Logger
}

// NewLocalProvider creates a LocalProvider that stores files under baseDir
// and generates URLs prefixed with baseURL.
// baseDir example: "tmp/uploads"
// baseURL example: "http://localhost:8080"
func NewLocalProvider(baseDir string, baseURL string) *LocalProvider {
	return &LocalProvider{
		baseDir: baseDir,
		baseURL: baseURL,
		log:     zerolog.Nop(),
	}
}

// NewLocalProviderWithLogger creates a LocalProvider with a zerolog logger.
func NewLocalProviderWithLogger(baseDir string, baseURL string, log zerolog.Logger) *LocalProvider {
	return &LocalProvider{
		baseDir: baseDir,
		baseURL: baseURL,
		log:     log.With().Str("component", "storage.local").Logger(),
	}
}

// GenerateUploadURL returns a local URL the frontend can PUT to.
// The expiry and maxSize are ignored for local storage.
func (l *LocalProvider) GenerateUploadURL(_ context.Context, key string, _ string, _ int64, _ time.Duration) (string, error) {
	l.log.Debug().Str("key", key).Msg("generated local upload URL")
	return fmt.Sprintf("%s/api/v1/uploads/%s", l.baseURL, key), nil
}

// GenerateDownloadURL returns a local URL the frontend can GET from.
func (l *LocalProvider) GenerateDownloadURL(_ context.Context, key string, _ time.Duration) (string, error) {
	l.log.Debug().Str("key", key).Msg("generated local download URL")
	return fmt.Sprintf("%s/api/v1/uploads/%s", l.baseURL, key), nil
}

// HeadObject returns metadata about a locally stored file.
func (l *LocalProvider) HeadObject(_ context.Context, key string) (*ObjectMeta, error) {
	path := filepath.Join(l.baseDir, filepath.FromSlash(key))
	info, err := os.Stat(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrObjectNotFound
		}
		return nil, fmt.Errorf("storage: local head object: %w", err)
	}
	return &ObjectMeta{
		Key:  key,
		Size: info.Size(),
	}, nil
}

// GetObjectRange reads a byte range from a locally stored file.
func (l *LocalProvider) GetObjectRange(_ context.Context, key string, offset int64, length int64) (io.ReadCloser, error) {
	path := filepath.Join(l.baseDir, filepath.FromSlash(key))
	f, err := os.Open(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrObjectNotFound
		}
		return nil, fmt.Errorf("storage: local get object range: %w", err)
	}
	if _, err := f.Seek(offset, io.SeekStart); err != nil {
		_ = f.Close()
		return nil, fmt.Errorf("storage: local seek: %w", err)
	}
	return &limitedReadCloser{r: io.LimitReader(f, length), c: f}, nil
}

// DeleteObject removes a locally stored file.
func (l *LocalProvider) DeleteObject(_ context.Context, key string) error {
	path := filepath.Join(l.baseDir, filepath.FromSlash(key))
	err := os.Remove(path)
	if err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("storage: local delete object: %w", err)
	}
	l.log.Debug().Str("key", key).Msg("deleted local object")
	return nil
}

// DeleteObjects removes multiple locally stored files.
func (l *LocalProvider) DeleteObjects(ctx context.Context, keys []string) error {
	for _, key := range keys {
		if err := l.DeleteObject(ctx, key); err != nil {
			return err
		}
	}
	return nil
}

// UploadHandler returns an http.HandlerFunc that accepts PUT requests to save
// file data at the given key path (extracted from the URL after /api/v1/uploads/).
func (l *LocalProvider) UploadHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// The URL pattern is /api/v1/uploads/{key...}
		// chi wildcard gives us the trailing path after the prefix.
		key := r.PathValue("key")
		if key == "" {
			// Fallback: strip the fixed prefix manually.
			const prefix = "/api/v1/uploads/"
			if len(r.URL.Path) > len(prefix) {
				key = r.URL.Path[len(prefix):]
			}
		}
		if key == "" {
			http.Error(w, "missing key", http.StatusBadRequest)
			return
		}

		destPath := filepath.Join(l.baseDir, filepath.FromSlash(key))

		// Guard against path traversal: ensure resolved path stays within baseDir.
		absBase, _ := filepath.Abs(l.baseDir)
		absDest, _ := filepath.Abs(destPath)
		if !strings.HasPrefix(absDest, absBase+string(os.PathSeparator)) {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}

		if err := os.MkdirAll(filepath.Dir(destPath), 0o755); err != nil {
			l.log.Error().Err(err).Str("path", destPath).Msg("failed to create upload directory")
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		f, err := os.Create(destPath)
		if err != nil {
			l.log.Error().Err(err).Str("path", destPath).Msg("failed to create upload file")
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		defer f.Close()

		r.Body = http.MaxBytesReader(w, r.Body, 10<<20) // 10MB hard cap
		if _, err := io.Copy(f, r.Body); err != nil {
			l.log.Error().Err(err).Str("path", destPath).Msg("failed to write upload file")
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}

		l.log.Debug().Str("key", key).Str("path", destPath).Msg("local file uploaded")
		w.WriteHeader(http.StatusOK)
	}
}

// ServeHandler returns an http.HandlerFunc that serves locally stored files.
func (l *LocalProvider) ServeHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		key := r.PathValue("key")
		if key == "" {
			const prefix = "/api/v1/uploads/"
			if len(r.URL.Path) > len(prefix) {
				key = r.URL.Path[len(prefix):]
			}
		}
		if key == "" {
			http.Error(w, "missing key", http.StatusBadRequest)
			return
		}

		filePath := filepath.Join(l.baseDir, filepath.FromSlash(key))

		// Guard against path traversal: ensure resolved path stays within baseDir.
		absBase, _ := filepath.Abs(l.baseDir)
		absDest, _ := filepath.Abs(filePath)
		if !strings.HasPrefix(absDest, absBase+string(os.PathSeparator)) {
			http.Error(w, "invalid path", http.StatusBadRequest)
			return
		}

		http.ServeFile(w, r, filePath)
	}
}

// limitedReadCloser combines an io.Reader with an io.Closer so we can close
// the underlying file after the limited read is done.
type limitedReadCloser struct {
	r io.Reader
	c io.Closer
}

func (l *limitedReadCloser) Read(p []byte) (int, error) { return l.r.Read(p) }
func (l *limitedReadCloser) Close() error               { return l.c.Close() }
