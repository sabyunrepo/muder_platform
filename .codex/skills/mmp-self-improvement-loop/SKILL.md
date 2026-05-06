---
name: mmp-self-improvement-loop
description: Use after repeated MMP work, PR merges, recurring review or CI mistakes, repeated manual commands, or when the user asks to improve AGENTS.md, skills, subagents, hooks, scripts, or project workflow based on observed patterns.
---

# MMP Self-Improvement Loop

## When

- After 3 merged PRs or a large multi-step session.
- When the same user correction, CodeRabbit issue, Codecov gap, CI gate problem, or manual command pattern appears 2+ times.
- When improving `AGENTS.md`, `.codex/skills`, `.codex/agents`, `.codex/hooks.json`, or workflow scripts.

## Do

1. Keep feature work separate: create a dedicated chore branch for improvements.
2. Read only the lightweight state first:
   - `docs/ops/self-improvement/state.json`
3. If needed, run:
   - `scripts/mmp-self-improvement-scan.sh --summary`
4. Classify each improvement candidate:
   - `AGENTS.md`: durable rule the model must always know.
   - `skill`: repeatable workflow with steps or decision logic.
   - `script`: deterministic or fragile command sequence.
   - `subagent`: narrow independent review/exploration role.
   - `docs`: human/project context that should not load every turn.
   - `no-change`: one-off or not enough evidence.
5. Prefer the smallest durable change, but group related repo-local workflow edits into one self-improvement PR when that lowers review and CI cost without mixing feature work.
   - Avoid micro-PRs for AGENTS/skill/subagent/script wording that shares the same root cause.
   - Split only when a change has separate runtime risk, separate owner, or would make validation unclear.
6. Mark resolved candidates in `state.json` so old evidence is not repeatedly re-used.

## Done

- Improvement trigger and evidence are named.
- The update target is explicit: AGENTS, skill, script, subagent, hook, or docs.
- Validation is run for changed scripts/config where practical.
- The final report lists what improved and what remains intentionally manual.

## Avoid

- Do not read `docs/ops/self-improvement/archive/` unless the user asks for audit detail.
- Do not turn every mistake into AGENTS.md bloat.
- Do not create automatic hooks that modify code or trigger CI without explicit user action.
- Do not let self-improvement PRs block active feature work unless the improvement prevents repeated damage.
