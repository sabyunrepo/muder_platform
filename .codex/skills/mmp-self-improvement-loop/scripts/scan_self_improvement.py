#!/usr/bin/env python3
"""Summarize MMP self-improvement state without loading archive logs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[4]
STATE_PATH = ROOT / "docs" / "ops" / "self-improvement" / "state.json"
CANDIDATES_PATH = ROOT / "docs" / "ops" / "self-improvement" / "candidates.jsonl"


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def load_candidates(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                rows.append(json.loads(stripped))
            except json.JSONDecodeError as exc:
                raise SystemExit(f"Invalid JSONL at {path}:{line_number}: {exc}") from exc
    return rows


def validate_state(state: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if state.get("schema_version") != 1:
        errors.append("schema_version must be 1")
    triggers = state.get("triggers")
    if not isinstance(triggers, dict):
        errors.append("triggers must be an object")
    else:
        for key in ["review_after_pr_count", "repeat_signal_threshold", "repeat_manual_command_threshold"]:
            if not isinstance(triggers.get(key), int) or triggers[key] < 1:
                errors.append(f"triggers.{key} must be a positive integer")
    for key in ["active_candidates", "resolved_candidates"]:
        if not isinstance(state.get(key), list):
            errors.append(f"{key} must be an array")
    return errors


def summarize(state: dict[str, Any], candidates: list[dict[str, Any]]) -> str:
    active = state.get("active_candidates", [])
    triggers = state.get("triggers", {})
    lines = [
        "# MMP Self-Improvement Summary",
        "",
        f"- updated_at: {state.get('updated_at', 'unknown')}",
        f"- active_candidates: {len(active)}",
        f"- jsonl_candidates: {len(candidates)}",
        f"- trigger: PR {triggers.get('review_after_pr_count', '?')}개 또는 반복 signal {triggers.get('repeat_signal_threshold', '?')}회",
        "",
        "## Active candidates",
    ]
    if not active:
        lines.append("- 없음")
    for item in active:
        lines.append(
            f"- {item.get('id')}: count={item.get('count')} target={item.get('recommended_target')} next={item.get('next_action')}"
        )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", action="store_true", help="print a concise summary")
    parser.add_argument("--validate", action="store_true", help="validate state and JSONL shape")
    args = parser.parse_args()

    state = load_json(STATE_PATH)
    candidates = load_candidates(CANDIDATES_PATH)

    errors = validate_state(state)
    candidate_ids = {item.get("id") for item in candidates if item.get("id")}
    for item in state.get("active_candidates", []):
        if item.get("id") not in candidate_ids:
            errors.append(f"active candidate {item.get('id')} is missing from candidates.jsonl")

    if args.validate:
        if errors:
            for error in errors:
                print(f"ERROR: {error}")
            return 1
        print("Self-improvement state OK")

    if args.summary or not args.validate:
        print(summarize(state, candidates))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
