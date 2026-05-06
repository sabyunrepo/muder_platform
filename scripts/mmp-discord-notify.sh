#!/usr/bin/env bash
set -euo pipefail

event="manual"
title="MMP Codex 알림"
message=""
urgency="normal"
cooldown_key=""
cooldown_seconds=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --event)
      if [[ $# -ge 2 && "${2:-}" != --* ]]; then
        event="$2"
        shift 2
      else
        event="manual"
        shift 1
      fi
      ;;
    --title)
      if [[ $# -ge 2 && "${2:-}" != --* ]]; then
        title="$2"
        shift 2
      else
        title="MMP Codex 알림"
        shift 1
      fi
      ;;
    --message)
      if [[ $# -ge 2 && "${2:-}" != --* ]]; then
        message="$2"
        shift 2
      else
        message=""
        shift 1
      fi
      ;;
    --urgency)
      if [[ $# -ge 2 && "${2:-}" != --* ]]; then
        urgency="$2"
        shift 2
      else
        urgency="normal"
        shift 1
      fi
      ;;
    --cooldown-key)
      if [[ $# -ge 2 && "${2:-}" != --* ]]; then
        cooldown_key="$2"
        shift 2
      else
        cooldown_key=""
        shift 1
      fi
      ;;
    --cooldown-seconds)
      if [[ $# -ge 2 && "${2:-}" != --* ]]; then
        cooldown_seconds="$2"
        shift 2
      else
        cooldown_seconds="0"
        shift 1
      fi
      ;;
    *)
      if [[ -z "$message" ]]; then
        message="$1"
      else
        message="${message}"$'\n'"$1"
      fi
      shift
      ;;
  esac
done

if [[ -z "$message" ]]; then
  message="Codex가 사용자 응답이 필요한 지점에 도달했습니다. 터미널로 돌아와 확인해 주세요."
fi

webhook_url="${MMP_DISCORD_WEBHOOK_URL:-}"
webhook_file="${MMP_DISCORD_WEBHOOK_FILE:-$HOME/.codex/mmp-discord-webhook-url}"
if [[ -z "$webhook_url" && -r "$webhook_file" ]]; then
  webhook_url="$(tr -d '\r\n' < "$webhook_file")"
fi

if [[ -z "$webhook_url" ]]; then
  exit 0
fi

if [[ "$webhook_url" != https://discord.com/api/webhooks/* ]]; then
  echo "mmp-discord-notify: invalid Discord webhook URL" >&2
  exit 0
fi

repo_dir="$(pwd)"
repo_name="$(basename "$repo_dir")"
branch=""
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if [[ -n "$repo_root" ]]; then
    repo_name="$(basename "$repo_root")"
  fi
  branch="$(git branch --show-current 2>/dev/null || true)"
fi

if [[ -z "$cooldown_key" ]]; then
  cooldown_key="${event}:${repo_name}:${title}"
fi

stamp_file=""
now="$(date +%s)"
if [[ "$cooldown_seconds" =~ ^[0-9]+$ && "$cooldown_seconds" -gt 0 ]]; then
  state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/mmp-discord-notify"
  mkdir -p "$state_dir"
  key_hash="$(node -e 'const crypto=require("crypto"); process.stdout.write(crypto.createHash("sha256").update(process.argv[1]).digest("hex"))' "$cooldown_key")"
  stamp_file="$state_dir/$key_hash"
  if [[ -r "$stamp_file" ]]; then
    last="$(cat "$stamp_file" 2>/dev/null || echo 0)"
    if [[ "$last" =~ ^[0-9]+$ && $((now - last)) -lt "$cooldown_seconds" ]]; then
      exit 0
    fi
  fi
fi

content="$(node - "$event" "$title" "$message" "$urgency" "$repo_name" "$branch" <<'NODE'
const [, , event, title, message, urgency, repoName, branch] = process.argv;
const lines = [
  '🔔 **MMP Codex 알림**',
  `**${title}**`,
  '',
  message,
  '',
  `event: \`${event}\` · urgency: \`${urgency}\``,
  `repo: \`${repoName}\`${branch ? ` · branch: \`${branch}\`` : ''}`,
  '',
  '터미널로 돌아와 응답해 주세요.',
];
const content = lines.join('\n').slice(0, 1900);
process.stdout.write(JSON.stringify({
  content,
  allowed_mentions: { parse: [] },
}));
NODE
)"

if curl -fsS \
  --connect-timeout 3 \
  --max-time 8 \
  -H "Content-Type: application/json" \
  -X POST \
  --data "$content" \
  "$webhook_url" >/dev/null 2>&1; then
  if [[ -n "$stamp_file" ]]; then
    tmp_stamp="${stamp_file}.$$"
    printf '%s' "$now" > "$tmp_stamp"
    mv "$tmp_stamp" "$stamp_file"
  fi
fi
