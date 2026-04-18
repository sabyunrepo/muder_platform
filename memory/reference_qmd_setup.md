---
name: QMD 로컬 문서 검색 설정
description: QMD MCP 서버 설정, 컬렉션 구성, Hook 강제 구조 — 설계 문서 검색 시 참조
type: reference
originSessionId: 03af9547-3119-43e4-acf8-127b84e2e0e6
---
QMD가 MCP 서버로 등록됨 (`~/.claude/settings.json` → mcpServers.qmd)

**MCP 도구명:**
- `search` — 키워드 매칭 (~30ms)
- `vector_search` — 시맨틱 유사도 (~2s)
- `deep_search` — 하이브리드+리랭킹 (~10s)
- `get` / `multi_get` — 문서 조회
- `status` — 인덱스 상태

**컬렉션 3개 (mmp 전용 — 2026-04-15 vantict 제거):**
- `mmp-plans` — `docs/plans/` (216 문서)
- `mmp-memory` — `.claude/projects/.../memory/` (42 문서)
- `mmp-specs` — `docs/superpowers/` (9 문서)
- 글로벌 config: `~/.config/qmd/index.yml` (단일 인덱스, 모든 컬렉션 한 MCP 프로세스에 상주)
- vantict(IaaS) 등 타 프로젝트 컬렉션은 등록 시 동일 MCP에 합류 → 메모리 누적 원인. 분리 필요 시 `--index <name>` 옵션으로 별도 인덱스 사용

**강제 구조 (4 hooks):**
1. `qmd-enforcer.sh` (PreToolUse Grep|Read) — docs/plans, memory 경로 접근 시 QMD 리마인더
2. `readonce.sh` (PreToolUse Read) — 동일 세션 내 파일 재읽기 감지, 해시 비교로 "변경 없음" 경고
3. `build-filter.sh` (PostToolUse Bash) — 테스트/빌드 30줄+ 출력을 에러만 요약
4. `precompact.sh` (PreCompact) — 압축 전 active plan 상태 + git 상태 자동 보존
5. `skill-rules.json`에 `design-docs` 규칙 (UserPromptSubmit 키워드 감지)

**새 문서 추가 시:** `qmd embed` 재실행 필요
