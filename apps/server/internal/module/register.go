// Package module registers all game modules via blank imports.
// Each module's init() function calls engine.Register() to add its factory.
package module

import (
	_ "github.com/mmp-platform/server/internal/module/cluedist"
	_ "github.com/mmp-platform/server/internal/module/communication"
	_ "github.com/mmp-platform/server/internal/module/core"
	_ "github.com/mmp-platform/server/internal/module/decision"
	_ "github.com/mmp-platform/server/internal/module/exploration"
	_ "github.com/mmp-platform/server/internal/module/media"
	_ "github.com/mmp-platform/server/internal/module/progression"
)
