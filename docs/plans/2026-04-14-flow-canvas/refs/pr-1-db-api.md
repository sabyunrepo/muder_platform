# PR-1: DB 스키마 + Go Flow API

> Phase 15.0 | Wave 1 | 의존: 없음

---

## 변경 범위

### DB 마이그레이션
- `flow_nodes` 테이블 생성 (id, theme_id, type, data, position_x/y)
- `flow_edges` 테이블 생성 (id, theme_id, source_id, target_id, condition, label)
- 인덱스: theme_id 기준

### sqlc 쿼리
- `queries/flow_nodes.sql`: CRUD + ListByTheme
- `queries/flow_edges.sql`: CRUD + ListByTheme

### Go 코드
- `internal/flow/repository.go`: sqlc 래퍼
- `internal/flow/service.go`: 비즈니스 로직 (DAG 검증, 벌크 저장)
- `internal/flow/handler.go`: HTTP 핸들러
- `internal/flow/models.go`: 도메인 타입

### 라우터
- `/themes/{id}/flow` 경로 등록

---

## Task 목록

1. **DB 마이그레이션 파일 작성** — flow_nodes + flow_edges
2. **sqlc 쿼리 작성** — CRUD + ListByTheme
3. **models.go** — FlowNode, FlowEdge, FlowGraph 타입
4. **repository.go** — sqlc 래퍼
5. **service.go** — GetFlow, SaveFlow, CRUD + DAG 검증
6. **handler.go** — REST 핸들러 8개
7. **라우터 등록** — /themes/{id}/flow/* 마운트
8. **단위 테스트** — service 레이어 테스트

---

## 테스트

- `service_test.go`: DAG 검증, 벌크 저장, 개별 CRUD
- `handler_test.go`: HTTP 상태코드 + 응답 구조
