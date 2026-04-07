---
description: (sabyun) 실행 중인 autopilot 일시 정지 + state 저장 (/plan-resume으로 재개 가능)
allowed-tools: Bash Read Write
---

## Pre-flight check
!`$HOME/.claude/skills/plan-autopilot/scripts/plan-preflight.sh`

**Note**: pre-flight failures don't block stopping — pausing state saving works regardless of hooks.

---

Stop the autopilot loop gracefully.

## Steps

1. Save current state:
   ```bash
   ~/.claude/skills/plan-autopilot/scripts/autopilot-loop.sh pause user_request
   ```
2. This creates `.claude/autopilot-state.json` with current wave, PR, timestamp, reason.
3. **Note**: Sub-agents already in flight cannot be interrupted. They'll finish their current step.
4. Report:
   ```
   ⏸ Autopilot paused.

   Current: <wave> <pr>
   Paused: <timestamp>

   Resume: /plan-autopilot (or /plan-resume for full context)
   Abort entirely: rm .claude/autopilot-state.json + /plan-status to verify
   ```

`.claude/active-plan.json` is NOT deleted — the plan stays active, just execution is paused.
