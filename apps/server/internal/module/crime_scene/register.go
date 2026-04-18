// Package crime_scene aggregates the per-module sub-packages for blank-import
// registration. Combination lives in a sub-package; evidence and location
// remain at the top level. The blank import below pulls in the sub-package's
// init() so its engine.Register call fires when crime_scene is imported.
package crime_scene

import (
	_ "github.com/mmp-platform/server/internal/module/crime_scene/combination"
)
