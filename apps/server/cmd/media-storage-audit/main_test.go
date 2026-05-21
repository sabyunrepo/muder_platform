package main

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
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

func TestParseFlagsDefaultsToDryRunAndRequiresApplyOptIn(t *testing.T) {
	dryRun := parseFlags([]string{"--theme-id", "c4a4b5ac-51c3-41c9-872e-d701d44ceee7"})
	if dryRun.apply {
		t.Fatal("default apply = true, want false")
	}

	apply := parseFlags([]string{"--theme-id", "c4a4b5ac-51c3-41c9-872e-d701d44ceee7", "--apply"})
	if !apply.apply {
		t.Fatal("--apply did not opt into writes")
	}
}

func TestPlanMediaBackfillMarksLegacyEligibleFromOriginalObject(t *testing.T) {
	themeID := uuid.MustParse("c4a4b5ac-51c3-41c9-872e-d701d44ceee7")
	mediaID := uuid.MustParse("4b8a98b1-7d60-4941-b715-cfd2427fce4c")
	legacyKey := "themes/c4a4b5ac-51c3-41c9-872e-d701d44ceee7/media/4b8a98b1-7d60-4941-b715-cfd2427fce4c/uploads/original.jpg"

	audit := planMediaBackfill(themeID, mediaRow{
		ID:         mediaID,
		Name:       "legacy portrait",
		StorageKey: nullString(legacyKey),
		MimeType:   nullString("image/jpeg"),
		FileSize:   nullInt64(1234),
	}, []keyStatus{
		{Kind: "preview", Key: imageVariantKey(themeID, mediaID, "preview"), Exists: false},
		{Kind: "master", Key: imageVariantKey(themeID, mediaID, "master"), Exists: false},
		{Kind: "thumbnail", Key: imageVariantKey(themeID, mediaID, "thumbnail"), Exists: false},
		{Kind: "db_storage_key", Key: legacyKey, Exists: true, Size: 1234, ContentType: "image/jpeg"},
	})

	if !audit.IsLegacy {
		t.Fatal("IsLegacy = false, want true")
	}
	if !audit.BackfillEligible {
		t.Fatal("BackfillEligible = false, want true")
	}
	if audit.BackfillSourceKey != legacyKey {
		t.Fatalf("BackfillSourceKey = %q, want %q", audit.BackfillSourceKey, legacyKey)
	}
	if audit.Status != "legacy_backfill_eligible" {
		t.Fatalf("Status = %q, want legacy_backfill_eligible", audit.Status)
	}
	wantMissing := []string{
		imageVariantKey(themeID, mediaID, "master"),
		imageVariantKey(themeID, mediaID, "preview"),
		imageVariantKey(themeID, mediaID, "thumbnail"),
	}
	if !reflect.DeepEqual(audit.MissingVariantKeys, wantMissing) {
		t.Fatalf("MissingVariantKeys = %#v, want %#v", audit.MissingVariantKeys, wantMissing)
	}
}

func TestPlanMediaBackfillReportsMissingSourceAsIneligible(t *testing.T) {
	themeID := uuid.MustParse("c4a4b5ac-51c3-41c9-872e-d701d44ceee7")
	mediaID := uuid.MustParse("4b8a98b1-7d60-4941-b715-cfd2427fce4c")
	legacyKey := "themes/c4a4b5ac-51c3-41c9-872e-d701d44ceee7/media/4b8a98b1-7d60-4941-b715-cfd2427fce4c/uploads/original.jpg"

	audit := planMediaBackfill(themeID, mediaRow{
		ID:         mediaID,
		Name:       "missing portrait",
		StorageKey: nullString(legacyKey),
		MimeType:   nullString("image/jpeg"),
		FileSize:   nullInt64(1234),
	}, []keyStatus{
		{Kind: "preview", Key: imageVariantKey(themeID, mediaID, "preview"), Exists: false},
		{Kind: "master", Key: imageVariantKey(themeID, mediaID, "master"), Exists: false},
		{Kind: "thumbnail", Key: imageVariantKey(themeID, mediaID, "thumbnail"), Exists: false},
		{Kind: "db_storage_key", Key: legacyKey, Exists: false},
	})

	if audit.BackfillEligible {
		t.Fatal("BackfillEligible = true, want false")
	}
	if audit.BackfillSourceKey != "" {
		t.Fatalf("BackfillSourceKey = %q, want empty", audit.BackfillSourceKey)
	}
	if audit.Status != "missing_source" {
		t.Fatalf("Status = %q, want missing_source", audit.Status)
	}
	if len(audit.MissingObjects) == 0 {
		t.Fatal("MissingObjects is empty, want source and variant keys reported")
	}
}

