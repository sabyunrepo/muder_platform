package session_test

// snapshot_pr0_helpers_test.go — fakeCache extensions for PR-0 tests.

// countKeysWithPrefix returns how many cache keys start with prefix.
func (f *fakeCache) countKeysWithPrefix(prefix string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	n := 0
	for k := range f.data {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			n++
		}
	}
	return n
}

// keysWithPrefix returns all keys that start with prefix.
func (f *fakeCache) keysWithPrefix(prefix string) []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []string
	for k := range f.data {
		if len(k) >= len(prefix) && k[:len(prefix)] == prefix {
			out = append(out, k)
		}
	}
	return out
}
