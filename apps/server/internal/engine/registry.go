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

// Register adds a module factory to the global registry.
// Called from each module's init() function.
func Register(name string, factory ModuleFactory) {
	globalRegistry.mu.Lock()
	defer globalRegistry.mu.Unlock()

	if _, exists := globalRegistry.factories[name]; exists {
		panic(fmt.Sprintf("engine: duplicate module registration: %s", name))
	}
	globalRegistry.factories[name] = factory
}

// CreateModules instantiates modules for a session based on the game config.
// Returns only the enabled modules. Errors if a required module is not registered.
func CreateModules(config GameConfig) (map[string]Module, error) {
	globalRegistry.mu.RLock()
	defer globalRegistry.mu.RUnlock()

	modules := make(map[string]Module, len(config.Modules))
	for _, mc := range config.Modules {
		if !mc.Enabled {
			continue
		}
		factory, ok := globalRegistry.factories[mc.Name]
		if !ok {
			return nil, fmt.Errorf("engine: unknown module %q", mc.Name)
		}
		modules[mc.Name] = factory()
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
