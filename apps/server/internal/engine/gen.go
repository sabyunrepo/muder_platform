// Package engine keeps mockgen directives outside production runtime files.
//
//go:generate go tool mockgen -destination=mocks/mock_player_status_controller.go -package=mocks github.com/mmp-platform/server/internal/engine PlayerStatusController

package engine
