# PR-8: 테스트 + QA

> Phase 15.0 | Wave 4 | 의존: PR-7

---

## 변경 범위

### Go 테스트 보강
- `handler_test.go`: 전체 엔드포인트 통합 테스트
- `service_test.go`: DAG 검증 엣지 케이스
- 커버리지 75%+ 확보

### 프론트 테스트 보강
- `FlowCanvas.test.tsx`: 노드 추가/삭제/이동
- `ConditionBuilder.test.tsx`: 복합 조건 시나리오
- 엣지 케이스: 빈 플로우, 순환 감지, 고아 노드

### 수동 QA 시나리오
- 빈 테마에서 새 플로우 생성
- 프리셋 마이그레이션 후 캔버스 확인
- 분기 흐름 생성: Phase→Branch→(조건A→Ending1, 조건B→Ending2)
- 노드 드래그 이동 후 저장 → 새로고침 → 위치 유지
- 모바일 뷰포트 기본 동작

---

## Task 목록

1. **Go 통합 테스트** — 전체 CRUD 시나리오
2. **Go DAG 검증 엣지 케이스** — 순환, 고아, 미연결
3. **프론트 컴포넌트 테스트 보강** — 노드/엣지 CRUD
4. **ConditionBuilder 복합 테스트** — 중첩 AND/OR
5. **수동 QA** — 위 시나리오 5개

---

## 테스트

- Go: `go test -race -cover ./internal/flow/...`
- 프론트: `pnpm vitest run src/features/editor/`
