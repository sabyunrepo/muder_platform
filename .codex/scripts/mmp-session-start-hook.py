#!/usr/bin/env python3
"""SessionStart hook for Codex + MMP workflow.

Print concise, non-blocking operation tips to stderr once per cooldown period.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import os


COOLDOWN_SECONDS = 6 * 60 * 60
STATE_FILE = Path.home() / ".local" / "state" / "mmp-workflow" / "codex-hook-session.json"
REPO_ROOT = Path(__file__).resolve().parents[2]


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


def _extract_issue_from_branch(branch: str) -> str | None:
  match = re.search(r"(?:^|/)(?:issue-(\d+))", branch)
  if not match:
    return None
  return match.group(1)


def _read_seed_status(issue: str) -> str | None:
  seed_path = _seed_path(issue)
  if not seed_path:
    return None
  try:
    payload = json.loads(seed_path.read_text(encoding="utf-8"))
    return payload.get("status")
  except Exception:
    return None


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


def _should_report_now() -> bool:
  if not STATE_FILE.exists():
    return True
  try:
    payload = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    raw = payload.get("last_session_start")
    if not raw:
      return True
    last = datetime.fromisoformat(raw)
    return datetime.now(timezone.utc) - last > timedelta(seconds=COOLDOWN_SECONDS)
  except Exception:
    return True


def _mark_reported() -> None:
  try:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps({"last_session_start": datetime.now(timezone.utc).isoformat()}), encoding="utf-8")
  except Exception:
    pass


def _build_context_lines(branch: str, issue: str | None, hooks_enabled: str, strict: str) -> list[str]:
  lines = [
    "MMP 작업 가이드: scripts/mmp-workflow-agent.sh bootstrap/commit/complete 경로로 명령을 줄이면 수동 반복 작업이 줄어듭니다.",
    "Agentic/OOO/subagent/harness 작업은 mmp-agentic-delivery-chain에서 시작하고, 마지막에는 독립 review/validation + omx cleanup을 확인하세요.",
    f"현재 훅 상태: hooks={hooks_enabled}, strict={strict}",
  ]

  if strict != "1":
    lines.append("현재는 인터뷰/seed strict 가드가 비활성화되어 있습니다. 임시 운영 모드에서 진행 중입니다.")

  if issue:
    lines.append(f"현재 브랜치에서 issue-{issue} 감지됨.")
    status = _read_seed_status(issue)
    if status is None:
      lines.append(f"⚠️ issue-{issue} seed가 없습니다. bootstrap부터 시작하세요.")
      lines.append(f"  - scripts/mmp-workflow-agent.sh bootstrap --issue {issue} --auto-approve")
    elif status == "draft":
      lines.append(f"⚠️ issue-{issue} seed가 draft 상태입니다. 승인 후 작업하세요.")
      lines.append(f"  - scripts/mmp-workflow-seed.sh set-status --issue {issue} --status approved")
    elif status == "blocked":
      lines.append(f"⛔️ issue-{issue} seed가 blocked 상태입니다. 사유 점검 후 blocked 해제 후 진행하세요.")
    elif status == "approved":
      lines.append(f"✅ issue-{issue} seed approved: bootstrap/commit/pr 경로 사용 준비 완료")
    else:
      lines.append(f"status: issue-{issue} = {status}")

    lines.extend([
      "추천 실행 순서:",
      f"  1) scripts/mmp-workflow-agent.sh bootstrap --issue {issue} --auto-approve",
      f"  2) Agentic 필요 시 mmp-agentic-delivery-chain 적용",
      f"  3) 코드 변경 후 scripts/mmp-workflow-agent.sh commit --issue {issue} --message \"feat: issue-{issue} ...\" --create-pr -- --title \"feat: issue-{issue}\"",
      f"  4) 독립 review/validation, omx cleanup 확인 후 scripts/mmp-workflow-agent.sh complete --issue {issue}",
    ])
  else:
    lines.append("현재 브랜치에서 issue 번호를 감지하지 못했습니다.")
    lines.append("issue 워크플로 시작이 필요하면 다음 중 하나를 사용하세요:")
    lines.append("  - scripts/mmp-workflow-agent.sh bootstrap --issue <번호> --auto-approve")
    lines.append("  - export MMP_ISSUE_NUMBER=<번호>")

  return lines


def main() -> None:
  _configure_utf8_stdio()

  if os.environ.get("MMP_WORKFLOW_HOOKS_ENABLED", "1") != "1":
    return

  if not _should_report_now():
    return

  _mark_reported()

  hooks_enabled = "1" if os.environ.get("MMP_WORKFLOW_HOOKS_ENABLED", "1") == "1" else "0"
  strict = os.environ.get("MMP_WORKFLOW_INTERVIEW_STRICT", "1")

  branch = _current_branch()
  issue = _extract_issue_from_branch(branch) if branch else None

  for line in _build_context_lines(branch or "(branch unknown)", issue, hooks_enabled, strict):
    print(line, file=sys.stderr)


if __name__ == "__main__":
  main()
