// Package progression keeps mockgen directives outside production files.
//
//go:generate go tool mockgen -destination=mocks/mock_engine_deps.go -package=mocks github.com/mmp-platform/server/internal/engine SceneController,PhaseActionDispatcher

package progression
