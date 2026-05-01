package ws

import (
	"crypto/sha256"
	"encoding/hex"
)

// redactJTI returns a non-reversible 8-char hex prefix of the SHA-256
// of jti so logs can correlate revocation flows without exposing the
// raw refresh-token identifier. PR-9 CR-2/CR-3 — CodeRabbit flagged
// raw JTI in Hub.RevokeToken / SocialHub.RevokeToken debug logs as a
// session-fingerprint leak.
func redactJTI(jti string) string {
	if jti == "" {
		return ""
	}
	sum := sha256.Sum256([]byte(jti))
	return hex.EncodeToString(sum[:])[:8]
}
