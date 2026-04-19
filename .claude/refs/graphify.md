# graphify 상세 정책

> CLAUDE.md § graphify 섹션에서 추출. 필요할 때만 Read로 선택 로딩.

## graphify 도구 (CLI)

| 도구 | 속도 | 용도 |
|------|------|------|
| `/graphify query "질문"` | ~즉시 | BFS traversal — "X는 어디서 쓰이나", "A→B 어떻게 연결되나" |
| `/graphify explain "노드"` | ~즉시 | 단일 노드 주변 설명 (god node, community, degree) |
| `/graphify path "A" "B"` | ~즉시 | 두 개념 사이 최단 경로 + 홉마다 relation/confidence |
| `Read graphify-out/GRAPH_REPORT.md` | ~즉시 | god nodes, surprising connections, community 531개 요약 |
| `/graphify --update` | ~빠름 | 변경 파일만 증분 재추출 (AST-only는 LLM 무비용) |
| `/graphify --mcp` | ~상주 | MCP 서버로 agent가 live 질의 |

## 현재 인덱스 상태 (2026-04-18)

- 1098 files · ~537K words → **6700 nodes / 15398 edges / 78 hyperedges / 531 communities**
- Token reduction: **17.1x** (질문당 ~42K 토큰)
- AST 5169 + semantic 1659 (Sonnet 42 subagents 병렬 추출)
- 상위 30 커뮤니티 라벨링됨 (나머지 501개는 `Community N` 기본값)

## 엣지 신뢰도 해석

- `EXTRACTED` (confidence 1.0) — import/call/citation 명시, 코드에 직접 존재
- `INFERRED` (0.6–0.9) — LLM 추론, 검증 필요. god node 대부분 edges는 여기 해당
- `AMBIGUOUS` (0.1–0.3) — 불확실. 질문에 인용 시 주의

## 산출물 위치 (`graphify-out/`)

- `GRAPH_REPORT.md` (156KB) — 감사 보고서 (god nodes, surprises, 커뮤니티, 제안 질문)
- `graph.json` (8.9MB) — 원시 그래프 (nodes/edges/hyperedges 전체)
- `manifest.json` — 증분 업데이트용
- `cache/` — AST/semantic 캐시 (재인덱싱 시 재사용)
- `cost.json` — 토큰 누적

## 🔴 repo graph.json 갱신 정책 (D, 2026-04-18~)

**핵심:**
- **repo의 `graphify-out/graph.json`은 Phase 종료 시점에만 수동 fresh rebuild → PR**
- 일상 자동 재빌드(`post-commit` / `graphify watch` / `graphify update`)는 **개인 로컬 전용**이며 **결과물 repo 커밋 금지**
- **이유:** `graphify.watch._rebuild_code`가 기존 `file_type="code"` 노드를 전부 삭제하고 AST로 재생성 → semantic 추출로 만든 "확장자 없는 개념 경로"(예: `apps/server/internal/domain/editor`, `packages/shared`) 노드 **~6% 영구 손실** (upstream 버그, 2026-04-18 확인)

## 팀 공유 Makefile target

| 커맨드 | 용도 |
|--------|------|
| `make graphify-setup` | clone 직후 1회 — pipx로 CLI만 설치 (**hook 자동 설치 안 함**) |
| `make graphify-install-hooks` | (선택) post-commit/post-checkout hook 설치 — **개인 로컬 전용**, 결과물 커밋 금지 |
| `make graphify-uninstall-hooks` | 기존 hook 제거 |
| `make graphify-watch` | 코드 변경 실시간 감지 + AST 재빌드 (tmux 권장). **결과물 커밋 금지** |
| `make graphify-update` | 변경 코드만 증분 재추출 (수동). **결과물 커밋 금지** |
| `make graphify-refresh` | **Phase 종료 시** Claude Code에서 `/graphify .` 실행 안내 (실제 fresh rebuild는 Claude Code 세션 필요) |

**Phase 종료 fresh rebuild 워크플로우:**
1. `make graphify-refresh` (안내 출력)
2. 새 Claude Code 세션에서 `/graphify .` 실행 — 캐시 적중으로 변경 MD만 재추출 (Phase당 ~$0.15–2)
3. `graph.json` / `GRAPH_REPORT.md` / `manifest.json` 만 PR로 커밋 (`cache/`는 `.gitignore`)

**일반 PR에서 graph.json 변경은 reviewer가 즉시 revert 요구 대상.** 예외는 graphify 툴링 자체 PR.
