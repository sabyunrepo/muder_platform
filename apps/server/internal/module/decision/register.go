// Package decision aggregates the per-module sub-packages for blank-import
// registration. Each sub-package's init() registers its module factory via
// engine.Register; blank-importing them here guarantees those init() calls
// run when decision is imported from module/register.go.
package decision

import (
	_ "github.com/mmp-platform/server/internal/module/decision/accusation"
	_ "github.com/mmp-platform/server/internal/module/decision/hidden_mission"
	_ "github.com/mmp-platform/server/internal/module/decision/voting"
)
