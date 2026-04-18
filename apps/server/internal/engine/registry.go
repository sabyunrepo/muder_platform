package engine

import (
	"fmt"
	"sync"
)

// Registry holds module factories and creates per-session instances.
// Modules register themselves via init() + blank import.
type Registry struct {
	mu        sync.RWMutex
	factories map[string]ModuleFactory
}

// globalRegistry is the package-level registry populated by init() calls.
var globalRegistry = &Registry{
	factories: make(map[string]ModuleFactory),
}

// assertModuleContract validates that the module satisfies PR-2a: either it
// implements PlayerAwareModule (per-player redaction) or it explicitly opts
// out via PublicStateModule (engine.PublicStateMarker embed).
// Returns a descriptive error if neither interface is satisfied.
func assertModuleContract(name string, m Module) error {
	if _, ok := m.(PlayerAwareModule); ok {
		return nil
	}
	if _, ok := m.(PublicStateModule); ok {
		return nil
	}
	return fmt.Errorf(
		"engine: module %q violates F-sec-2 gate: must implement "+
			"PlayerAwareModule (BuildStateFor) or embed engine.PublicStateMarker "+
			"to declare public state",
		name,
	)
}

// Register adds a module factory to the global registry. Called from each
// module's init() function.
//
// PR-2a / Phase 19.1 PR-A: Register invokes factory() once to assert that
// the module implements PlayerAwareModule OR embeds PublicStateMarker, and
// panics if neither is satisfied. The env-driven escape hatch
// (MMP_PLAYERAWARE_STRICT) was retired after all 33 modules achieved
// compliance — the gate is now always on and a failure here is intended to
// stop the process at init time, surfacing configuration mistakes before
// they reach production.
func Register(name string, factory ModuleFactory) {
	globalRegistry.mu.Lock()
	defer globalRegistry.mu.Unlock()

	if _, exists := globalRegistry.factories[name]; exists {
		panic(fmt.Sprintf("engine: duplicate module registration: %s", name))
	}

	sample := factory()
	if err := assertModuleContract(name, sample); err != nil {
		panic(err.Error())
	}

	globalRegistry.factories[name] = factory
}

// CreateModule instantiates a single module by name from the global registry.
func CreateModule(name string) (Module, error) {
	globalRegistry.mu.RLock()
	defer globalRegistry.mu.RUnlock()

	factory, ok := globalRegistry.factories[name]
	if !ok {
		return nil, fmt.Errorf("engine: unknown module %q", name)
	}
	return factory(), nil
}

// CreateModulesBatch instantiates multiple modules by name.
// Returns only successfully created modules. Errors if any name is unknown.
func CreateModulesBatch(names []string) ([]Module, error) {
	globalRegistry.mu.RLock()
	defer globalRegistry.mu.RUnlock()

	modules := make([]Module, 0, len(names))
	for _, name := range names {
		factory, ok := globalRegistry.factories[name]
		if !ok {
			return nil, fmt.Errorf("engine: unknown module %q", name)
		}
		modules = append(modules, factory())
	}
	return modules, nil
}

// RegisteredModules returns the names of all registered modules.
func RegisteredModules() []string {
	globalRegistry.mu.RLock()
	defer globalRegistry.mu.RUnlock()

	names := make([]string, 0, len(globalRegistry.factories))
	for name := range globalRegistry.factories {
		names = append(names, name)
	}
	return names
}

// HasModule checks if a module is registered.
func HasModule(name string) bool {
	globalRegistry.mu.RLock()
	defer globalRegistry.mu.RUnlock()

	_, ok := globalRegistry.factories[name]
	return ok
}
