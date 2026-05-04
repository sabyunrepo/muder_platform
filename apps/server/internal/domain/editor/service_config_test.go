package editor

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/mmp-platform/server/internal/apperror"
	"github.com/mmp-platform/server/internal/middleware"
)

// TestUpdateConfigJson_Service_Success verifies the happy path: a correct
// version bumps the theme version and persists config_json. Named with
// _Service_ suffix to avoid collision with the handler-level success test.
func TestUpdateConfigJson_Service_Success(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()

	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	resp, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID,
		json.RawMessage(`{"phases":["intro","discussion"]}`))
	if err != nil {
		t.Fatalf("UpdateConfigJson: %v", err)
	}
	if resp == nil {
		t.Fatal("expected response, got nil")
	}
	if resp.Version != 2 {
		t.Errorf("expected version 2 after first update (initial=1), got %d", resp.Version)
	}
	// Compare as parsed JSON — postgres may re-serialize with whitespace.
	var got, want map[string]any
	if err := json.Unmarshal(resp.ConfigJson, &got); err != nil {
		t.Fatalf("parse got config_json: %v", err)
	}
	if err := json.Unmarshal([]byte(`{"phases":["intro","discussion"]}`), &want); err != nil {
		t.Fatalf("parse want: %v", err)
	}
	gotJSON, _ := json.Marshal(got)
	wantJSON, _ := json.Marshal(want)
	if string(gotJSON) != string(wantJSON) {
		t.Errorf("unexpected config_json: got=%s want=%s", gotJSON, wantJSON)
	}
}

// TestUpdateConfigJson_VersionMismatch_CarriesCurrentVersion verifies that
// an optimistic lock failure returns 409 with extensions.current_version equal
// to the actual current DB version, so the client can rebase without an extra
// round-trip. This is the core fix shipped in PR-2.
//
// The test uses service.preUpdateHook to deterministically inject a version
// bump between the service's getOwnedTheme read and the UpdateThemeConfigJson
// write — eliminating the previous goroutine+race approach that could fall
// back to calling buildConfigVersionConflict directly (which bypassed the real
// service path entirely).
func TestUpdateConfigJson_VersionMismatch_CarriesCurrentVersion(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()

	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	// First update: version 1 -> 2 (establishes a non-trivial starting version).
	if _, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID,
		json.RawMessage(`{"step":1}`)); err != nil {
		t.Fatalf("first UpdateConfigJson: %v", err)
	}

	// Cast to *service so we can install the test hook. This is the same
	// pattern as TestUpdateConfigJson_AuditLog_EmitsInfoWithRequestID which
	// builds a service directly — UpdateConfigJson and buildConfigVersionConflict
	// are both reachable through this handle.
	testSvc, ok := f.svc.(*service)
	if !ok {
		t.Skip("service is not *service; cannot install preUpdateHook")
	}

	// Install the hook: after getOwnedTheme reads version=2, bump it to 3 so
	// the subsequent UPDATE WHERE version=2 finds 0 rows → pgx.ErrNoRows →
	// buildConfigVersionConflict re-reads version=3 and embeds it.
	testSvc.preUpdateHook = func(hookCtx context.Context, hookThemeID uuid.UUID) {
		if _, bumpErr := f.pool.Exec(hookCtx,
			`UPDATE themes SET version = version + 1 WHERE id = $1`, hookThemeID); bumpErr != nil {
			t.Errorf("preUpdateHook: bump version: %v", bumpErr)
		}
	}
	defer func() { testSvc.preUpdateHook = nil }()

	// Read the version that will be current after the hook fires (2+1=3).
	// This is what buildConfigVersionConflict should re-read and embed.
	currentBeforeCall, err := f.q.GetTheme(ctx, themeID)
	if err != nil {
		t.Fatalf("GetTheme before call: %v", err)
	}
	expectedVersion := currentBeforeCall.Version + 1 // hook will bump by 1

	// Call UpdateConfigJson — the hook fires mid-flight, the UPDATE misses, and
	// the service returns a 409 carrying the actual current version.
	_, svcErr := f.svc.UpdateConfigJson(ctx, creatorID, themeID,
		json.RawMessage(`{"will":"conflict"}`))
	if svcErr == nil {
		t.Fatal("expected version-conflict error, got nil")
	}

	var appErr *apperror.AppError
	if !errors.As(svcErr, &appErr) {
		t.Fatalf("expected *apperror.AppError, got %T: %v", svcErr, svcErr)
	}
	if appErr.Status != http.StatusConflict {
		t.Errorf("expected 409, got %d", appErr.Status)
	}
	if appErr.Code != apperror.ErrEditorConfigVersionMismatch {
		t.Errorf("expected code %s, got %s", apperror.ErrEditorConfigVersionMismatch, appErr.Code)
	}
	if appErr.Extensions == nil {
		t.Fatal("expected extensions map, got nil")
	}
	cv, ok := appErr.Extensions["current_version"]
	if !ok {
		t.Fatal("expected extensions.current_version to be present")
	}
	// Assert the carried version equals the actual post-bump DB version (not
	// just "is positive") — verifying that UpdateConfigJson and
	// buildConfigVersionConflict propagate the correct value end-to-end.
	var cvInt int32
	switch v := cv.(type) {
	case int32:
		cvInt = v
	case int64:
		cvInt = int32(v)
	case int:
		cvInt = int32(v)
	default:
		t.Fatalf("unexpected type for current_version: %T", cv)
	}
	if cvInt != expectedVersion {
		t.Errorf("current_version: got %d, want %d (post-hook DB version)", cvInt, expectedVersion)
	}
}

