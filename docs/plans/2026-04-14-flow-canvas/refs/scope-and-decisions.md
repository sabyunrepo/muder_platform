# Phase 15.0 — Scope & 7대 결정 상세

---

## 1. Scope: C안 (풀 엔딩 에디터)

**In**: React Flow 캔버스 + Phase/Branch/Ending 노드 + 조건 규칙 빌더 + DB 확장 + 마이그레이션
**Out**: 런타임 분기 평가 엔진, AI 시나리오, 멀티플레이어 실시간 흐름 동기화

캔버스만 도입(B안)은 분기 없이 시각적 개선만이라 ROI 낮음.
DB 없이 config_json(A안)은 그래프 쿼리/검증 어려움.

---

## 2. Architecture: @xyflow/react v12 + Go API

React Flow(구 reactflow)의 최신 v12. MIT 라이선스.
- 커스텀 노드/엣지 지원
- 내장 미니맵, 컨트롤, 배경 그리드
- zustand 기반 내부 상태 (프로젝트 Zustand과 호환)

Go 백엔드: 기존 Handler→Service→Repository 계층 유지.

---

## 3. Lifecycle: flow_nodes/edges CRUD

| 작업 | API |
|------|-----|
| 노드 생성 | POST /themes/{id}/flow/nodes |
| 노드 수정 | PATCH /themes/{id}/flow/nodes/{nodeId} |
| 노드 삭제 | DELETE /themes/{id}/flow/nodes/{nodeId} |
| 엣지 생성 | POST /themes/{id}/flow/edges |
| 엣지 수정 | PATCH /themes/{id}/flow/edges/{edgeId} |
| 엣지 삭제 | DELETE /themes/{id}/flow/edges/{edgeId} |
| 전체 조회 | GET /themes/{id}/flow |
| 벌크 저장 | PUT /themes/{id}/flow (전체 교체) |

벌크 저장: 캔버스 변경 시 debounce → 전체 노드+엣지 PUT.
개별 CRUD: 노드 추가/삭제 시 즉시 반영.

---

## 4. External Interface: REST API 신규

기존 API와 동일한 인증 패턴 (JWT Bearer).
`/themes/{id}/flow` 프리픽스로 네임스페이스 분리.

---

## 5. Persistence: DB 확장

`config_json.phases` → `flow_nodes` + `flow_edges` 정규 테이블.
- 장점: 인덱싱, 외래키 검증, 개별 노드 쿼리
- 단점: 마이그레이션 필요, 스키마 변경

마이그레이션 전략: 기존 phases 배열 → 선형 노드+엣지 자동 변환.

---

## 6. 운영 안전성

- DB 마이그레이션: up/down 지원
- Feature flag: `flow_canvas_enabled` (default off → PR-7에서 on)
- 기존 PhaseTimeline: flag off 동안 유지 (폴백)
- 테스트: Go 단위 75%+, 프론트 컴포넌트 테스트, E2E 플로우

---

## 7. 도입 전략: 4 Wave + feature flag

W1-W2: 기반 (DB+API+캔버스+노드) — flag off 상태
W3: 엔딩+조건 빌더 — flag off 상태
W4: 마이그레이션+통합 — flag on 전환, PhaseTimeline 제거
