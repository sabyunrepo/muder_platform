// Package cluedist aggregates the per-module sub-packages for blank-import
// registration. trade_clue is promoted to its own sub-package; the other
// clue-distribution modules (conditional_clue, round_clue, starting_clue,
// timed_clue) continue to live at this top-level package.
package cluedist

import (
	_ "github.com/mmp-platform/server/internal/module/cluedist/trade_clue"
)