// TestUpdateConfigJson_NotOwned verifies ownership check short-circuits before
// the UPDATE query runs.
func TestUpdateConfigJson_NotOwned(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()

	owner := f.createUser(t)
	intruder := f.createUser(t)
	themeID := f.createThemeForUser(t, owner)

	_, err := f.svc.UpdateConfigJson(ctx, intruder, themeID,
		json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("expected forbidden error, got nil")
	}
	var appErr *apperror.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *apperror.AppError, got %T", err)
	}
	if appErr.Code != apperror.ErrForbidden {
		t.Errorf("expected FORBIDDEN, got %s", appErr.Code)
	}
}

// TestUpdateConfigJson_NotFound verifies a bogus theme UUID surfaces NotFound.
func TestUpdateConfigJson_NotFound(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()

	creatorID := f.createUser(t)

	_, err := f.svc.UpdateConfigJson(ctx, creatorID, uuid.New(),
		json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("expected not found, got nil")
	}
	var appErr *apperror.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *apperror.AppError, got %T", err)
	}
	if appErr.Code != apperror.ErrNotFound {
		t.Errorf("expected NOT_FOUND, got %s", appErr.Code)
	}
}

// TestUpdateConfigJson_RejectsLegacyShape verifies that UpdateConfigJson rejects
// all four known legacy config shapes (D-19/D-20 forward-only gate).
func TestUpdateConfigJson_RejectsLegacyShape(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	cases := []struct {
		name  string
		input json.RawMessage
		want  string
	}{
		{
			name:  "modules array",
			input: json.RawMessage(`{"modules": [{"id": "voting"}]}`),
			want:  "legacy modules shape rejected (D-19)",
		},
		{
			name:  "clue_placement key",
			input: json.RawMessage(`{"modules": {}, "clue_placement": {"c1": "library"}}`),
			want:  "legacy clue_placement key rejected (D-20)",
		},
		{
			name:  "module_configs key",
			input: json.RawMessage(`{"modules": {"voting": {"enabled": true}}, "module_configs": {}}`),
			want:  "legacy module_configs key rejected (D-19)",
		},
		{
			name:  "character_clues key",
			input: json.RawMessage(`{"modules": {}, "character_clues": {}}`),
			want:  "legacy character_clues key rejected (D-20)",
		},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			_, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, tc.input)
			if err == nil {
				t.Fatalf("expected error for %s, got nil", tc.name)
			}
			if !errors.As(err, new(*apperror.AppError)) {
				t.Fatalf("expected *apperror.AppError for %s, got %T: %v", tc.name, err, err)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Errorf("expected error to contain %q, got: %v", tc.want, err)
			}
		})
	}
}

