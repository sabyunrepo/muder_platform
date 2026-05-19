#!/usr/bin/env python3
"""UserPromptSubmit keyword router for MMP workflow hints."""

from __future__ import annotations

import re
import sys
import json


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
  if action == "agentic_chain":
    return "- agentic-chain: mmp-agentic-delivery-chain (ambiguous broad workflow: mmp-requirements-interviewer -> deep-interview -> mandatory ouroboros_interview -> bounded OOO refinement)"

  if action == "requirements_interview":
    return "- requirements-interview: mmp-requirements-interviewer (spawn when subagent use is explicit; otherwise main Codex runs the same deep-interview -> mandatory ouroboros_interview -> Execution Brief flow)"

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
  {
    "patterns": [
      "requirements interview",
      "요구사항 인터뷰",
      "요구사항 구체화",
      "요구사항 구체화해줘",
      "요구사항 구체화해",
      "계획부터",
      "계획 세워",
      "계획 세워줘",
      "계획 짜",
      "계획 짜줘",
      "계획 짜봐",
      "계획짜",
      "계획짜줘",
      "계획짜봐",
      "인터뷰",
      "interview",
    ],
    "action": "requirements_interview",
  },
  {"patterns": ["mmp bootstrap", "mmp 시작", "mmp 인터뷰", "mmp setup", "workflow bootstrap", "deep interview", "심층인터뷰"], "action": "bootstrap"},
  {"patterns": ["mmp commit", "mmp 커밋", "mmp save", "mmp 저장"], "action": "commit"},
  {"patterns": ["mmp complete", "mmp 완료"], "action": "complete"},
  {"patterns": ["mmp status", "mmp 상태"], "action": "status"},
  {"patterns": ["mmp pr", "mmp pull request", "mmp pr 생성", "mmp github"], "action": "pr"},
  {"patterns": ["mmp 도움", "mmp 도움말", "mmp 사용법"], "action": "help"},
]


AGENTIC_CHAIN_PATTERNS = [
  "ooo",
  "agentic",
  "agentic workflow",
  "agentic chain",
  "harness",
  "workflow harness",
  "subagent",
  "sub-agent",
  "sub agent",
  "independent validation",
  "independent review",
  "do not review your own work",
  "don't review your own work",
  "do not validate your own work",
  "don't validate your own work",
  "독립 검증",
  "독립 리뷰",
  "본인이 리뷰 금지",
  "본인이 검증 금지",
  "본인이 리뷰하지",
  "본인이 검증하지",
  "자기 리뷰 금지",
  "자기 검증 금지",
  "자가 리뷰 금지",
  "자가 검증 금지",
]


def detect(text: str) -> str | None:
  for entry in KEYWORD_MAP:
    for pattern in entry["patterns"]:
      if _word_boundary_match(pattern, text):
        return entry["action"]
  for pattern in AGENTIC_CHAIN_PATTERNS:
    if re.search(r"[가-힣]", pattern) and pattern in text:
      return "agentic_chain"
    if _word_boundary_match(pattern, text):
      return "agentic_chain"
  return None


def main() -> None:
  _configure_utf8_stdio()

  user_input = sys.stdin.read()
  try:
    payload = json.loads(user_input) if user_input.strip() else {}
  except json.JSONDecodeError:
    payload = {}

  prompt = payload.get("prompt") if isinstance(payload, dict) else None
  text = _normalize(prompt if isinstance(prompt, str) else user_input)
  if not text:
    print("", end="")
    return

  action = detect(text)
  if not action:
    print("", end="")
    return

  issue = _find_issue(text)
  hint = _render(action, issue)
  if not hint:
    print("", end="")
    return

  print(
    json.dumps(
      {
        "hookSpecificOutput": {
          "hookEventName": "UserPromptSubmit",
          "additionalContext": hint,
        }
      },
      ensure_ascii=False,
    ),
    end="",
  )


if __name__ == "__main__":
  main()
