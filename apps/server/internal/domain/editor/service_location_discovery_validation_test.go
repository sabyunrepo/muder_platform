package editor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/google/uuid"

	"github.com/mmp-platform/server/internal/apperror"
)

func TestUpdateConfigJson_ValidatesLocationDiscoveries(t *testing.T) {
	fixture := setupLocationDiscoveryValidationFixture(t)
	assertValidLocationDiscoveryConfig(t, fixture)
	assertInvalidLocationDiscoveryConfigs(t, fixture)
}

func TestUpdateConfigJson_LocationDiscoveriesSurviveDeleteCleanup(t *testing.T) {
	fixture := setupLocationDiscoveryValidationFixture(t)
	config := locationDiscoveryCleanupConfig(fixture)
	if _, err := fixture.f.svc.UpdateConfigJson(fixture.ctx, fixture.creatorID, fixture.themeID, config); err != nil {
		t.Fatalf("UpdateConfigJson valid discoveries: %v", err)
	}

	if err := fixture.f.svc.DeleteLocation(fixture.ctx, fixture.creatorID, fixture.deletedLocation.ID); err != nil {
		t.Fatalf("DeleteLocation: %v", err)
	}
	if err := fixture.f.svc.DeleteClue(fixture.ctx, fixture.creatorID, fixture.deletedClue.ID); err != nil {
		t.Fatalf("DeleteClue: %v", err)
	}

	assertLocationDiscoveryCleanupResult(t, fixture)
}

type locationDiscoveryValidationFixture struct {
	f               *testFixture
	ctx             context.Context
	creatorID       uuid.UUID
	themeID         uuid.UUID
	location        *LocationResponse
	discoveryClue   *ClueResponse
	requiredClue    *ClueResponse
	otherLocation   *LocationResponse
	otherClue       *ClueResponse
	deletedLocation *LocationResponse
	keptLocation    *LocationResponse
	deletedClue     *ClueResponse
	keptClue        *ClueResponse
}

type locationDiscoveryInvalidCase struct {
	name  string
	input json.RawMessage
	want  string
}

func setupLocationDiscoveryValidationFixture(t *testing.T) locationDiscoveryValidationFixture {
	t.Helper()

	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)
	mapResp, err := f.svc.CreateMap(ctx, creatorID, themeID, CreateMapRequest{Name: "지도"})
	if err != nil {
		t.Fatalf("CreateMap: %v", err)
	}
	locationResp, err := f.svc.CreateLocation(ctx, creatorID, themeID, mapResp.ID, CreateLocationRequest{Name: "서재"})
	if err != nil {
		t.Fatalf("CreateLocation: %v", err)
	}
	discoveryClue, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{Name: "혈흔", Level: 1})
	if err != nil {
		t.Fatalf("CreateClue discovery: %v", err)
	}
	requiredClue, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{Name: "장갑", Level: 1})
	if err != nil {
		t.Fatalf("CreateClue required: %v", err)
	}

	otherCreatorID := f.createUser(t)
	otherThemeID := f.createThemeForUser(t, otherCreatorID)
	otherMap, err := f.svc.CreateMap(ctx, otherCreatorID, otherThemeID, CreateMapRequest{Name: "다른 지도"})
	if err != nil {
		t.Fatalf("CreateMap other: %v", err)
	}
	otherLocation, err := f.svc.CreateLocation(ctx, otherCreatorID, otherThemeID, otherMap.ID, CreateLocationRequest{Name: "다른 장소"})
	if err != nil {
		t.Fatalf("CreateLocation other: %v", err)
	}
	otherClue, err := f.svc.CreateClue(ctx, otherCreatorID, otherThemeID, CreateClueRequest{Name: "다른 단서", Level: 1})
	if err != nil {
		t.Fatalf("CreateClue other: %v", err)
	}

	deletedLocation, err := f.svc.CreateLocation(ctx, creatorID, themeID, mapResp.ID, CreateLocationRequest{Name: "삭제 장소"})
	if err != nil {
		t.Fatalf("CreateLocation deleted: %v", err)
	}
	keptLocation, err := f.svc.CreateLocation(ctx, creatorID, themeID, mapResp.ID, CreateLocationRequest{Name: "남길 장소"})
	if err != nil {
		t.Fatalf("CreateLocation kept: %v", err)
	}
	deletedClue, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{Name: "삭제 단서", Level: 1})
	if err != nil {
		t.Fatalf("CreateClue deleted: %v", err)
	}
	keptClue, err := f.svc.CreateClue(ctx, creatorID, themeID, CreateClueRequest{Name: "남길 단서", Level: 1})
	if err != nil {
		t.Fatalf("CreateClue kept: %v", err)
	}

	return locationDiscoveryValidationFixture{
		f:               f,
		ctx:             ctx,
		creatorID:       creatorID,
		themeID:         themeID,
		location:        locationResp,
		discoveryClue:   discoveryClue,
		requiredClue:    requiredClue,
		otherLocation:   otherLocation,
		otherClue:       otherClue,
		deletedLocation: deletedLocation,
		keptLocation:    keptLocation,
		deletedClue:     deletedClue,
		keptClue:        keptClue,
	}
}

