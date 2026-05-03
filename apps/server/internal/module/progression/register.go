// Package progression aggregates the per-module sub-packages for blank-import
// registration. Importing progression pulls in every module whose source
// lives either in this directory or in a nested sub-package (e.g. reading).
//
// The sub-package blank imports below are what force the sub-packages'
// init() calls — which in turn register their factories via engine.Register —
// to run when progression is imported.
package progression

import (
	_ "github.com/mmp-platform/server/internal/module/progression/information_delivery"
	_ "github.com/mmp-platform/server/internal/module/progression/reading"
)
