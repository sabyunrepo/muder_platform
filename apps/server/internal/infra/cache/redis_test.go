package cache

import (
	"testing"
)

func TestNewRedis_InvalidURL(t *testing.T) {
	_, err := NewRedis("not-a-valid-url")
	if err == nil {
		t.Fatal("expected error for invalid URL")
	}
}

func TestNewRedis_EmptyURL(t *testing.T) {
	_, err := NewRedis("")
	if err == nil {
		t.Fatal("expected error for empty URL")
	}
}