func assertValidLocationDiscoveryConfig(t *testing.T, fixture locationDiscoveryValidationFixture) {
	t.Helper()

	valid := json.RawMessage(fmt.Sprintf(`{
			"modules": {
				"location": {
					"enabled": true,
					"config": {
						"discoveries": [{
							"locationId": "%s",
						"clueId": "%s",
						"requiredClueIds": ["%s"],
						"oncePerPlayer": true
					}]
					}
				}
			}
		}`, fixture.location.ID, fixture.discoveryClue.ID, fixture.requiredClue.ID))
	updated, err := fixture.f.svc.UpdateConfigJson(fixture.ctx, fixture.creatorID, fixture.themeID, valid)
	if err != nil {
		t.Fatalf("valid location discovery config must save: %v", err)
	}
	if updated.Version <= 1 {
		t.Fatalf("expected version bump for valid discovery config, got %d", updated.Version)
	}
}

func assertInvalidLocationDiscoveryConfigs(t *testing.T, fixture locationDiscoveryValidationFixture) {
	t.Helper()
	cases := append(locationDiscoveryShapeCases(), locationDiscoveryLocationCases(fixture)...)
	cases = append(cases, locationDiscoveryClueCases(fixture)...)
	cases = append(cases, locationDiscoveryRequiredClueCases(fixture)...)
	cases = append(cases, locationDiscoveryOptionCases(fixture)...)
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			assertUpdateConfigReturnsBadRequest(t, fixture, tc.input, tc.want)
		})
	}
}

func locationDiscoveryShapeCases() []locationDiscoveryInvalidCase {
	return []locationDiscoveryInvalidCase{
		{
			name: "location module must be object",
			input: json.RawMessage(`{
				"modules": {"location": true}
			}`),
			want: "modules.location must be an object",
		},
		{
			name: "location config must be object",
			input: json.RawMessage(`{
				"modules": {"location": {"enabled": true, "config": []}}
			}`),
			want: "modules.location.config must be an object",
		},
		{
			name: "discoveries must be array",
			input: json.RawMessage(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": {}}}}
			}`),
			want: "discoveries must be an array",
		},
		{
			name: "discovery must be object",
			input: json.RawMessage(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": ["bad"]}}}
			}`),
			want: "modules.location.config.discoveries[0] must be an object",
		},
	}
}

func locationDiscoveryLocationCases(fixture locationDiscoveryValidationFixture) []locationDiscoveryInvalidCase {
	return []locationDiscoveryInvalidCase{
		{
			name: "missing location id",
			input: json.RawMessage(fmt.Sprintf(`{
					"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"clueId": "%s"
					}]}}}
				}`, fixture.discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].locationId is required",
		},
		{
			name: "invalid location id format",
			input: json.RawMessage(fmt.Sprintf(`{
					"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"locationId": "library",
						"clueId": "%s"
					}]}}}
				}`, fixture.discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].locationId must be a valid location id",
		},
		{
			name: "location id must belong to theme",
			input: json.RawMessage(fmt.Sprintf(`{
					"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"locationId": "%s",
						"clueId": "%s"
					}]}}}
				}`, fixture.otherLocation.ID, fixture.discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].locationId must belong to this theme",
		},
	}
}

func locationDiscoveryClueCases(fixture locationDiscoveryValidationFixture) []locationDiscoveryInvalidCase {
	return []locationDiscoveryInvalidCase{
		{
			name: "missing clue id",
			input: json.RawMessage(fmt.Sprintf(`{
					"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"locationId": "%s"
					}]}}}
				}`, fixture.location.ID)),
			want: "modules.location.config.discoveries[0].clueId is required",
		},
		{
			name: "invalid clue id format",
			input: json.RawMessage(fmt.Sprintf(`{
					"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"locationId": "%s",
						"clueId": "blood"
					}]}}}
				}`, fixture.location.ID)),
			want: "modules.location.config.discoveries[0].clueId must be a valid clue id",
		},
		{
			name: "clue id must belong to theme",
			input: json.RawMessage(fmt.Sprintf(`{
					"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"locationId": "%s",
						"clueId": "%s"
					}]}}}
				}`, fixture.location.ID, fixture.otherClue.ID)),
			want: "modules.location.config.discoveries[0].clueId must belong to this theme",
		},
	}
}

func locationDiscoveryRequiredClueCases(fixture locationDiscoveryValidationFixture) []locationDiscoveryInvalidCase {
	return []locationDiscoveryInvalidCase{
		{
			name: "required clue ids must be array",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"locationId": "%s",
						"clueId": "%s",
						"requiredClueIds": {}
					}]}}}
				}`, fixture.location.ID, fixture.discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].requiredClueIds must be an array",
		},
		{
			name: "required clue id must be valid uuid",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"locationId": "%s",
						"clueId": "%s",
						"requiredClueIds": ["note"]
					}]}}}
				}`, fixture.location.ID, fixture.discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].requiredClueIds[0] must be a valid clue id",
		},
		{
			name: "required clue id must belong to theme",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"locationId": "%s",
						"clueId": "%s",
						"requiredClueIds": ["%s"]
					}]}}}
				}`, fixture.location.ID, fixture.discoveryClue.ID, fixture.otherClue.ID)),
			want: "modules.location.config.discoveries[0].requiredClueIds[0] must belong to this theme",
		},
	}
}

func locationDiscoveryOptionCases(fixture locationDiscoveryValidationFixture) []locationDiscoveryInvalidCase {
	return []locationDiscoveryInvalidCase{
		{
			name: "once per player must be boolean",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
						"locationId": "%s",
						"clueId": "%s",
						"oncePerPlayer": "yes"
					}]}}}
			}`, fixture.location.ID, fixture.discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].oncePerPlayer must be boolean",
		},
	}
}

