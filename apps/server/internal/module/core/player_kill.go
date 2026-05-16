package core

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/mmp-platform/server/internal/engine"
)

const playerKillModuleName = "player_kill"

const (
	KillResolutionAllWeaponsVsAllArmor  = "all_weapons_vs_all_armor"
	KillResolutionBestWeaponVsAllArmor  = "best_weapon_vs_all_armor"
	KillResolutionBestWeaponVsBestArmor = "best_weapon_vs_best_armor"
)

func init() {
	engine.Register(playerKillModuleName, func() engine.Module { return NewPlayerKillModule() })
}

type PlayerKillConfig struct {
	KillableCharacterIDs []string `json:"killableCharacterIds,omitempty"`
	MuteOnKilled         bool     `json:"muteOnKilled"`
	KillResolutionMode   string   `json:"killResolutionMode,omitempty"`
	AllowedSceneIDs      []string `json:"allowedSceneIds,omitempty"`
}

type PlayerKillModule struct {
	engine.PublicStateMarker

	config PlayerKillConfig
}

func NewPlayerKillModule() *PlayerKillModule {
	return &PlayerKillModule{}
}

func (m *PlayerKillModule) Name() string { return playerKillModuleName }

func (m *PlayerKillModule) Init(_ context.Context, _ engine.ModuleDeps, config json.RawMessage) error {
	m.config = PlayerKillConfig{}
	if len(config) == 0 {
		return nil
	}
	if err := json.Unmarshal(config, &m.config); err != nil {
		return fmt.Errorf("player_kill: invalid config: %w", err)
	}
	return nil
}

func (m *PlayerKillModule) HandleMessage(_ context.Context, _ uuid.UUID, _ string, _ json.RawMessage) error {
	return fmt.Errorf("player_kill: no player messages are supported")
}

func (m *PlayerKillModule) BuildState() (json.RawMessage, error) {
	return json.Marshal(m.config)
}

func (m *PlayerKillModule) Cleanup(context.Context) error {
	return nil
}

var (
	_ engine.Module            = (*PlayerKillModule)(nil)
	_ engine.PublicStateModule = (*PlayerKillModule)(nil)
)
