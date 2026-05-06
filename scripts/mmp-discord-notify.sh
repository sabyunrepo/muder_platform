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
      event="${2:-manual}"
      shift 2
      ;;
    --title)
      title="${2:-MMP Codex 알림}"
      shift 2
      ;;
    --message)
      message="${2:-}"
      shift 2
      ;;
    --urgency)
      urgency="${2:-normal}"
      shift 2
      ;;
    --cooldown-key)
      cooldown_key="${2:-}"
      shift 2
      ;;
    --cooldown-seconds)
      cooldown_seconds="${2:-0}"
      shift 2
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
branch=""
if command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  branch="$(git branch --show-current 2>/dev/null || true)"
fi

if [[ -z "$cooldown_key" ]]; then
  cooldown_key="${event}:${repo_dir}:${title}"
fi

if [[ "$cooldown_seconds" =~ ^[0-9]+$ && "$cooldown_seconds" -gt 0 ]]; then
  state_dir="${XDG_STATE_HOME:-$HOME/.local/state}/mmp-discord-notify"
  mkdir -p "$state_dir"
  key_hash="$(printf '%s' "$cooldown_key" | shasum -a 256 | awk '{print $1}')"
  stamp_file="$state_dir/$key_hash"
  now="$(date +%s)"
  if [[ -r "$stamp_file" ]]; then
    last="$(cat "$stamp_file" 2>/dev/null || echo 0)"
    if [[ "$last" =~ ^[0-9]+$ && $((now - last)) -lt "$cooldown_seconds" ]]; then
      exit 0
    fi
  fi
  printf '%s' "$now" > "$stamp_file"
fi

content="$(node - "$event" "$title" "$message" "$urgency" "$repo_dir" "$branch" <<'NODE'
const [, , event, title, message, urgency, repoDir, branch] = process.argv;
const lines = [
  '🔔 **MMP Codex 알림**',
  `**${title}**`,
  '',
  message,
  '',
  `event: \`${event}\` · urgency: \`${urgency}\``,
  `repo: \`${repoDir}\`${branch ? ` · branch: \`${branch}\`` : ''}`,
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

curl -fsS \
  -H "Content-Type: application/json" \
  -X POST \
  --data "$content" \
  "$webhook_url" >/dev/null 2>&1 || true
