package main

import (
	"reflect"
	"testing"

	"github.com/google/uuid"
)

func TestParseDotEnvLine(t *testing.T) {
	tests := []struct {
		name      string
		line      string
		wantKey   string
		wantValue string
		wantOK    bool
		wantErr   bool
	}{
		{name: "blank", line: "   ", wantOK: false},
		{name: "comment", line: "# DATABASE_URL=hidden", wantOK: false},
		{name: "single quoted", line: "DATABASE_URL='postgres://localhost/mmf'", wantKey: "DATABASE_URL", wantValue: "postgres://localhost/mmf", wantOK: true},
		{name: "double quoted", line: `STORAGE_R2_BUCKET="murder"`, wantKey: "STORAGE_R2_BUCKET", wantValue: "murder", wantOK: true},
		{name: "export prefix", line: `export STORAGE_PROVIDER=r2`, wantKey: "STORAGE_PROVIDER", wantValue: "r2", wantOK: true},
		{name: "invalid", line: "DATABASE_URL", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotKey, gotValue, gotOK, err := parseDotEnvLine(tt.line)
			if tt.wantErr {
				if err == nil {
					t.Fatal("parseDotEnvLine() error = nil, want error")
				}
				return
			}
			if err != nil {
				t.Fatalf("parseDotEnvLine() error = %v", err)
			}
			if gotKey != tt.wantKey || gotValue != tt.wantValue || gotOK != tt.wantOK {
				t.Fatalf("parseDotEnvLine() = (%q, %q, %v), want (%q, %q, %v)", gotKey, gotValue, gotOK, tt.wantKey, tt.wantValue, tt.wantOK)
			}
		})
	}
}

func TestCandidateKeysDedupesStorageKey(t *testing.T) {
	themeID := uuid.MustParse("c4a4b5ac-51c3-41c9-872e-d701d44ceee7")
	mediaID := uuid.MustParse("4b8a98b1-7d60-4941-b715-cfd2427fce4c")
	storageKey := "themes/c4a4b5ac-51c3-41c9-872e-d701d44ceee7/media/4b8a98b1-7d60-4941-b715-cfd2427fce4c/master.webp"

	got := candidateKeys(themeID, mediaID, storageKey)
	want := []candidateKey{
		{Kind: "preview", Key: "themes/c4a4b5ac-51c3-41c9-872e-d701d44ceee7/media/4b8a98b1-7d60-4941-b715-cfd2427fce4c/preview.webp"},
		{Kind: "master", Key: storageKey},
		{Kind: "thumbnail", Key: "themes/c4a4b5ac-51c3-41c9-872e-d701d44ceee7/media/4b8a98b1-7d60-4941-b715-cfd2427fce4c/thumbnail.webp"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("candidateKeys() = %#v, want %#v", got, want)
	}
}
