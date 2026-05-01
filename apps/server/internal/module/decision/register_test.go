// Package decision_test verifies that all decision sub-module init() functions
// fire when the decision package is blank-imported, exercising the engine boot
// panic gate (F-sec-2).
package decision_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	// Blank-importing the decision package triggers all sub-module init()
	// registrations via the blank imports in register.go.
	_ "github.com/mmp-platform/server/internal/module/decision"

	"github.com/mmp-platform/server/internal/engine"
)

// TestRegistry_EndingBranchRegistered confirms that ending_branch appears in
// the global engine registry after the decision package has been imported.
// This is the boot panic gate: if the module fails F-sec-2 (PlayerAware /
// PublicStateMarker), Register panics and this test never reaches the assert.
func TestRegistry_EndingBranchRegistered(t *testing.T) {
	names := engine.RegisteredModules()
	assert.Contains(t, names, "ending_branch",
		"ending_branch must be registered after decision blank-import")
}
