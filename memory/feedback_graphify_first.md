---
name: 아키텍처·의존성 질문은 graphify 먼저
description: 코드베이스 구조·의존성·"어디서 쓰이나" 질문은 graphify 지식 그래프를 우선 사용. QMD와 대칭 규칙.
type: feedback
originSessionId: 8288707a-145a-40ec-8b1e-5f6f11a2b6f7
---
**규칙:** `graphify-out/graph.json` 존재 시 아키텍처·의존성·구조 질문은 **반드시 graphify 먼저**. 원시 파일 Grep/Glob 탐색은 graphify로 대상을 특정한 후에만 허용.

**Why:** 2026-04-18 사용자 요청 — QMD가 `docs/plans/`, `memory/` 경로 문서를 강제하듯, graphify도 6700 node / 15398 edge 지식 그래프를 구축한 뒤 "매번 파일을 Grep으로 뒤지지 말고 그래프를 우선 참조"하도록 강제하고자 함. 설계 의도는 Token reduction 17.1x (질문당 ~42K tokens vs ~716K corpus) 효율 활용 + 커뮤니티·god node 구조 먼저 파악 후 세부 탐색.

**How to apply:**
- **우선 graphify 사용 질문 패턴**:
  - "X는 어디서 쓰이나 / 무엇과 연결되나 / 의존성은" → `/graphify query` 또는 `/graphify explain`
  - "A에서 B까지 흐름" → `/graphify path "A" "B"` (홉별 relation + confidence)
  - "god node / bridge / community / 아키텍처" → `Read graphify-out/GRAPH_REPORT.md` 해당 섹션
- **Grep/Glob 허용 케이스**: 파일명·정확한 심볼 탐색, graphify로 대상 특정 후 line-level 확인
- **코드 수정 후**: PostToolUse Hook이 `.needs_update`를 자동 touch → 세션 끝에 `/graphify --update` 필수 (AST-only, LLM 무비용, 수초)
- **전체 재인덱싱 금지**: `graphify .` 전체 재실행은 Sonnet 서브에이전트 42개 필요, 비용 과다. 증분 `--update`만 사용.
- **엣지 신뢰도 존중**: `INFERRED` 엣지는 god node 주변에 과적합 가능성 높음, 인용 시 `EXTRACTED` 우선
- CLAUDE.md `🔴 graphify 필수 사용 규칙` 섹션에 전체 규칙 명시

**대칭 규칙**: QMD(`feedback_qmd_plan_resume.md`, `reference_qmd_setup.md`)는 **문서**에 대한 우선 규칙, graphify는 **코드·의존성**에 대한 우선 규칙. 두 시스템은 스코프가 다르므로 병행 사용.
