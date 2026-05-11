#!/usr/bin/env python3
"""UserPromptSubmit keyword router for MMP workflow hints."""

from __future__ import annotations

import re
import sys


def _configure_utf8_stdio() -> None:
  for stream in (sys.stdout, sys.stderr):
    encoding = getattr(stream, "encoding", None)
    reconfigure = getattr(stream, "reconfigure", None)
    if encoding and encoding.lower().replace("-", "") != "utf8" and reconfigure:
      reconfigure(encoding="utf-8", errors="replace")


def _normalize(text: str) -> str:
  return text.lower().strip()


def _word_boundary_match(pattern: str, text: str) -> bool:
  # Match on token boundaries with hyphen-safe edges to reduce false positives.
  boundary_lead = r"(?:^|[^\w-])"
  boundary_trail = r"(?:$|[^\w-])"
  return bool(re.search(boundary_lead + re.escape(pattern) + boundary_trail, text))


def _find_issue(text: str) -> str | None:
  # 1) 명시적 토큰 기반 추출
  candidates: list[str] = []
  patterns = [
    r"(?:^|[^\w-])#(\d+)(?:[가-힣]{0,8})?(?=$|[^\w-])",
    r"(?:^|[^\w-])issue[- ]?(\d+)(?:[가-힣]{0,8})?(?=$|[^\w-])",
    r"(?:^|[^\w-])이슈[- ]?(\d+)(?:[가-힣]{0,8})?(?=$|[^\w-])",
    r"(?:^|[^\w-])번호[- ]?(\d+)(?:[가-힣]{0,8})?(?=$|[^\w-])",
    r"(?:^|[^\w-])no\.?[- ]?(\d+)(?:[가-힣]{0,8})?(?=$|[^\w-])",
  ]
  for pattern in patterns:
    match = re.search(pattern, text)
    if match:
      candidates.append(match.group(1))

  if candidates:
    return candidates[0]

  # 2) 단일 고립 숫자 폴백은 생략: 오탐을 방지하려면 명시적 이슈 토큰만 사용
  return None


def _build_action_line(action: str, issue: str | None) -> str:
  if action == "bootstrap":
    if issue:
      return f"- bootstrap: scripts/mmp-workflow-agent.sh bootstrap --issue {issue} --auto-approve"
    return "- bootstrap: scripts/mmp-workflow-agent.sh bootstrap --issue <번호> --auto-approve"

  if action == "commit":
    if issue:
      return (
        f"- commit: scripts/mmp-workflow-agent.sh commit --issue {issue} --message \"feat: issue-{issue} ...\" --create-pr -- --title \"feat: issue-{issue}\""
      )
    return (
      "- commit: scripts/mmp-workflow-agent.sh commit --issue <번호> --message \"feat: issue-<번호> ...\" --create-pr -- --title \"feat: issue-<번호>\""
    )

  if action == "complete":
    if issue:
      return f"- complete: scripts/mmp-workflow-agent.sh complete --issue {issue}"
    return "- complete: scripts/mmp-workflow-agent.sh complete --issue <번호>"

  if action == "status":
    if issue:
      return f"- status: scripts/mmp-workflow-agent.sh status --issue {issue}"
    return "- status: scripts/mmp-workflow-agent.sh status --issue <번호>"

  if action == "pr":
    if issue:
      return f"- pr: scripts/mmp-workflow-agent.sh pr --issue {issue}"
    return "- pr: scripts/mmp-workflow-agent.sh pr --issue <번호>"

  if action == "help":
    return "- usage: scripts/mmp-workflow-agent.sh"

  return ""


def _render(action: str, issue: str | None) -> str | None:
  line = _build_action_line(action, issue)
  if not line:
    return None
  return "<mmp-workflow-hint>\n" + line + "\n</mmp-workflow-hint>"


KEYWORD_MAP = [
  {"patterns": ["mmp bootstrap", "mmp 시작", "mmp 인터뷰", "mmp setup", "workflow bootstrap", "deep interview", "심층인터뷰"], "action": "bootstrap"},
  {"patterns": ["mmp commit", "mmp 커밋", "mmp save", "mmp 저장"], "action": "commit"},
  {"patterns": ["mmp complete", "mmp 완료"], "action": "complete"},
  {"patterns": ["mmp status", "mmp 상태"], "action": "status"},
  {"patterns": ["mmp pr", "mmp pull request", "mmp pr 생성", "mmp github"], "action": "pr"},
  {"patterns": ["mmp 도움", "mmp 도움말", "mmp 사용법"], "action": "help"},
]


def detect(text: str) -> str | None:
  for entry in KEYWORD_MAP:
    for pattern in entry["patterns"]:
      if _word_boundary_match(pattern, text):
        return entry["action"]
  return None


def main() -> None:
  _configure_utf8_stdio()

  user_input = sys.stdin.read()
  text = _normalize(user_input)
  if not text:
    print("", end="")
    return

  action = detect(text)
  if not action:
    print(user_input, end="")
    return

  issue = _find_issue(text)
  hint = _render(action, issue)
  if not hint:
    print(user_input, end="")
    return

  print(f"{user_input}\n\n{hint}", end="")


if __name__ == "__main__":
  main()
