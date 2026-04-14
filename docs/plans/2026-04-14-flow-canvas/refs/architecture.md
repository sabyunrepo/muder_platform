# Phase 15.0 — 아키텍처: 노드/엣지/조건 데이터 모델

---

## DB 스키마

### flow_nodes

```sql
CREATE TABLE flow_nodes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('start','phase','branch','ending')),
  data        JSONB NOT NULL DEFAULT '{}',
  position_x  FLOAT NOT NULL DEFAULT 0,
  position_y  FLOAT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flow_nodes_theme ON flow_nodes(theme_id);
```

### flow_edges

```sql
CREATE TABLE flow_edges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id    UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
  source_id   UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  target_id   UUID NOT NULL REFERENCES flow_nodes(id) ON DELETE CASCADE,
  condition   JSONB,
  label       TEXT,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_flow_edges_theme ON flow_edges(theme_id);
```

---

## 노드 data JSONB 구조 (타입별)

### start
```json
{}
```

### phase
```json
{
  "phase_type": "investigation",
  "label": "조사",
  "duration": 20,
  "rounds": 1
}
```

### branch
```json
{
  "label": "투표 결과 분기",
  "default_edge_id": "uuid"
}
```

### ending
```json
{
  "label": "진범 검거 엔딩",
  "description": "시민팀 승리",
  "score_multiplier": 1.5
}
```

---

## 조건 (edge.condition) JSONB 구조

```json
{
  "operator": "AND",
  "rules": [
    {
      "variable": "mission_status",
      "target_character_id": "uuid",
      "target_mission_id": "uuid",
      "comparator": "=",
      "value": "success"
    },
    {
      "variable": "character_alive",
      "target_character_id": "uuid",
      "comparator": "=",
      "value": "alive"
    },
    {
      "operator": "OR",
      "rules": [
        {
          "variable": "vote_target",
          "comparator": "=",
          "value": "criminal"
        },
        {
          "variable": "clue_held",
          "target_character_id": "uuid",
          "target_clue_id": "uuid",
          "comparator": "=",
          "value": "true"
        }
      ]
    }
  ]
}
```

---

## 조건 변수 타입

| variable | target 필드 | comparator | value 예시 |
|----------|------------|------------|-----------|
| `mission_status` | character_id + mission_id | `=` | success/failure |
| `character_alive` | character_id | `=` | alive/dead |
| `vote_target` | - | `=` / `!=` | {character_id}/criminal/innocent |
| `clue_held` | character_id + clue_id | `=` | true/false |
| `custom_flag` | key (string) | `=`/`!=`/`>`/`<` | any string |

---

## 프론트엔드 컴포넌트 트리

```
FlowSubTab (리팩터)
├── FlowCanvas (@xyflow/react ReactFlow)
│   ├── StartNode (커스텀)
│   ├── PhaseNode (커스텀) → PhaseNodePanel (사이드)
│   ├── BranchNode (커스텀) → ConditionBuilder (사이드)
│   ├── EndingNode (커스텀) → EndingNodePanel (사이드)
│   └── ConditionEdge (커스텀 엣지 라벨)
├── FlowToolbar (추가 버튼, 미니맵 토글, 줌)
└── NodeDetailPanel (우측 사이드패널, 선택 노드 편집)
```

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | /themes/{id}/flow | 전체 노드+엣지 조회 |
| PUT | /themes/{id}/flow | 벌크 저장 (전체 교체) |
| POST | /themes/{id}/flow/nodes | 노드 생성 |
| PATCH | /themes/{id}/flow/nodes/{nid} | 노드 수정 |
| DELETE | /themes/{id}/flow/nodes/{nid} | 노드 삭제 |
| POST | /themes/{id}/flow/edges | 엣지 생성 |
| PATCH | /themes/{id}/flow/edges/{eid} | 엣지 수정 |
| DELETE | /themes/{id}/flow/edges/{eid} | 엣지 삭제 |
