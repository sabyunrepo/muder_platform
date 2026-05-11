#!/usr/bin/env python3
"""PostToolUse advisory hook for MMP workflow continuity."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
STATE_FILE = Path.home() / ".local" / "state" / "mmp-workflow" / "codex-posttool.json"
COOLDOWN_MINUTES = 30


def _configure_utf8_stdio() -> None:
  for stream in (sys.stdout, sys.stderr):
    encoding = getattr(stream, "encoding", None)
    reconfigure = getattr(stream, "reconfigure", None)
    if encoding and encoding.lower().replace("-", "") != "utf8" and reconfigure:
      reconfigure(encoding="utf-8", errors="replace")


def _current_branch() -> str:
  try:
    result = subprocess.run(
      ["git", "rev-parse", "--abbrev-ref", "HEAD"],
      cwd=REPO_ROOT,
      capture_output=True,
      text=True,
      check=False,
    )
    return result.stdout.strip()
  except Exception:
    return ""


def _issue_from_branch(branch: str) -> str | None:
  match = re.search(r"(?:^|/)(?:issue-(\d+))", branch)
  if not match:
    return None
  return match.group(1)


def _seed_path(issue: str) -> Path | None:
  try:
    result = subprocess.run(
      ["git", "rev-parse", "--git-common-dir"],
      cwd=REPO_ROOT,
      capture_output=True,
      text=True,
      check=False,
    )
    common_dir = result.stdout.strip()
    if not common_dir:
      return None
    return Path(common_dir) / "mmp-workflow" / "seeds" / f"issue-{issue}.json"
  except Exception:
    return None


def _seed_status(issue: str) -> str | None:
  seed_file = _seed_path(issue)
  if not seed_file or not seed_file.exists():
    return None
  try:
    payload = json.loads(seed_file.read_text(encoding="utf-8"))
    return payload.get("status")
  except Exception:
    return None


def _load_state() -> dict:
  if not STATE_FILE.exists():
    return {}
  try:
    return json.loads(STATE_FILE.read_text(encoding="utf-8"))
  except Exception:
    return {}


def _save_state(state: dict) -> None:
  try:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state), encoding="utf-8")
  except Exception:
    pass


def _seed_events(issue: str) -> tuple[int, int]:
  """Return counts for acceptance/done criteria."""
  seed_file = _seed_path(issue)
  if not seed_file or not seed_file.exists():
    return 0, 0
  try:
    payload = json.loads(seed_file.read_text(encoding="utf-8"))
    accept_len = len(payload.get("acceptance_criteria") or [])
    done_len = len(payload.get("done_criteria") or [])
    return accept_len, done_len
  except Exception:
    return 0, 0


def main() -> None:
  _configure_utf8_stdio()

  if os.environ.get("MMP_WORKFLOW_HOOKS_ENABLED", "1") != "1":
    return

  if os.environ.get("MMP_WORKFLOW_HOOKS_SKIP", "0") == "1":
    return

  branch = _current_branch()
  if not branch:
    return
  issue = _issue_from_branch(branch) or os.environ.get("MMP_ISSUE_NUMBER")
  if not issue:
    return

  key = f"issue-{issue}"
  state = _load_state()
  now = datetime.now(timezone.utc)
  last = state.get(key)

  if last:
    try:
      last_dt = datetime.fromisoformat(last)
      if now - last_dt < timedelta(minutes=COOLDOWN_MINUTES):
        return
    except Exception:
      pass

  status = _seed_status(issue)
  accept_len, done_len = _seed_events(issue)

  if os.environ.get("MMP_WORKFLOW_INTERVIEW_STRICT", "1") != "1":
    return

  if status in {None, "", "draft"}:
    print(
      f"MMP 경고: issue {issue} 브랜치입니다. seed가 없거나 draft 상태입니다."
      f" 작업 전 scripts/mmp-workflow-agent.sh bootstrap --issue {issue} --auto-approve 을 먼저 실행하세요.",
      file=sys.stderr,
    )
  elif status == "blocked":
    print(
      f"MMP 경고: issue {issue} 브랜치의 seed가 blocked 상태입니다."
      f" PR/커밋 전 blocked 사유를 정리하고 set-status로 해제하세요.",
      file=sys.stderr,
    )
  elif status not in {"approved", "completed"}:
    print(f"MMP 경고: issue {issue} seed 상태={status}. approved 또는 completed 필요.", file=sys.stderr)
  else:
    if accept_len == 0:
      print(
        f"MMP 확인: issue {issue} seed에 acceptance_criteria가 비어 있습니다."
        " PR/커밋 게이트에서 차단될 수 있습니다.",
        file=sys.stderr,
      )
    if done_len == 0:
      print(
        f"MMP 확인: issue {issue} seed에 done_criteria가 비어 있습니다."
        " PR/커밋 게이트에서 차단될 수 있습니다.",
        file=sys.stderr,
      )

    # 상태가 양호할 때는 출력 없이 조용히 유지

  state[key] = now.isoformat()
  _save_state(state)


if __name__ == "__main__":
  main()
