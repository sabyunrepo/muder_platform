---
name: Phase 15.0 플랜 (React Flow 게임 흐름 에디터)
description: React Flow 캔버스 + 분기/엔딩 노드 + 조건 규칙 빌더 + DB 확장 (8 PR, 4 Wave)
type: project
---
Phase 15.0 설계+계획 완료 — React Flow 게임 흐름 에디터.

**핵심 기능**:
1. @xyflow/react v12 캔버스 (드래그&드롭, 미니맵)
2. 커스텀 노드 4종 (Start/Phase/Branch/Ending)
3. 조건 규칙 빌더 (AND/OR 그룹, 엔티티 지목 변수)
4. DB 확장 (flow_nodes + flow_edges 테이블)
5. config_json.phases → DB 자동 마이그레이션

**8 PR, 4 Wave**:
- W1: PR-1 DB+API | PR-2 캔버스기초 (parallel)
- W2: PR-3 Phase노드 | PR-4 Branch+엣지 (parallel)
- W3: PR-5 Ending | PR-6 조건빌더 (parallel)
- W4: PR-7 마이그레이션 | PR-8 테스트 (sequential)

**플랜 경로**: docs/plans/2026-04-14-flow-canvas/
**커밋**: f2005e5
