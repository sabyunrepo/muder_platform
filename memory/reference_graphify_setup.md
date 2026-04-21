---
name: graphify 지식 그래프 인덱스
description: MMP v3 전체 코드·문서 graphify 인덱스 상태, 도구 사용법, Hook 강제 구조, 산출물 위치
type: reference
---
## 인덱스 상태 (2026-04-18 구축)

- 1098 files · ~537K words → **6700 nodes / 15398 edges / 78 hyperedges / 531 communities**
- Token reduction: **17.1x** (질문당 ~42K 토큰)
- AST 5169 + semantic 1659 (Sonnet 서브에이전트 42개 병렬 추출)
- 상위 30 커뮤니티 라벨링됨 (나머지 501개는 `Community N` 기본값)

### 상위 커뮤니티 (구조 파악용)
- C0: Accusation Module & Tests (610n)
- C1: WebSocket Hub & Messaging (607n)
- C2/C3/C5: Admin Service/Handler/Mock (1120n 합계)
- C6: Server Bootstrap & Adapters (217n)
- C7: Clue Modules (205n)
- C10: Clue Graph & Validation (156n)
- C17/C23: Audio Core/Graph (145n 합계)
- C24: Phase 9.0 Module Engine Redesign (설계 문서)

### God Nodes (중심 추상화)
`New()` 562° · `unlock()` 301° · `Lock` 300° · `newTestDeps()` 275° · `Queries` 242° · `WriteError()` 153° · `Internal()` 146° · `writeJSON()` 119° · `NewHandler()` 118° · `UserIDFrom()` 97°

## 도구 사용법

| 명령 | 용도 |
|------|------|
| `/graphify query "질문"` | BFS traversal, "X는 어디서 쓰이나" |
| `/graphify explain "노드"` | 단일 노드 주변 설명 |
| `/graphify path "A" "B"` | 두 개념 최단 경로 |
| `Read graphify-out/GRAPH_REPORT.md` | god nodes, surprises, 커뮤니티 요약 |
| `/graphify --update` | 변경 파일만 증분 (AST-only, 무비용) |
| `/graphify --mcp` | MCP 서버 상주 |

## 산출물 위치 (`graphify-out/`)

- `GRAPH_REPORT.md` (156KB) — 감사 보고서
- `graph.json` (8.9MB) — 원시 그래프
- `manifest.json` (85KB) — 증분 업데이트용
- `cache/` — AST/semantic 캐시
- `cost.json` — 토큰 누적
- `.needs_update` — Edit/Write 후 자동 touch, `--update` 트리거 flag

## Hook 강제 구조 (`.claude/settings.json`)

- **PreToolUse Glob|Grep**: `graph.json` 존재 시 🔴 리마인더 주입 ("아키텍처·의존성 질문이면 graphify 먼저")
- **PostToolUse Edit|Write**: `.needs_update` 자동 touch (세션 끝 `--update` 트리거용)
- `graph.json` 없으면 hook no-op

## 엣지 신뢰도 해석

- `EXTRACTED` (1.0) — import/call/citation, 코드에 명시
- `INFERRED` (0.6–0.9) — LLM 추론, 검증 필요 (god node 대부분 edges)
- `AMBIGUOUS` (0.1–0.3) — 불확실, 인용 시 주의

## 재인덱싱 시 주의

- **전체 재실행 (`graphify .`)은 비용 과다** — 전체 Sonnet 42 서브에이전트 dispatch 필요
- **증분 `--update`만 사용** — 변경 파일만 재추출, AST-only는 무비용
- 대규모 구조 변화(Phase 완료 등) 후에만 전체 재실행 고려
- 캐시 저장이 source_file=디렉토리 경로인 노드에서 `IsADirectoryError` 발생 — 무시해도 graph.json은 정상