// TestUpdateConfigJson_RejectsTopLevelNull verifies that a literal JSON null body
// (not {"modules":null}) is rejected before any key-access — the cfg map would be
// nil after Unmarshal and subsequent key lookups would silently no-op (round-2 CR).
func TestUpdateConfigJson_RejectsTopLevelNull(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	_, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, json.RawMessage(`null`))
	if err == nil {
		t.Fatal("expected error for top-level JSON null, got nil")
	}
	if !strings.Contains(err.Error(), "null/non-object rejected") {
		t.Errorf("expected error to contain %q, got: %v", "null/non-object rejected", err)
	}
}

// TestUpdateConfigJson_RejectsNullModules verifies that {"modules": null} produces
// a distinct error from the legacy-array case (H3 — round-2 review gap).
func TestUpdateConfigJson_RejectsNullModules(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	_, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, json.RawMessage(`{"modules": null}`))
	if err == nil {
		t.Fatal("expected error for null modules, got nil")
	}
	// Distinct error message — NOT the "legacy modules shape" message
	if !strings.Contains(err.Error(), "modules cannot be null") {
		t.Errorf("expected error to contain %q, got: %v", "modules cannot be null", err)
	}
	if strings.Contains(err.Error(), "legacy modules shape") {
		t.Errorf("null modules should produce a distinct error from legacy-array case, got: %v", err)
	}
}

// TestUpdateConfigJson_RejectsLocationsDeadKey verifies that locations[].clueIds
// (top-level, not nested under locationClueConfig) is rejected on write (H2 — D-20 gate).
func TestUpdateConfigJson_RejectsLocationsDeadKey(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	cases := []struct {
		name  string
		input json.RawMessage
		want  string
	}{
		{
			name: "first location has dead key",
			input: json.RawMessage(`{
				"modules": {},
				"locations": [{"id": "library", "clueIds": ["c1"]}]
			}`),
			want: "locations[0].clueIds",
		},
		{
			name: "second location has dead key",
			input: json.RawMessage(`{
				"modules": {},
				"locations": [
					{"id": "library", "locationClueConfig": {"clueIds": ["c1"]}},
					{"id": "study", "clueIds": ["c2"]}
				]
			}`),
			want: "locations[1].clueIds",
		},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			_, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, tc.input)
			if err == nil {
				t.Fatalf("expected error for %s, got nil", tc.name)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Errorf("expected error to contain %q, got: %v", tc.want, err)
			}
			if !strings.Contains(err.Error(), "D-20") {
				t.Errorf("expected error to contain %q, got: %v", "D-20", err)
			}
		})
	}
}

