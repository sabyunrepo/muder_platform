package storage

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// --- GenerateUploadURL / GenerateDownloadURL ---

func TestLocalProvider_GenerateUploadURL(t *testing.T) {
	p := NewLocalProvider("/tmp/uploads", "http://localhost:8080")
	url, err := p.GenerateUploadURL(context.Background(), "theme/img.png", "image/png", 1<<20, time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "http://localhost:8080/api/v1/uploads/theme/img.png"
	if url != want {
		t.Errorf("got %q, want %q", url, want)
	}
}

func TestLocalProvider_GenerateDownloadURL(t *testing.T) {
	p := NewLocalProvider("/tmp/uploads", "http://localhost:8080")
	url, err := p.GenerateDownloadURL(context.Background(), "theme/img.png", time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "http://localhost:8080/api/v1/uploads/theme/img.png"
	if url != want {
		t.Errorf("got %q, want %q", url, want)
	}
}

// --- HeadObject ---

func TestLocalProvider_HeadObject_NotFound(t *testing.T) {
	p := NewLocalProvider(t.TempDir(), "http://localhost:8080")
	_, err := p.HeadObject(context.Background(), "nonexistent.bin")
	if err != ErrObjectNotFound {
		t.Errorf("expected ErrObjectNotFound, got %v", err)
	}
}

func TestLocalProvider_HeadObject_Found(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir, "http://localhost:8080")

	key := "test-file.txt"
	content := []byte("hello storage")
	if err := os.WriteFile(filepath.Join(dir, key), content, 0o644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	meta, err := p.HeadObject(context.Background(), key)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if meta.Key != key {
		t.Errorf("key mismatch: got %q, want %q", meta.Key, key)
	}
	if meta.Size != int64(len(content)) {
		t.Errorf("size mismatch: got %d, want %d", meta.Size, len(content))
	}
}

// --- GetObjectRange ---

func TestLocalProvider_GetObjectRange_NotFound(t *testing.T) {
	p := NewLocalProvider(t.TempDir(), "http://localhost:8080")
	_, err := p.GetObjectRange(context.Background(), "missing.bin", 0, 10)
	if err != ErrObjectNotFound {
		t.Errorf("expected ErrObjectNotFound, got %v", err)
	}
}

func TestLocalProvider_GetObjectRange_ReadsBytes(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir, "http://localhost:8080")

	content := []byte("abcdefghijklmnopqrstuvwxyz")
	key := "range-test.bin"
	if err := os.WriteFile(filepath.Join(dir, key), content, 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	rc, err := p.GetObjectRange(context.Background(), key, 5, 10)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	defer rc.Close()

	got, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	want := content[5:15]
	if !bytes.Equal(got, want) {
		t.Errorf("got %q, want %q", got, want)
	}
}

// --- DeleteObject ---

func TestLocalProvider_DeleteObject_NotExist_NoError(t *testing.T) {
	p := NewLocalProvider(t.TempDir(), "http://localhost:8080")
	// deleting non-existent is a no-op (not an error) per implementation
	if err := p.DeleteObject(context.Background(), "ghost.bin"); err != nil {
		t.Errorf("unexpected error deleting nonexistent: %v", err)
	}
}

func TestLocalProvider_DeleteObject_Existing(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir, "http://localhost:8080")

	key := "to-delete.txt"
	if err := os.WriteFile(filepath.Join(dir, key), []byte("bye"), 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	if err := p.DeleteObject(context.Background(), key); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := os.Stat(filepath.Join(dir, key)); !os.IsNotExist(err) {
		t.Error("file should be gone after DeleteObject")
	}
}

// --- DeleteObjects ---

func TestLocalProvider_DeleteObjects_Empty(t *testing.T) {
	p := NewLocalProvider(t.TempDir(), "http://localhost:8080")
	if err := p.DeleteObjects(context.Background(), nil); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestLocalProvider_DeleteObjects_Multiple(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir, "http://localhost:8080")

	keys := []string{"a.txt", "b.txt", "c.txt"}
	for _, k := range keys {
		if err := os.WriteFile(filepath.Join(dir, k), []byte(k), 0o644); err != nil {
			t.Fatalf("write %s: %v", k, err)
		}
	}

	if err := p.DeleteObjects(context.Background(), keys); err != nil {
		t.Fatalf("DeleteObjects: %v", err)
	}
	for _, k := range keys {
		if _, err := os.Stat(filepath.Join(dir, k)); !os.IsNotExist(err) {
			t.Errorf("%s should be deleted", k)
		}
	}
}

// --- UploadHandler ---

func TestLocalProvider_UploadHandler_PutCreatesFile(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir, "http://localhost:8080")
	handler := p.UploadHandler()

	body := []byte("file content")
	req := httptest.NewRequest(http.MethodPut, "/api/v1/uploads/myfile.txt", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	// file content must match what was PUT
	got, err := os.ReadFile(filepath.Join(dir, "myfile.txt"))
	if err != nil {
		t.Fatalf("read uploaded file: %v", err)
	}
	if !bytes.Equal(got, body) {
		t.Errorf("content mismatch: got %q, want %q", got, body)
	}
}

func TestLocalProvider_UploadHandler_NonPutRejected(t *testing.T) {
	p := NewLocalProvider(t.TempDir(), "http://localhost:8080")
	handler := p.UploadHandler()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads/x.bin", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code == http.StatusOK {
		t.Error("POST should be rejected")
	}
}

func TestLocalProvider_UploadHandler_PathTraversalRejected(t *testing.T) {
	p := NewLocalProvider(t.TempDir(), "http://localhost:8080")
	handler := p.UploadHandler()

	// Attempt path traversal via URL
	req := httptest.NewRequest(http.MethodPut, "/api/v1/uploads/../../../etc/passwd", strings.NewReader("evil"))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code == http.StatusOK {
		t.Error("path traversal should be rejected")
	}
}

// --- ServeHandler ---

func TestLocalProvider_ServeHandler_ServesFile(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir, "http://localhost:8080")

	key := "served.txt"
	content := []byte("served content")
	if err := os.WriteFile(filepath.Join(dir, key), content, 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	handler := p.ServeHandler()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/uploads/"+key, nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}
	if !bytes.Equal(rec.Body.Bytes(), content) {
		t.Errorf("body mismatch")
	}
}

func TestLocalProvider_ServeHandler_PathTraversalRejected(t *testing.T) {
	p := NewLocalProvider(t.TempDir(), "http://localhost:8080")
	handler := p.ServeHandler()

	req := httptest.NewRequest(http.MethodGet, "/api/v1/uploads/../../../etc/passwd", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code == http.StatusOK {
		t.Error("path traversal should be rejected")
	}
}

// --- limitedReadCloser (via GetObjectRange) ---

func TestLimitedReadCloser_ClosesUnderlying(t *testing.T) {
	dir := t.TempDir()
	p := NewLocalProvider(dir, "http://localhost:8080")

	content := make([]byte, 100)
	for i := range content {
		content[i] = byte(i)
	}
	key := "lrc.bin"
	if err := os.WriteFile(filepath.Join(dir, key), content, 0o644); err != nil {
		t.Fatalf("write: %v", err)
	}

	rc, err := p.GetObjectRange(context.Background(), key, 0, 10)
	if err != nil {
		t.Fatalf("get range: %v", err)
	}

	if err := rc.Close(); err != nil {
		t.Errorf("close error: %v", err)
	}
}
