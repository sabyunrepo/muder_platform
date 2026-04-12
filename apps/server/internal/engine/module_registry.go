package engine

import (
	"fmt"
	"sync"

	"github.com/mmp-platform/server/internal/apperror"
)

// PluginRegistry holds plugin factories and creates per-session instances.
// Plugins register themselves via init() + blank import.
//
// Thread-safety: all public methods are safe for concurrent use.
type PluginRegistry struct {
	mu        sync.RWMutex
	factories map[string]func() Plugin
}

// NewPluginRegistry returns an empty, ready-to-use PluginRegistry.
func NewPluginRegistry() *PluginRegistry {
	return &PluginRegistry{
		factories: make(map[string]func() Plugin),
	}
}

// Register adds a plugin factory to the registry.
// Panics when id is empty, factory is nil, or id is already registered.
// Callers should invoke Register from package init() functions.
func (r *PluginRegistry) Register(id string, factory func() Plugin) {
	if id == "" {
		panic("engine: plugin id must not be empty")
	}
	if factory == nil {
		panic(fmt.Sprintf("engine: nil factory for plugin %q", id))
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.factories[id]; exists {
		panic(fmt.Sprintf("engine: duplicate plugin registration: %q", id))
	}
	r.factories[id] = factory
}

// New creates a fresh Plugin instance for the given id.
// Returns apperror.NotFound when the id is not registered.
// Each call returns an independent instance — no singletons.
func (r *PluginRegistry) New(id string) (Plugin, error) {
	r.mu.RLock()
	factory, ok := r.factories[id]
	r.mu.RUnlock()

	if !ok {
		return nil, apperror.NotFound(fmt.Sprintf("plugin %q is not registered", id))
	}
	return factory(), nil
}

// List returns the IDs of all registered plugins in an unspecified order.
func (r *PluginRegistry) List() []string {
	r.mu.RLock()
	defer r.mu.RUnlock()

	ids := make([]string, 0, len(r.factories))
	for id := range r.factories {
		ids = append(ids, id)
	}
	return ids
}
