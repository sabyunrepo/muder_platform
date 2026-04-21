---
name: 메모리 canonical = repo/memory/ (user home은 archival)
description: 프로젝트 메모리 단일 출처는 repo `memory/`. auto-memory 기본값인 user home `~/.claude/projects/.../memory/`는 읽지·쓰지 않음. frontmatter `originSessionId` 금지.
type: feedback
---
프로젝트 메모리의 단일 출처는 **repo `memory/`**. user home 경로는 auto-memory 시스템 기본값이지만 이 프로젝트에서는 archival 스냅샷으로 격하.

**Why:** 2026-04-21 Phase 19 Residual PR-0에서 확인 — user home과 repo가 동시에 누적되면서 drift 발생 (MEMORY.md 기준 3건 누락, feedback 3건 구버전, QMD `mmp-memory` 컬렉션 경로가 user home을 바라봐 repo 업데이트 반영 불가). 단일 경로로 통일하지 않으면 재발.

**How to apply:**
1. **신규 memory 파일 작성 시**: Write tool 경로를 `memory/<name>.md` (repo 상대)로 지정. user home 경로 사용 금지.
2. **MEMORY.md index**: repo의 `memory/MEMORY.md`만 갱신. user home의 것은 읽지 않음.
3. **QMD 재인덱싱**: `qmd update` 또는 `qmd collection remove mmp-memory && qmd collection add <repo>/memory --name mmp-memory`. `sqlite3 ~/.cache/qmd/index.sqlite "SELECT path FROM store_collections WHERE name='mmp-memory'"`로 canonical path 검증.
4. **frontmatter `originSessionId` 금지**: auto-memory가 세션 UUID를 자동 주입하는 필드. 수동 memory 작성 시 포함하지 말 것. 기존 user home 스냅샷을 repo로 가져올 때 `sed '/^originSessionId: /d'`로 스트립.
5. **예외 (auto-memory가 user home에 쓴 경우)**: 드물게 시스템 프롬프트가 user home 경로를 강제하는 케이스 — 세션 종료 전 `diff -rq <user-home> memory/`로 확인하고 repo로 동기화 + session-id 스트립 + MEMORY.md pointer 추가 + `qmd update`.
6. **검증 Gate**: 세션 종료 전 `diff -rq <user-home> memory/` drift 0건 + `qmd search -c mmp-memory` 전수 hit.
