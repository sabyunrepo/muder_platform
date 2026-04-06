package sound

// SoundID is an allowed sound identifier.
type SoundID string

const (
	SoundPhaseChange  SoundID = "phase_change"
	SoundVoteResult   SoundID = "vote_result"
	SoundTimerWarning SoundID = "timer_warning"
	SoundRevealStart  SoundID = "reveal_start"
	SoundRevealResult SoundID = "reveal_result"
	SoundPlayerJoin   SoundID = "player_join"
	SoundPlayerLeave  SoundID = "player_leave"
)

// IsValidSound reports whether the given ID is an allowed sound.
// Uses switch instead of map to prevent mutation and enable compile-time safety.
// IMPORTANT: Keep in sync with packages/shared/src/ws/types.ts SOUND_IDS
// and apps/web/src/features/audio/soundRegistry.ts SOUND_MAP.
func IsValidSound(id string) bool {
	switch SoundID(id) {
	case SoundPhaseChange, SoundVoteResult, SoundTimerWarning,
		SoundRevealStart, SoundRevealResult, SoundPlayerJoin, SoundPlayerLeave:
		return true
	default:
		return false
	}
}
