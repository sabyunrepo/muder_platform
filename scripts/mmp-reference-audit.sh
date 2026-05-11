#!/usr/bin/env bash
# Compare an external reference repo against MMP workflow assets.

set -euo pipefail

usage() {
  cat <<'MSG'
Usage:
  scripts/mmp-reference-audit.sh --target <url_or_path> [--name <label>] [--report <report.md>] [--format md|json]

Description:
  외부 레퍼런스(예: ouroboros)에서 훅/스크립트/skill 구조를 추출해
  MMP로 흡수 가능한 항목을 채택/보류/유지로 정리합니다.

Options:
  --target   분석할 GitHub URL 또는 local 디렉터리 (필수)
  --name     대상 레이블 (레포 파싱 실패 시 표시용, 기본: target 기본값)
  --report   리포트 파일 경로 (기본: stdout)
  --format   출력 형식 (md 또는 json, 기본: md)
  -h, --help 도움말 출력

Examples:
  scripts/mmp-reference-audit.sh --target https://github.com/Q00/ouroboros.git
  scripts/mmp-reference-audit.sh --target /tmp/ouroboros --report /tmp/ouroboros-audit.md
MSG
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "필수 명령을 찾을 수 없습니다: $1" >&2
    exit 127
  fi
}

require_cmd git
require_cmd python3

TARGET=""
REPORT=""
FORMAT="md"
NAME=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET="$2"
      shift 2
      ;;
    --name)
      NAME="$2"
      shift 2
      ;;
    --report)
      REPORT="$2"
      shift 2
      ;;
    --format)
      FORMAT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "🚫 알 수 없는 옵션: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  usage
  exit 2
fi

if [[ "$FORMAT" != "md" && "$FORMAT" != "json" ]]; then
  echo "🚫 --format 은 md 또는 json 이어야 합니다: $FORMAT" >&2
  exit 2
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