func assertUpdateConfigReturnsBadRequest(t *testing.T, fixture locationDiscoveryValidationFixture, input json.RawMessage, want string) {
	t.Helper()

	_, err := fixture.f.svc.UpdateConfigJson(fixture.ctx, fixture.creatorID, fixture.themeID, input)
	if err == nil {
		t.Fatalf("expected error, got nil")
	}
	var appErr *apperror.AppError
	if !errors.As(err, &appErr) {
		t.Fatalf("expected *apperror.AppError, got %T: %v", err, err)
	}
	if appErr.Status != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", appErr.Status)
	}
	if !strings.Contains(err.Error(), want) {
		t.Errorf("expected error to contain %q, got: %v", want, err)
	}
}

func locationDiscoveryCleanupConfig(fixture locationDiscoveryValidationFixture) json.RawMessage {
	return json.RawMessage(fmt.Sprintf(`{
			"modules": {
				"location": {
					"enabled": true,
					"config": {
						"discoveries": [
						{"locationId": "%s", "clueId": "%s", "requiredClueIds": ["%s"], "oncePerPlayer": true},
						{"locationId": "%s", "clueId": "%s", "requiredClueIds": ["%s"], "oncePerPlayer": true}
					]
					}
				}
			}
		}`, fixture.deletedLocation.ID, fixture.deletedClue.ID, fixture.keptClue.ID, fixture.keptLocation.ID, fixture.keptClue.ID, fixture.deletedClue.ID))
}

func assertLocationDiscoveryCleanupResult(t *testing.T, fixture locationDiscoveryValidationFixture) {
	t.Helper()

	theme, err := fixture.f.svc.GetTheme(fixture.ctx, fixture.creatorID, fixture.themeID)
	if err != nil {
		t.Fatalf("GetTheme: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(theme.ConfigJson, &decoded); err != nil {
		t.Fatalf("unmarshal config_json: %v", err)
	}
	if jsonConfigContainsStringOrKey(decoded, fixture.deletedLocation.ID.String()) {
		t.Fatalf("deleted location id still present in config_json: %s", string(theme.ConfigJson))
	}
	if jsonConfigContainsStringOrKey(decoded, fixture.deletedClue.ID.String()) {
		t.Fatalf("deleted clue id still present in config_json: %s", string(theme.ConfigJson))
	}
	if !jsonConfigContainsStringOrKey(decoded, fixture.keptLocation.ID.String()) {
		t.Fatalf("kept location id was removed from config_json: %s", string(theme.ConfigJson))
	}
	if !jsonConfigContainsStringOrKey(decoded, fixture.keptClue.ID.String()) {
		t.Fatalf("kept clue id was removed from config_json: %s", string(theme.ConfigJson))
	}

	modules := decoded["modules"].(map[string]any)
	locationModule := modules["location"].(map[string]any)
	locationConfig := locationModule["config"].(map[string]any)
	discoveries := locationConfig["discoveries"].([]any)
	if len(discoveries) != 1 {
		t.Fatalf("expected one kept discovery after cleanup, got %#v", discoveries)
	}
	keptDiscovery := discoveries[0].(map[string]any)
	if keptDiscovery["locationId"] != fixture.keptLocation.ID.String() {
		t.Fatalf("unexpected kept discovery locationId: %#v", keptDiscovery)
	}
	if keptDiscovery["clueId"] != fixture.keptClue.ID.String() {
		t.Fatalf("unexpected kept discovery clueId: %#v", keptDiscovery)
	}
	requiredClueIDs := keptDiscovery["requiredClueIds"].([]any)
	if len(requiredClueIDs) != 0 {
		t.Fatalf("deleted required clue id should be removed, got %#v", requiredClueIDs)
	}
}