func TestApplyMediaBackfillWritesVariantsBeforeDBAndSkipsExistingObjects(t *testing.T) {
	ctx := context.Background()
	themeID := uuid.MustParse("c4a4b5ac-51c3-41c9-872e-d701d44ceee7")
	mediaID := uuid.MustParse("4b8a98b1-7d60-4941-b715-cfd2427fce4c")
	masterKey := imageVariantKey(themeID, mediaID, "master")
	legacyKey := "themes/c4a4b5ac-51c3-41c9-872e-d701d44ceee7/media/4b8a98b1-7d60-4941-b715-cfd2427fce4c/uploads/original.jpg"
	store := &fakeBackfillStorage{
		objects: map[string][]byte{
			legacyKey: []byte("source"),
			masterKey: []byte("existing-master"),
		},
	}
	db := &fakeBackfillDB{}
	audit := mediaAudit{
		MediaID:           mediaID.String(),
		DBStorageKey:      legacyKey,
		IsLegacy:          true,
		BackfillEligible:  true,
		BackfillSourceKey: legacyKey,
		MissingVariantKeys: []string{
			imageVariantKey(themeID, mediaID, "preview"),
			imageVariantKey(themeID, mediaID, "thumbnail"),
		},
		Candidates: []keyStatus{
			{Kind: "master", Key: masterKey, Exists: true, Size: int64(len("existing-master")), ContentType: imageVariantMimeType},
		},
	}

	applied, err := applyMediaBackfill(ctx, store, db, themeID, mediaRow{ID: mediaID, ThemeID: themeID, StorageKey: nullString(legacyKey)}, audit, fakeBuildVariants)
	if err != nil {
		t.Fatalf("applyMediaBackfill() error = %v", err)
	}
	if !applied.Applied {
		t.Fatal("Applied = false, want true")
	}
	if db.storageKey != masterKey {
		t.Fatalf("updated storage key = %q, want %q", db.storageKey, masterKey)
	}
	if db.mimeType != imageVariantMimeType {
		t.Fatalf("updated mime type = %q, want %q", db.mimeType, imageVariantMimeType)
	}
	if db.fileSize != int64(len("existing-master")+len("preview-body")+len("thumbnail-body")) {
		t.Fatalf("updated file size = %d, want sum of master and generated variants", db.fileSize)
	}
	if _, ok := store.objects[masterKey]; !ok {
		t.Fatal("existing master was deleted")
	}
	if bytes.Equal(store.objects[masterKey], []byte("master-body")) {
		t.Fatal("existing master was overwritten")
	}
	if len(store.deleted) != 0 {
		t.Fatalf("deleted keys = %v, want none", store.deleted)
	}
}

func TestApplyMediaBackfillCleansNewVariantsWhenDBUpdateFails(t *testing.T) {
	ctx := context.Background()
	themeID := uuid.MustParse("c4a4b5ac-51c3-41c9-872e-d701d44ceee7")
	mediaID := uuid.MustParse("4b8a98b1-7d60-4941-b715-cfd2427fce4c")
	legacyKey := "themes/c4a4b5ac-51c3-41c9-872e-d701d44ceee7/media/4b8a98b1-7d60-4941-b715-cfd2427fce4c/uploads/original.jpg"
	store := &fakeBackfillStorage{objects: map[string][]byte{legacyKey: []byte("source")}}
	db := &fakeBackfillDB{err: errors.New("db down")}
	audit := mediaAudit{
		MediaID:           mediaID.String(),
		DBStorageKey:      legacyKey,
		IsLegacy:          true,
		BackfillEligible:  true,
		BackfillSourceKey: legacyKey,
		MissingVariantKeys: []string{
			imageVariantKey(themeID, mediaID, "master"),
			imageVariantKey(themeID, mediaID, "preview"),
			imageVariantKey(themeID, mediaID, "thumbnail"),
		},
	}

	_, err := applyMediaBackfill(ctx, store, db, themeID, mediaRow{ID: mediaID, ThemeID: themeID, StorageKey: nullString(legacyKey)}, audit, fakeBuildVariants)
	if err == nil {
		t.Fatal("applyMediaBackfill() error = nil, want error")
	}
	if _, ok := store.objects[legacyKey]; !ok {
		t.Fatal("source object was deleted")
	}
	for _, key := range audit.MissingVariantKeys {
		if _, ok := store.objects[key]; ok {
			t.Fatalf("new variant %s was not cleaned up", key)
		}
	}
	if len(store.deleted) != 3 {
		t.Fatalf("deleted keys = %v, want three generated variants", store.deleted)
	}
}

