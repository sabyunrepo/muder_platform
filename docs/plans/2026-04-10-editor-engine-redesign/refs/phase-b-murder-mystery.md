# Phase B: Murder Mystery Plugin (First Genre)

> Parent: [../design.md](../design.md) | Depends on: Phase A (Engine Core)

---

## Overview

Murder Mystery is the simplest genre: round-based clue distribution, per-round voting,
final accusation, and reveal. Implementing it first validates the GenrePlugin architecture
end-to-end before more complex genres (CrimeScene, ScriptKill, Jubensha).

The plugin implements 6 interfaces: **GenrePlugin Core** + **GameEventHandler** +
**WinChecker** + **PhaseHookPlugin** + **SerializablePlugin** + **RuleProvider**.

---

## 1. Phase Definitions

```
Intro → Round[1..N](ClueDist → Discuss → Vote) → Accusation → Reveal
```

| Phase ID | Type | Duration | Auto-advance |
|----------|------|----------|-------------|
| `intro` | intro | 60s | Timer + consensus |
| `round_N_clue_dist` | clue_dist | 10s | Timer (auto) |
| `round_N_discussion` | discussion | config.discussionTime | Timer |
| `round_N_vote` | voting | config.voteTime | CLOSE_VOTING action |
| `accusation` | accusation | config.defenseTime | vote threshold |
| `reveal` | reveal | 0 (manual step) | GM or auto-complete |

Phase count is dynamic: `totalRounds` from ConfigSchema (1-5, default 3).
`DefaultPhases()` generates the full list from config at `Init()` time.

---

## 2. ConfigSchema (Editor auto-UI)

```json
{
  "totalRounds":      { "type": "integer", "minimum": 1, "maximum": 5, "default": 3 },
  "cluesPerRound":    { "type": "integer", "minimum": 1, "maximum": 10, "default": 3 },
  "discussionTime":   { "type": "integer", "minimum": 60, "maximum": 1800, "default": 300 },
  "voteType":         { "type": "string", "enum": ["public","secret","sequential"], "default": "secret" },
  "voteTime":         { "type": "integer", "minimum": 30, "maximum": 600, "default": 120 },
  "defenseTime":      { "type": "integer", "minimum": 10, "maximum": 300, "default": 60 },
  "eliminationEnabled":{ "type": "boolean", "default": true },
  "deadPlayerReveal": { "type": "boolean", "default": false },
  "voteThreshold":    { "type": "integer", "minimum": 1, "maximum": 100, "default": 50 }
}
```

---

## 3. Clue Distribution Logic

Absorbs 3 existing `module/cluedist/` modules into plugin-internal methods:

### StartingClue (from `cluedist/starting_clue.go`)
- **Trigger**: `OnPhaseEnter("intro")` -- distributes once on game start
- **Logic**: Map `characterCode -> []clueIDs` from theme config. Publishes
  `clue.distributed` events per character. No external module dependency.
- **Absorbed**: `StartingClueModule.distribute()` logic inlined into
  `plugin.OnPhaseEnter()` when `phase.ID == "intro"`.

### RoundClue (from `cluedist/round_clue.go`)
- **Trigger**: `OnPhaseEnter("round_N_clue_dist")` -- distributes at each round start
- **Logic**: Filter `ClueDistribution` list by current round number. Modes:
  `specific` (target char), `random` (random alive player), `all` (broadcast).
- **Absorbed**: `RoundClueModule.onRoundChanged()` logic inlined. Removes EventBus
  subscription pattern; uses PhaseHookPlugin directly.

### ConditionalClue (from `cluedist/conditional_clue.go`)
- **Trigger**: After any `clue.distributed` event, check dependency chains.
- **Logic**: Maintain `acquiredClues` set. On each new clue, evaluate ALL/ANY
  prerequisite conditions. Chain reactions: newly unlocked clues may trigger more.
- **Absorbed**: `ConditionalClueModule.checkDependencies()` with chain loop. Uses
  `clue/` package's `ClueGraph.TopologicalSort()` for validation at Init.

---

## 4. Voting Integration

Reuses existing `module/decision/voting.go` logic, adapted to GameEventHandler:

- **PhaseHookPlugin.OnPhaseEnter("round_N_vote")**: Opens voting via internal state
  (no PhaseReactor needed). Publishes `vote.opened` event.
- **GameEventHandler.Validate("vote.cast")**: Checks phase is voting, player alive,
  not already voted (or uses `vote:change`).
- **GameEventHandler.Apply("vote.cast")**: Records vote, publishes `vote.cast` event.
- **Timer expiry** or **host action** triggers tally. Publishes `vote.result`.
- **Tie handling**: Uses config `voteType` + `tieBreaker` (revote/random/no_result).

Key change from Phase 8.0: Voting is no longer a separate `Module`. Its logic is
embedded in the plugin's `Validate`/`Apply` methods. The `PhaseReactor` pattern
(OPEN_VOTING/CLOSE_VOTING actions) is replaced by `PhaseHookPlugin` hooks.

---

