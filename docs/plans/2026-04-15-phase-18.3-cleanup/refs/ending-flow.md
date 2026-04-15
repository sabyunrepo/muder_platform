# Ending Flow Analysis — Phase 18.3 PR-0 (M-e)

## Question

Does the current `KindStop` / `deleteSnapshot` path interfere with normal game
endings? Specifically: when a game reaches its final phase, does the code trigger
`KindStop` → `deleteSnapshot`, and if so, is any snapshot needed afterward?

## Current flow (as of Phase 18.2)

### Normal game path

```
Host calls AdvancePhase repeatedly
  → PhaseEngine.AdvancePhase()
      → e.current++ past last phase
      → returns (false, nil)  // "no more phases"
      → publishes "phase:exiting" for last phase
      → does NOT publish "phase:entered" (no next phase)
      → does NOT call KindStop
      → session actor receives (advanced=false, err=nil)
      → flushSnapshot() called (phase transition = critical event)
```

`AdvancePhase` returning `false` is the only signal that the game is complete.
The session actor logs the result but **does not automatically send `KindStop`**.

### KindStop trigger path

`KindStop` is sent only by external callers:
- `SessionManager.Stop(sessionID)` — called by the game handler after the HTTP
  request to end the session.
- Direct `s.Send(SessionMessage{Kind: KindStop})` from tests or GM tooling.

`EndingModule` itself **never publishes a `KindStop` event**. It publishes:
- `ending.reveal_step` — on each `ending:next_reveal` message
- `ending.completed` — when all reveal steps are done

Neither event triggers `KindStop`.

### deleteSnapshot timing

`deleteSnapshot` is called **only inside `handleMessage(KindStop)`**, which
happens when the external caller explicitly ends the session. At that point:

1. All reveal steps are assumed complete (the host triggers stop after ending).
2. The `flushSnapshot()` from `AdvancePhase` (last phase) has already run.
3. `deleteSnapshot` removes all per-player blobs (M-7), preventing PII lingering.

## Risk assessment

| Scenario | Risk | Status |
|----------|------|--------|
| Reconnect during ending reveal | Player gets live engine state (StatusRunning path) | Safe — actor still running |
| Reconnect after KindStop but before Redis TTL | No blob to serve | Acceptable — session gone |
| Snapshot deleted before ending completed | Only if host calls Stop too early | Host responsibility |
| Ending replay (post-game) | Not currently supported | Out of scope (PR-7) |

## Conclusion

The current flow is **correct**:

- `KindStop` → `deleteSnapshot` is only triggered by explicit host action, not by
  the engine reaching the last phase.
- The ending reveal runs while the session is still `StatusRunning`, so
  reconnecting players receive live `BuildStateFor` snapshots — fully redacted.
- `flushSnapshot()` on last-phase `AdvancePhase` ensures the final state is
  persisted in per-player blobs before any `KindStop`.

## Recommendation

No code change needed for M-e. The existing separation between:
- Engine completion signal (`AdvancePhase → false`)
- Session termination (`KindStop`)

provides a safe window for the ending reveal sequence. A future PR (PR-7) may
add a long-lived "final state" archive key (7d TTL) for post-game replay; that
is tracked separately.
