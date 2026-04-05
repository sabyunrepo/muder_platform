package postgres

import (
	"testing"
)

func TestNew_InvalidURL(t *testing.T) {
	_, err := New("not-a-valid-url")
	if err == nil {
		t.Fatal("expected error for invalid URL")
	}
}

func TestNew_EmptyURL(t *testing.T) {
	_, err := New("")
	if err == nil {
		t.Fatal("expected error for empty URL")
	}
}