## 5. Win Condition (WinChecker)

```go
func (p *MurderMysteryPlugin) CheckWin(ctx context.Context, state GameState) (*WinResult, error)
```

Evaluation points:
1. **After each round vote** (`vote.result` event): If `eliminationEnabled` and
   voted-out player is the culprit -> **detectives win**.
2. **After accusation** (`accusation.resolved` event): If accused is culprit ->
   **detectives win**. If not -> **culprit wins** (wrong accusation penalty).
3. **After final round** (no accusation made): If culprit not identified ->
   **culprit wins**.

```go
type WinResult struct {
    Winner     string `json:"winner"`     // "detectives" | "culprit"
    Reason     string `json:"reason"`     // "correct_accusation" | "wrong_accusation" | "elimination" | "timeout"
    CulpritCode string `json:"culpritCode"`
    AccuserCode string `json:"accuserCode,omitempty"`
}
```

---

## 6. PR Breakdown

### PR-B1: Plugin Skeleton + Phase Definitions
**Files:**
- `engine/genre/murder_mystery/plugin.go` -- GenrePlugin Core + init() registry
- `engine/genre/murder_mystery/phases.go` -- DefaultPhases(), phase ID generation
- `engine/genre/murder_mystery/config.go` -- Config struct + GetConfigSchema()
- `engine/genre/murder_mystery/plugin_test.go` -- Core interface compliance

### PR-B2: Clue Distribution (Starting + Round)
**Files:**
- `engine/genre/murder_mystery/cluedist.go` -- starting + round distribution logic
- `engine/genre/murder_mystery/cluedist_test.go` -- unit tests
- Absorbs: `module/cluedist/starting_clue.go`, `module/cluedist/round_clue.go`

### PR-B3: Conditional Clue + ClueGraph Integration
**Files:**
- `engine/genre/murder_mystery/conditional.go` -- dependency chain evaluation
- `engine/genre/murder_mystery/conditional_test.go`
- `clue/graph.go` -- ClueGraph (topo sort, cycle detection) [shared, may be PR-A6]
- Absorbs: `module/cluedist/conditional_clue.go`

### PR-B4: Voting + Accusation (GameEventHandler)
**Files:**
- `engine/genre/murder_mystery/voting.go` -- Validate/Apply for vote events
- `engine/genre/murder_mystery/accusation.go` -- Validate/Apply for accusation
- `engine/genre/murder_mystery/decision_test.go`
- Absorbs: `module/decision/voting.go`, `module/decision/accusation.go`

### PR-B5: Phase Hooks + Win Condition + Serialization
**Files:**
- `engine/genre/murder_mystery/hooks.go` -- OnPhaseEnter/OnPhaseExit
- `engine/genre/murder_mystery/wincheck.go` -- CheckWin implementation
- `engine/genre/murder_mystery/state.go` -- BuildState/RestoreState
- `engine/genre/murder_mystery/rules.go` -- GetRules (JSON Logic)
- `engine/genre/murder_mystery/integration_test.go` -- E2E test scenario

---

## 7. E2E Test Scenario

**Setup**: 6 players (P1=detective, P6=culprit), 3 rounds, secret voting, elimination on.
Starting clues: 1/player. Round clues: 2/round. Conditional: unlocks on clue_A+clue_B.

**Flow**: Intro(6 clues) -> R1(dist 2, discuss, vote P4 out) -> R2(dist 2, conditional unlocks, discuss, vote) -> R3(dist 2, discuss, vote) -> Accusation(P1 accuses P6, correct) -> Reveal

**Assertions**: correct clue counts per player, conditional only after prereqs, vote events
with correct tallies, CheckWin after vote.result + accusation.resolved, state serializable
at every transition, full game <50ms in-process.

---

## 8. Phase 8.0 Code Absorption Map

| Phase 8.0 Module | Target | Approach |
|---|---|---|
| `cluedist/starting_clue.go` | `mm/cluedist.go` | Inlined into `OnPhaseEnter("intro")`. No EventBus sub. |
| `cluedist/round_clue.go` | `mm/cluedist.go` | Inlined into `OnPhaseEnter("round_N_clue_dist")`. |
| `cluedist/conditional_clue.go` | `mm/conditional.go` | Chain-reaction loop preserved. EventBus for cross-events. |
| `decision/voting.go` | `mm/voting.go` | `HandleMessage` -> `Validate/Apply`. `tallyResults()` preserved. |
| `decision/accusation.go` | `mm/accusation.go` | Same refactor. Winner check added after resolution. |
| `progression/ending.go` | `mm/hooks.go` | Reveal steps inlined into `OnPhaseEnter("reveal")`. |
| `progression/hybrid_progression.go` | Not absorbed | Timer-based progression; future genres may use it. |
| `core/ready.go` | `genre/shared/` | Moved to shared utility (all genres use pre-game). |

**Key principle**: Logic preserved; wiring changes from EventBus subscriptions to
PhaseHookPlugin/Validate/Apply callbacks. EventBus kept for cross-concern events.
