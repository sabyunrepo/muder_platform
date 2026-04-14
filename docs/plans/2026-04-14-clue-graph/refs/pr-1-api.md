# PR-1: 단서 관계 API

> Wave 1 | 의존: 없음 | Branch: `feat/phase-17.5/PR-1`

## 목표

`internal/clue/graph.go`의 Graph primitive를 HTTP API로 노출.
단서 간 의존 관계를 CRUD하고, 저장 전 cycle 검증.

## 수정 대상

| 파일 | 변경 |
|------|------|
| 신규 `db/migrations/NNNN_clue_relations.sql` | 테이블 생성 |
| 신규 `db/query/clue_relation.sql` | sqlc 쿼리 |
| 신규 `internal/repository/clue_relation.go` | Repository |
| 신규 `internal/service/clue_relation_service.go` | Service (graph 검증 포함) |
| 신규 `internal/handler/clue_relation_handler.go` | GET/PUT 핸들러 |
| 수정 `cmd/server/routes.go` | 라우트 등록 |

## Tasks

### Task 1: DB 마이그레이션
- `clue_relations` 테이블 (id, theme_id, source_id, target_id, mode)
- UNIQUE(theme_id, source_id, target_id) 제약
- FK → themes, clues (CASCADE DELETE)

### Task 2: sqlc + Repository
- ListByTheme(themeId) → []ClueRelation
- ReplaceAll(themeId, []ClueRelation) → 트랜잭션 (DELETE + INSERT)
- sqlc.yaml에 쿼리 등록

### Task 3: Service + Handler
- `ClueRelationService.Get(themeId)` → []ClueRelation
- `ClueRelationService.Replace(themeId, relations)`:
  1. 단서 존재 확인 (FK로 보장되지만 명시 체크)
  2. `clue.NewGraph()` 빌드 → `graph.Validate()` cycle 검증
  3. 실패 시 `AppError(400, "CYCLE_DETECTED")`
  4. 성공 시 Repository.ReplaceAll
- Handler: GET/PUT /v1/editor/themes/:id/clue-relations

### Task 4: Go 테스트
- cycle 감지 → 400 응답
- 정상 저장 → 200 응답
- 단서 삭제 시 cascade 확인

## 검증
- [ ] `go build ./...` clean
- [ ] `go test -race ./...` pass
- [ ] curl로 API 동작 확인