run_audit() {
  local target_dir
  local label="$NAME"
  if [[ "$TARGET" =~ ^https?:// || "$TARGET" =~ ^git@ ]]; then
    target_dir="$TMP_DIR/reference"
    git clone --depth 1 "$TARGET" "$target_dir" >/dev/null 2>&1
  else
    if [[ ! -d "$TARGET" ]]; then
      echo "🚫 --target 이 유효한 경로가 아닙니다: $TARGET" >&2
      exit 2
    fi
    target_dir="$TARGET"
  fi

  if [[ -z "$label" ]]; then
    if [[ -f "$target_dir/.git/config" ]]; then
      label="$(git -C "$target_dir" remote get-url origin 2>/dev/null | sed 's#.*/##; s#\.git$##' || true)"
    fi
    if [[ -z "$label" ]]; then
      label="$(basename "$target_dir")"
    fi
  fi

python3 - "$REPO_ROOT" "$target_dir" "$label" "$FORMAT" <<'PY'
import json
from pathlib import Path
import sys


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""


def find_first(path_candidates):
    for candidate in path_candidates:
        if candidate.exists():
            return candidate
    return None


def hook_path(repo: Path) -> Path | None:
    candidates = [
        repo / ".codex" / "hooks.json",
        repo / "hooks" / "hooks.json",
        repo / ".claude-plugin" / "hooks" / "hooks.json",
    ]
    return find_first([p for p in candidates if p is not None])


def list_scripts(repo: Path) -> list[str]:
    base_candidates = [
        repo / ".codex" / "scripts",
        repo / "scripts",
        repo / "src" / "ouroboros" / "scripts",
    ]
    script_names = []
    for scripts_dir in base_candidates:
        if not scripts_dir.exists():
            continue
        script_names.extend([p.name for p in scripts_dir.glob("*.py")])
        script_names.extend([p.name for p in scripts_dir.glob("*.sh")])
    return sorted(set(script_names))


def list_skill_markers(repo: Path) -> list[str]:
    candidates = [
        repo / ".codex" / "skills",
        repo / "skills",
        repo / "src" / "ouroboros" / "plugin" / "agents",
        repo / "src" / "ouroboros" / "plugin" / "skills",
    ]
    names = set()
    for base in candidates:
        if not base.exists():
            continue
        for path in base.rglob("*.md"):
            if path.name.upper() == "README.MD":
                continue
            parent = path.parent
            if path.parent == base:
                names.add(f"{path.parent.name}/{path.name}")
            else:
                names.add(str(path.relative_to(base).with_suffix("")).replace("/", "::"))
    return sorted(names)


def analyze(repo_path: Path) -> dict:
    hook_file = hook_path(repo_path)
    hooks = {"present": bool(hook_file), "events": [], "commands": []}
    if hook_file:
        try:
            payload = json.loads(read_text(hook_file) or "{}")
            hook_cfg = payload.get("hooks", {})
            hooks["events"] = sorted(hook_cfg.keys())
            for entries in hook_cfg.values():
                if not isinstance(entries, list):
                    continue
                for item in entries:
                    cmd = item.get("command", "") if isinstance(item, dict) else ""
                    if cmd:
                        hooks["commands"].append(cmd)
        except Exception:
            hooks["events"] = ["parse_error"]

    script_names = list_scripts(repo_path)
    script_lower = [n.lower() for n in script_names]
    session_start_script = any("session" in name for name in script_lower)
    keyword_script = any("keyword" in name for name in script_lower)
    drift_script = any("drift" in name for name in script_lower)

    session_start_text = ""
    for sdir in [repo_path / ".codex" / "scripts", repo_path / "scripts", repo_path / "src" / "ouroboros" / "scripts"]:
        candidate = sdir / "session-start.py"
        if candidate.exists():
            session_start_text = read_text(candidate)
            break

    keyword_text = ""
    for sdir in [repo_path / ".codex" / "scripts", repo_path / "scripts", repo_path / "src" / "ouroboros" / "scripts"]:
        candidate = sdir / "keyword-detector.py"
        if candidate.exists():
            keyword_text = read_text(candidate)
            break

    skill_names = list_skill_markers(repo_path)
    has_mcp_gate = "is_mcp_configured" in keyword_text
    first_time_hint = "first-time" in keyword_text.lower()

    return {
        "hook": hooks,
        "scripts": {
            "names": script_names,
            "has_keyword_detector": keyword_script,
            "has_drift_monitor": drift_script,
            "has_session_start": session_start_script,
            "has_version_check_in_session_start": "version-check" in session_start_text,
            "has_first_time_onboarding": first_time_hint,
        },
        "skills": {
            "count": len(skill_names),
            "names": skill_names,
            "has_mcp_tool_loading": has_mcp_gate,
        },
    }


def score(source: dict, target: dict) -> dict:
    adopt = []
    defer = []
    keep = []

    if target["scripts"].get("has_version_check_in_session_start") and not source["scripts"].get(
        "has_version_check_in_session_start"
    ):
        adopt.append({
            "title": "세션 시작 시 버전/업데이트 체크 도입",
            "detail": "참조 저장소는 version-check 경로로 업데이트 알림을 제공합니다. MMP는 현재 동등한 점검이 없어 장기 운영에서 최신 동기화 실패를 늦게 발견할 가능성이 있습니다.",
            "priority": "medium",
        })

    if target["scripts"].get("has_keyword_detector") and not source["scripts"].get("has_keyword_detector"):
        adopt.append({
            "title": "요청 라우팅 키워드 패턴 강화",
            "detail": "참조 흐름은 자연어 기반 키워드 감지를 사용해 실행 모듈을 빠르게 제안합니다. MMP는 커맨드형 워크플로에 가까워 단일 스위치형 제안으로 충분한지 점검 후 흡수 가능.",
            "priority": "low",
        })

    if target["scripts"].get("has_session_start") and not source["scripts"].get("has_session_start"):
        adopt.append({
            "title": "세션 시작 훅 점검 항목 확장",
            "detail": "세션 시작에서 브랜치/seed/버전 상태를 함께 점검하면 작업 중단 시각 경고를 줄이고 운영 부담을 낮출 수 있습니다.",
            "priority": "low",
        })

    if target["scripts"].get("has_drift_monitor") and not source["scripts"].get("has_drift_monitor"):
        adopt.append({
            "title": "편집 액션 뒤 드리프트 안내 경량 알림",
            "detail": "참조 저장소는 Write/Edit 직후 진행 상태/드리프트 힌트를 띄웁니다. MMP PostToolUse 훅에 session/seed 연속성 경고를 보강해 유사 효과를 낼 수 있습니다.",
            "priority": "low",
        })

    if target["skills"].get("has_mcp_tool_loading") and not source["skills"].get("has_mcp_tool_loading"):
        defer.append({
            "title": "MCP/도구 등록 검사 흡수",
            "detail": "참조 저장소는 MCP/툴 등록 전제 확인을 내부적으로 수행합니다. MMP는 CLI-first 경로가 주축이라 바로 흡수하면 사용자 운영 환경에서 오탐/오탑 위험이 있습니다.",
            "reason": "Codex CLI 환경과 seed 스크립트 실행 전제의 차이",
        })

    if not adopt:
        keep.append("현재 MMP 훅/seed 체인 구조가 이미 유사 패턴을 갖고 있어 바로 복제할 기능은 제한적입니다.")

    # keep/defer baseline
    if not source["hook"]["present"]:
        keep.append("현재는 source 기준 훅 선언이 없으므로 오탐 방지를 위해 선언형 점검 추가가 필요합니다.")
    else:
        keep.append(f"기존 훅 이벤트는 {', '.join(source['hook'].get('events', []) or ['none'])}로 유지 관리 중입니다.")

    return {
        "adopt": adopt,
        "defer": defer,
        "keep": keep,
    }


repo_root, target_root, label, fmt = sys.argv[1:5]
source = analyze(Path(repo_root))
target = analyze(Path(target_root))
result = {
    "label": label,
    "target": {
        "repo": target_root,
        "hooks_present": target["hook"].get("present"),
        "hook_events": target["hook"].get("events", []),
        "scripts": target["scripts"],
        "skills": target["skills"],
        "insights": score(source, target),
    },
    "mmp": {
        "hooks_present": source["hook"].get("present"),
        "hook_events": source["hook"].get("events", []),
        "scripts": source["scripts"],
        "skills": source["skills"],
    },
}

if fmt == "json":
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit

insights = result["target"]["insights"]

out = [
    "# MMP 외부 레퍼런스 흡수 분석",
    f"## 대상: {label}",
    "",
    "### 분석 범위",
    "- hooks.json (있으면 event/command)",
    "- scripts/*.py/*.sh (핵심 workflow 훅)",
    "- skills/agent skill 문서 존재",
    "",
    "### MMP 기준 상태",
    f"- Hooks JSON 존재: {'있음' if source['hook']['present'] else '없음'}",
    f"- Hook 이벤트: {', '.join(source['hook'].get('events', []) or ['none'])}",
    f"- 스크립트: {', '.join(source['scripts']['names']) if source['scripts']['names'] else 'none'}",
    f"- Skill 파일: {source['skills']['count']} ({', '.join(source['skills']['names']) if source['skills']['names'] else 'none'})",
    "",
    "### 대상 기준 상태",
    f"- Hooks JSON 존재: {'있음' if target['hook']['present'] else '없음'}",
    f"- Hook 이벤트: {', '.join(target['hook'].get('events', []) or ['none'])}",
    f"- 스크립트: {', '.join(target['scripts']['names']) if target['scripts']['names'] else 'none'}",
    f"- Skill 파일: {target['skills']['count']} ({', '.join(target['skills']['names']) if target['skills']['names'] else 'none'})",
    "",
    "### 채택 제안",
    "#### 즉시 채택",
]

for item in insights["adopt"]:
    out.extend([
        f"- [{item.get('priority', 'medium')}] {item['title']}",
        f"  - {item['detail']}",
    ])

out.extend(["", "#### 보류", ""])
for item in insights["defer"]:
    out.extend([
        f"- {item['title']}",
        f"  - {item['detail']}",
    ])
    if item.get("reason"):
        out.append(f"  - 근거: {item['reason']}")

out.extend(["", "#### 유지", ""])
for item in insights["keep"]:
    out.append(f"- {item}")

print("\n".join(out))
PY
}

if [[ -n "$REPORT" ]]; then
  mkdir -p "$(dirname "$REPORT")"
  run_audit | tee "$REPORT"
  echo "✅ 분석 리포트 저장: $REPORT"
else
  run_audit
fi