func TestUpdateConfigJson_ValidatesClueInteractionItemEffects(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	clueID := uuid.NewString()
	rewardClueID := uuid.NewString()

	valid := json.RawMessage(fmt.Sprintf(`{
		"modules": {
			"clue_interaction": {
				"enabled": true,
				"config": {
					"itemEffects": {
						"%s": {
							"effect": "grant_clue",
							"target": "self",
							"consume": true,
							"grantClueIds": ["%s"]
						}
					}
				}
			}
		}
	}`, clueID, rewardClueID))
	if _, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, valid); err != nil {
		t.Fatalf("valid clue_interaction itemEffects must save: %v", err)
	}

	validCases := []struct {
		name  string
		input json.RawMessage
	}{
		{
			name:  "no clue interaction module",
			input: json.RawMessage(`{"modules":{"voting":{"enabled":false}}}`),
		},
		{
			name:  "clue interaction without config",
			input: json.RawMessage(`{"modules":{"clue_interaction":{"enabled":true}}}`),
		},
		{
			name:  "clue interaction empty config",
			input: json.RawMessage(`{"modules":{"clue_interaction":{"enabled":true,"config":{}}}}`),
		},
		{
			name:  "clue interaction empty item effects",
			input: json.RawMessage(`{"modules":{"clue_interaction":{"enabled":true,"config":{"itemEffects":{}}}}}`),
		},
	}
	for _, tc := range validCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			if _, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, tc.input); err != nil {
				t.Fatalf("expected valid config for %s, got: %v", tc.name, err)
			}
		})
	}

	cases := []struct {
		name  string
		input json.RawMessage
		want  string
	}{
		{
			name: "clue interaction module must be object",
			input: json.RawMessage(`{
				"modules": {
					"clue_interaction": true
				}
			}`),
			want: "modules.clue_interaction must be an object",
		},
		{
			name: "null clue interaction config",
			input: json.RawMessage(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": null
					}
				}
			}`),
			want: "config cannot be null",
		},
		{
			name: "clue interaction config must be object",
			input: json.RawMessage(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": []
					}
				}
			}`),
			want: "config must be an object",
		},
		{
			name: "item effects must be object",
			input: json.RawMessage(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": []}
					}
				}
			}`),
			want: "itemEffects must be an object",
		},
		{
			name: "invalid item effect clue id",
			input: json.RawMessage(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"clue-1": {"effect": "reveal", "revealText": "비밀"}}}
					}
				}
			}`),
			want: "invalid clue id",
		},
		{
			name: "null item effects",
			input: json.RawMessage(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": null}
					}
				}
			}`),
			want: "itemEffects cannot be null",
		},
		{
			name: "item effect must be object",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": null}}
					}
				}
			}`, clueID)),
			want: "must be an object",
		},
		{
			name: "effect is required",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"target": "self"}}}
					}
				}
			}`, clueID)),
			want: "effect is required",
		},
		{
			name: "reveal requires text",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "reveal"}}}
					}
				}
			}`, clueID)),
			want: "revealText is required",
		},
		{
			name: "target cannot be null",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "reveal", "target": null, "revealText": "비밀"}}}
					}
				}
			}`, clueID)),
			want: "target cannot be null",
		},
		{
			name: "target must be supported",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "peek", "target": "room"}}}
					}
				}
			}`, clueID)),
			want: "target must be self or player",
		},
		{
			name: "consume cannot be null",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "reveal", "consume": null, "revealText": "비밀"}}}
					}
				}
			}`, clueID)),
			want: "consume cannot be null",
		},
		{
			name: "consume must be boolean",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "peek", "consume": "yes"}}}
					}
				}
			}`, clueID)),
			want: "consume must be boolean",
		},
		{
			name: "grant requires ids",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "grant_clue", "grantClueIds": []}}}
					}
				}
			}`, clueID)),
			want: "grantClueIds is required",
		},
		{
			name: "grant ids must contain strings",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "grant_clue", "grantClueIds": [123]}}}
					}
				}
			}`, clueID)),
			want: "grantClueIds must contain strings",
		},
		{
			name: "grant ids must be valid uuids",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "grant_clue", "grantClueIds": ["clue-2"]}}}
					}
				}
			}`, clueID)),
			want: "has invalid clue id",
		},
		{
			name: "unsupported effect",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "steal"}}}
					}
				}
			}`, clueID)),
			want: "is not supported",
		},
		{
			name: "unknown effect field",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {
					"clue_interaction": {
						"enabled": true,
						"config": {"itemEffects": {"%s": {"effect": "peek", "debugOnly": true}}}
					}
				}
			}`, clueID)),
			want: "debugOnly is not supported",
		},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			_, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, tc.input)
			if err == nil {
				t.Fatalf("expected error for %s, got nil", tc.name)
			}
			var appErr *apperror.AppError
			if !errors.As(err, &appErr) {
				t.Fatalf("expected *apperror.AppError for %s, got %T: %v", tc.name, err, err)
			}
			if appErr.Status != http.StatusBadRequest {
				t.Fatalf("expected status 400 for %s, got %d", tc.name, appErr.Status)
			}
			if !strings.Contains(err.Error(), tc.want) {
				t.Errorf("expected error to contain %q, got: %v", tc.want, err)
			}
		})
	}
}

// TestUpdateConfigJson_AcceptsNewLocationsShape verifies that the correct new shape
// (locationClueConfig.clueIds) is NOT rejected by the dead-key gate (H2 regression).
func TestUpdateConfigJson_AcceptsNewLocationsShape(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	input := json.RawMessage(`{
		"modules": {},
		"locations": [{"id": "library", "locationClueConfig": {"clueIds": ["c1"]}}]
	}`)
	_, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, input)
	if err != nil {
		t.Fatalf("new-shape locationClueConfig.clueIds must NOT be rejected, got: %v", err)
	}
}

// TestUpdateConfigJson_AcceptsNewShape verifies that UpdateConfigJson accepts
// a valid new-shape config and bumps the version (D-19/D-20 forward-only gate).
func TestUpdateConfigJson_AcceptsNewShape(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	newShape := json.RawMessage(`{
		"modules": {"voting": {"enabled": true, "config": {"mode": "open"}}},
		"locations": [{"id": "library", "locationClueConfig": {"clueIds": ["c1"]}}]
	}`)

	updated, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, newShape)
	if err != nil {
		t.Fatalf("UpdateConfigJson with new shape: %v", err)
	}
	if updated.Version <= 1 {
		t.Errorf("expected version > 1 after update, got %d", updated.Version)
	}
}

// TestUpdateConfigJson_AuditLog_EmitsInfoWithRequestID verifies the success
// path emits a structured audit log with theme_id, version transitions, and
// the request_id injected by middleware.RequestID into the context. This is
// the audit trail we rely on for operational forensics (who changed what,
// correlated across the full trace).
func TestUpdateConfigJson_AuditLog_EmitsInfoWithRequestID(t *testing.T) {
	f := setupFixture(t)

	// Build a logger that writes JSON into a buffer so we can inspect the
	// structured fields, then rebuild a service over the fixture's pool/q
	// using that logger.
	buf := &bytes.Buffer{}
	auditLogger := zerolog.New(buf)
	svc := NewService(f.q, f.pool, auditLogger)

	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	// Simulate middleware.RequestID by running the call inside a real HTTP
	// request context wrapped by the middleware — this guarantees we exercise
	// the same code path middleware uses in production.
	const wantRID = "test-req-id-abc"
	req := httptest.NewRequest("POST", "/x", nil)
	req.Header.Set("X-Request-ID", wantRID)

	var innerErr error
	handler := middleware.RequestID(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		_, innerErr = svc.UpdateConfigJson(r.Context(), creatorID, themeID,
			json.RawMessage(`{"phases":["intro"]}`))
	}))
	handler.ServeHTTP(httptest.NewRecorder(), req)
	if innerErr != nil {
		t.Fatalf("UpdateConfigJson: %v", innerErr)
	}

	// Decode the last JSON line — there should be exactly one Info emission
	// from the success path.
	line := bytes.TrimSpace(buf.Bytes())
	if len(line) == 0 {
		t.Fatal("expected audit log line, got empty buffer")
	}
	var entry map[string]interface{}
	if err := json.Unmarshal(line, &entry); err != nil {
		t.Fatalf("unmarshal audit log line %q: %v", string(line), err)
	}

	if got := entry["message"]; got != "theme config updated" {
		t.Errorf("message: want %q, got %v", "theme config updated", got)
	}
	if got := entry["level"]; got != "info" {
		t.Errorf("level: want info, got %v", got)
	}
	if got := entry["theme_id"]; got != themeID.String() {
		t.Errorf("theme_id: want %s, got %v", themeID, got)
	}
	if got := entry["creator_id"]; got != creatorID.String() {
		t.Errorf("creator_id: want %s, got %v", creatorID, got)
	}
	if got := entry["request_id"]; got != wantRID {
		t.Errorf("request_id: want %q, got %v", wantRID, got)
	}
	// version_from=1 (initial), version_to=2 after first update. JSON numbers
	// decode as float64.
	if got, _ := entry["version_from"].(float64); got != 1 {
		t.Errorf("version_from: want 1, got %v", entry["version_from"])
	}
	if got, _ := entry["version_to"].(float64); got != 2 {
		t.Errorf("version_to: want 2, got %v", entry["version_to"])
	}
}
