package accusation

// tallyOutcome captures the resolved result of an accusation vote:
// whether the accused is expelled and the rounded guilty percentage across
// all eligible voters.
type tallyOutcome struct {
	Expelled  bool
	GuiltyPct int
}

// shouldResolve reports whether the current vote counts are sufficient to
// close out the accusation — either because every eligible voter has voted
// or because the guilty/innocent split is already mathematically determined.
//
// Inputs:
//   - guiltyCount: number of guilty votes recorded so far
//   - totalVotes: total votes recorded so far (guilty + innocent)
//   - eligibleVoters: total voters who may still vote
//   - threshold: guilty percentage required to expel
//
// Pure function — must not hold the module's mutex.
func shouldResolve(guiltyCount, totalVotes, eligibleVoters, threshold int) bool {
	if eligibleVoters > 0 && totalVotes >= eligibleVoters {
		return true
	}
	if eligibleVoters <= 0 {
		return false
	}
	remaining := 0
	if eligibleVoters > totalVotes {
		remaining = eligibleVoters - totalVotes
	}
	guiltyPctNow := (guiltyCount * 100) / eligibleVoters
	maxGuiltyPct := ((guiltyCount + remaining) * 100) / eligibleVoters
	mathGuilty := guiltyPctNow >= threshold
	mathInnocent := maxGuiltyPct < threshold
	return mathGuilty || mathInnocent
}

// tallyVotes computes the final guilty percentage and whether the accused is
// expelled, given the current vote counts and configuration. It is a pure
// helper — callers must hold the module's write lock when mutating state
// before/after invocation, but tallyVotes itself neither acquires locks nor
// touches module state.
func tallyVotes(guiltyCount, totalVotes, eligibleVoters, threshold int) tallyOutcome {
	guiltyPct := 0
	if eligibleVoters > 0 {
		guiltyPct = (guiltyCount * 100) / eligibleVoters
	} else if totalVotes > 0 {
		// Fallback when eligibleVoters is unset: use totalVotes (legacy behaviour).
		guiltyPct = (guiltyCount * 100) / totalVotes
	}
	return tallyOutcome{
		Expelled:  guiltyPct >= threshold,
		GuiltyPct: guiltyPct,
	}
}
