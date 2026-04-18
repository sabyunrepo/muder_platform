---
name: graphify refresh 정책 (D) — Phase 종료 시점 fresh rebuild만 허용
description: repo graphify-out/graph.json은 Phase 종료 시 수동 fresh rebuild + PR. 일상 post-commit/watch/update는 개인 로컬 전용, 커밋 금지
type: project
originSessionId: 23f1b5bf-4a2e-43fc-80d3-00b276d49de1
---
2026-04-18 결정. post-commit hook의 AST-only 재빌드가 semantic 개념 노드 53개(~6%, 852→799 source_file)를 영구 손실하는 upstream 버그 확인 후 수립.

**정책 (D):**
- repo의 `graphify-out/graph.json` / `GRAPH_REPORT.md` / `manifest.json`은 **Phase 종료 시점에만** fresh rebuild → PR
- 일상 개발: `make graphify-watch` / `make graphify-update` / post-commit hook은 **개인 로컬 전용**, 결과물 **커밋 금지**
- `make graphify-setup`은 hook 자동 설치 **제거** (원하면 `make graphify-install-hooks` 별도 실행)
- `.gitignore`에 `graphify-out/graph.html` + `graphify-out/obsidian/` 추가 — 자동 생성 파생물 상시 차단

**Phase 종료 워크플로우:**
1. `make graphify-refresh` — 안내 출력
2. 새 Claude Code 세션에서 `/graphify .` — 캐시 적중으로 변경 MD만 재추출
3. `graph.json` + `GRAPH_REPORT.md` + `manifest.json` 만 Phase archive PR에 묶어 커밋
4. 예상 비용: Phase당 **$0.15–2** (변경 MD 분량 비례, 코드 변경은 AST라 토큰 0)

**Why:** `graphify.watch._rebuild_code` (pipx venv `graphify/watch.py:46-47`)가 기존 그래프의 `file_type="code"` 노드를 전부 삭제하고 `graphify.extract`로 재생성. 하지만 초기 semantic extraction(Sonnet subagent)이 만든 **확장자 없는 개념 경로 노드**(예: `apps/server/internal/domain/editor`, `packages/shared`, `apps/server/internal/clue/`)는 AST가 실제 파일만 처리해서 복원 불가 → 영구 손실. fresh rebuild `/graphify .`는 Sonnet이 매번 재합성하므로 재현성은 없지만 손실은 방지.

**How to apply:**
- 일상 PR에 `graphify-out/graph.json`·`GRAPH_REPORT.md`·`manifest.json` 변경이 포함되면 **reviewer가 즉시 revert 요구**
- 예외: graphify 툴링 자체 PR (installer/hook/Makefile/CLAUDE.md 변경)
- `make graphify-refresh` 실행은 **Phase archive PR**에 묶어 커밋 (Phase 20 archive 패턴)
- hook 설치 여부는 개인 자유 — 단 결과물 commit 금지는 공통 규칙