func TestApplyMediaBackfillReportsCleanupFailure(t *testing.T) {
	ctx := context.Background()
	themeID := uuid.MustParse("c4a4b5ac-51c3-41c9-872e-d701d44ceee7")
	mediaID := uuid.MustParse("4b8a98b1-7d60-4941-b715-cfd2427fce4c")
	legacyKey := "themes/c4a4b5ac-51c3-41c9-872e-d701d44ceee7/media/4b8a98b1-7d60-4941-b715-cfd2427fce4c/uploads/original.jpg"
	store := &fakeBackfillStorage{
		objects:   map[string][]byte{legacyKey: []byte("source")},
		deleteErr: errors.New("r2 delete down"),
	}
	db := &fakeBackfillDB{err: errors.New("db down")}
	audit := mediaAudit{
		MediaID:           mediaID.String(),
		DBStorageKey:      legacyKey,
		IsLegacy:          true,
		BackfillEligible:  true,
		BackfillSourceKey: legacyKey,
		MissingVariantKeys: []string{
			imageVariantKey(themeID, mediaID, "master"),
		},
	}

	applied, err := applyMediaBackfill(ctx, store, db, themeID, mediaRow{ID: mediaID, ThemeID: themeID, StorageKey: nullString(legacyKey)}, audit, fakeBuildVariants)
	if err == nil {
		t.Fatal("applyMediaBackfill() error = nil, want error")
	}
	if applied.CleanupError == "" {
		t.Fatal("CleanupError is empty, want cleanup failure in report")
	}
}

func TestApplyMediaBackfillTreatsStaleRowUpdateAsFailure(t *testing.T) {
	ctx := context.Background()
	themeID := uuid.MustParse("c4a4b5ac-51c3-41c9-872e-d701d44ceee7")
	mediaID := uuid.MustParse("4b8a98b1-7d60-4941-b715-cfd2427fce4c")
	legacyKey := "themes/c4a4b5ac-51c3-41c9-872e-d701d44ceee7/media/4b8a98b1-7d60-4941-b715-cfd2427fce4c/uploads/original.jpg"
	store := &fakeBackfillStorage{objects: map[string][]byte{legacyKey: []byte("source")}}
	db := &fakeBackfillDB{
		wantAuditedStorageKey: "different-key",
		errOnStale:            errors.New("media row not found or changed since audit"),
	}
	audit := mediaAudit{
		MediaID:           mediaID.String(),
		DBStorageKey:      legacyKey,
		IsLegacy:          true,
		BackfillEligible:  true,
		BackfillSourceKey: legacyKey,
		MissingVariantKeys: []string{
			imageVariantKey(themeID, mediaID, "master"),
		},
	}

	_, err := applyMediaBackfill(ctx, store, db, themeID, mediaRow{ID: mediaID, ThemeID: themeID, StorageKey: nullString(legacyKey)}, audit, fakeBuildVariants)
	if err == nil {
		t.Fatal("applyMediaBackfill() error = nil, want stale row error")
	}
	if len(store.deleted) != 1 {
		t.Fatalf("deleted keys = %v, want generated variant cleanup after stale row", store.deleted)
	}
}

func nullString(value string) sqlNullString {
	return sqlNullString{String: value, Valid: true}
}

func nullInt64(value int64) sqlNullInt64 {
	return sqlNullInt64{Int64: value, Valid: true}
}

type fakeBackfillStorage struct {
	objects   map[string][]byte
	deleted   []string
	deleteErr error
}

func (f *fakeBackfillStorage) GetObject(_ context.Context, key string, _ int64) ([]byte, error) {
	body, ok := f.objects[key]
	if !ok {
		return nil, errObjectMissing
	}
	return append([]byte(nil), body...), nil
}

func (f *fakeBackfillStorage) PutObject(_ context.Context, key string, body []byte, _ string) error {
	if f.objects == nil {
		f.objects = make(map[string][]byte)
	}
	f.objects[key] = append([]byte(nil), body...)
	return nil
}

func (f *fakeBackfillStorage) DeleteObjects(_ context.Context, keys []string) error {
	if f.deleteErr != nil {
		return f.deleteErr
	}
	for _, key := range keys {
		delete(f.objects, key)
		f.deleted = append(f.deleted, key)
	}
	return nil
}

type fakeBackfillDB struct {
	storageKey            string
	mimeType              string
	fileSize              int64
	err                   error
	wantAuditedStorageKey string
	errOnStale            error
}

func (f *fakeBackfillDB) UpdateMediaFile(_ context.Context, media mediaRow, storageKey string, fileSize int64, mimeType string) error {
	if f.err != nil {
		return f.err
	}
	if f.wantAuditedStorageKey != "" && media.StorageKey.String != f.wantAuditedStorageKey {
		return f.errOnStale
	}
	f.storageKey = storageKey
	f.fileSize = fileSize
	f.mimeType = mimeType
	return nil
}

func fakeBuildVariants(themeID, mediaID uuid.UUID, _ string, _ []byte) ([]imageVariant, error) {
	return []imageVariant{
		{Name: "master", Key: imageVariantKey(themeID, mediaID, "master"), Body: []byte("master-body"), ContentType: imageVariantMimeType},
		{Name: "preview", Key: imageVariantKey(themeID, mediaID, "preview"), Body: []byte("preview-body"), ContentType: imageVariantMimeType},
		{Name: "thumbnail", Key: imageVariantKey(themeID, mediaID, "thumbnail"), Body: []byte("thumbnail-body"), ContentType: imageVariantMimeType},
	}, nil
}

type sqlNullString = sql.NullString
type sqlNullInt64 = sql.NullInt64
