#!/usr/bin/env bash
# compound-mmp plugin - directory source install workaround.
#
# Claude Code 의 directory-source marketplace 는 enable 시 installed_plugins.json
# 메타데이터만 기록하고 실제 cache 디렉토리(`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`)
# 로의 파일 복사를 누락한다 (2026-04-28 확인). 그 결과 슬래시 커맨드가 등록되지 않음.
#
# 이 스크립트는 cache 경로를 plugin source 디렉토리로 가리키는 symlink 를 만들어
# 슬래시 커맨드(`/compound-resume`, `/compound-review`, `/compound-wrap`)를 활성화한다.
#
# 사용법: 이 repo clone 직후 1회 실행. 이후 Claude Code 재시작.
#   bash .claude/plugins/compound-mmp/scripts/install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_NAME="compound-mmp"
MARKETPLACE="ctm"

VERSION="$(python3 -c "import json; print(json.load(open('$PLUGIN_DIR/.claude-plugin/plugin.json'))['version'])")"
CACHE_BASE="${CLAUDE_PLUGINS_DIR:-$HOME/.claude/plugins}/cache/$MARKETPLACE/$PLUGIN_NAME"
TARGET="$CACHE_BASE/$VERSION"

mkdir -p "$CACHE_BASE"
ln -sfn "$PLUGIN_DIR" "$TARGET"

echo "✓ symlinked $TARGET → $PLUGIN_DIR"
echo "✓ commands available after Claude Code restart:"
ls "$TARGET/commands/" 2>/dev/null | sed 's/\.md$//' | sed 's/^/    \//'
