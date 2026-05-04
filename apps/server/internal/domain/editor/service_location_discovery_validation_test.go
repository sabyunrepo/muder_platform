package editor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/mmp-platform/server/internal/apperror"
)

func TestUpdateConfigJson_ValidatesLocationDiscoveries(t *testing.T) {
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
	}`, locationResp.ID, discoveryClue.ID, requiredClue.ID))
	updated, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, valid)
	if err != nil {
		t.Fatalf("valid location discovery config must save: %v", err)
	}
	if updated.Version <= 1 {
		t.Fatalf("expected version bump for valid discovery config, got %d", updated.Version)
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

	cases := []struct {
		name  string
		input json.RawMessage
		want  string
	}{
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
		{
			name: "missing location id",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
					"clueId": "%s"
				}]}}}
			}`, discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].locationId is required",
		},
		{
			name: "invalid location id format",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
					"locationId": "library",
					"clueId": "%s"
				}]}}}
			}`, discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].locationId must be a valid location id",
		},
		{
			name: "location id must belong to theme",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
					"locationId": "%s",
					"clueId": "%s"
				}]}}}
			}`, otherLocation.ID, discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].locationId must belong to this theme",
		},
		{
			name: "missing clue id",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
					"locationId": "%s"
				}]}}}
			}`, locationResp.ID)),
			want: "modules.location.config.discoveries[0].clueId is required",
		},
		{
			name: "invalid clue id format",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
					"locationId": "%s",
					"clueId": "blood"
				}]}}}
			}`, locationResp.ID)),
			want: "modules.location.config.discoveries[0].clueId must be a valid clue id",
		},
		{
			name: "clue id must belong to theme",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
					"locationId": "%s",
					"clueId": "%s"
				}]}}}
			}`, locationResp.ID, otherClue.ID)),
			want: "modules.location.config.discoveries[0].clueId must belong to this theme",
		},
		{
			name: "required clue ids must be array",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
					"locationId": "%s",
					"clueId": "%s",
					"requiredClueIds": {}
				}]}}}
			}`, locationResp.ID, discoveryClue.ID)),
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
			}`, locationResp.ID, discoveryClue.ID)),
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
			}`, locationResp.ID, discoveryClue.ID, otherClue.ID)),
			want: "modules.location.config.discoveries[0].requiredClueIds[0] must belong to this theme",
		},
		{
			name: "once per player must be boolean",
			input: json.RawMessage(fmt.Sprintf(`{
				"modules": {"location": {"enabled": true, "config": {"discoveries": [{
					"locationId": "%s",
					"clueId": "%s",
					"oncePerPlayer": "yes"
				}]}}}
			}`, locationResp.ID, discoveryClue.ID)),
			want: "modules.location.config.discoveries[0].oncePerPlayer must be boolean",
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

func TestUpdateConfigJson_LocationDiscoveriesSurviveDeleteCleanup(t *testing.T) {
	f := setupFixture(t)
	ctx := context.Background()
	creatorID := f.createUser(t)
	themeID := f.createThemeForUser(t, creatorID)

	mapResp, err := f.svc.CreateMap(ctx, creatorID, themeID, CreateMapRequest{Name: "지도"})
	if err != nil {
		t.Fatalf("CreateMap: %v", err)
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

	config := json.RawMessage(fmt.Sprintf(`{
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
	}`, deletedLocation.ID, deletedClue.ID, keptClue.ID, keptLocation.ID, keptClue.ID, deletedClue.ID))
	if _, err := f.svc.UpdateConfigJson(ctx, creatorID, themeID, config); err != nil {
		t.Fatalf("UpdateConfigJson valid discoveries: %v", err)
	}

	if err := f.svc.DeleteLocation(ctx, creatorID, deletedLocation.ID); err != nil {
		t.Fatalf("DeleteLocation: %v", err)
	}
	if err := f.svc.DeleteClue(ctx, creatorID, deletedClue.ID); err != nil {
		t.Fatalf("DeleteClue: %v", err)
	}

	theme, err := f.svc.GetTheme(ctx, creatorID, themeID)
	if err != nil {
		t.Fatalf("GetTheme: %v", err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(theme.ConfigJson, &decoded); err != nil {
		t.Fatalf("unmarshal config_json: %v", err)
	}
	if jsonConfigContainsStringOrKey(decoded, deletedLocation.ID.String()) {
		t.Fatalf("deleted location id still present in config_json: %s", string(theme.ConfigJson))
	}
	if jsonConfigContainsStringOrKey(decoded, deletedClue.ID.String()) {
		t.Fatalf("deleted clue id still present in config_json: %s", string(theme.ConfigJson))
	}
	if !jsonConfigContainsStringOrKey(decoded, keptLocation.ID.String()) {
		t.Fatalf("kept location id was removed from config_json: %s", string(theme.ConfigJson))
	}
	if !jsonConfigContainsStringOrKey(decoded, keptClue.ID.String()) {
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
	if keptDiscovery["locationId"] != keptLocation.ID.String() {
		t.Fatalf("unexpected kept discovery locationId: %#v", keptDiscovery)
	}
	if keptDiscovery["clueId"] != keptClue.ID.String() {
		t.Fatalf("unexpected kept discovery clueId: %#v", keptDiscovery)
	}
	requiredClueIDs := keptDiscovery["requiredClueIds"].([]any)
	if len(requiredClueIDs) != 0 {
		t.Fatalf("deleted required clue id should be removed, got %#v", requiredClueIDs)
	}
}
