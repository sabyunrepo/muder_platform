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

var allowedSounds = map[SoundID]bool{
	SoundPhaseChange:  true,
	SoundVoteResult:   true,
	SoundTimerWarning: true,
	SoundRevealStart:  true,
	SoundRevealResult: true,
	SoundPlayerJoin:   true,
	SoundPlayerLeave:  true,
}

// IsValidSound reports whether the given ID is an allowed sound.
func IsValidSound(id string) bool {
	return allowedSounds[SoundID(id)]
}
