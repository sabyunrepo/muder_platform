# 라이브러리 선택 + 근거

> 부모: [../design.md](../design.md)

---

## Go 백엔드

### 핵심 (채택 확정)

| 라이브러리 | 용도 | 근거 |
|-----------|------|------|
| `qmuntal/stateless` | 계층형 상태머신 | Go port of .NET Stateless, hierarchical states, guard clauses, entry/exit actions. Phase Engine 핵심 |
| `antonmedv/expr` | 서버 사이드 식 평가 | 타입 안전, 빠름, 템플릿 지원. JSON Logic + 커스텀 함수 결합 가능 |
| `looplab/eventhorizon` | CQRS/ES 레퍼런스 | Full ES toolkit for Go. PG event store 구현 참조. 직접 사용하거나 패턴 차용 |
| `github.com/dop251/goja` | JS 식 엔진 (대안) | Pure Go JS VM. JSON Logic 평가용. expr보다 무겁지만 JSON 호환성 완벽 |

### 검토 중 (Phase 9+)

| 라이브러리 | 용도 | 근거 |
|-----------|------|------|
| `yuin/gopher-lua` | Lua 스크립팅 | Pure Go, no CGo. 고급 제작자 커스텀 로직. 보안 샌드박싱 필요 |
| `hashicorp/go-plugin` | gRPC 플러그인 | Terraform 방식. 현재는 in-process가 적절하지만 미래 분리 필요시 |
| `ThreeDotsLabs/watermill` | Pub/Sub + CQRS | 크로스 서비스 이벤트 분배. 단일 서버에는 과함 |

### 기존 유지

| 라이브러리 | 용도 |
|-----------|------|
| `gorilla/websocket` | WebSocket |
| `jackc/pgx` + `sqlc` | PostgreSQL |
| `redis/go-redis/v9` | Redis |
| `hibiken/asynq` | 비동기 태스크 |
| `rs/zerolog` | 로깅 |
| `prometheus/client_golang` | 메트릭 |
| `livekit/go-sdk` | 음성 채팅 |

---

## React 프론트엔드

### 핵심 (채택 확정)

| 라이브러리 | 용도 | 근거 |
|-----------|------|------|
| `@xyflow/react` (React Flow) | 비주얼 노드 에디터 | 35.9K stars, MIT, Tailwind 지원, 커스텀 노드/엣지, MiniMap, Undo/Redo, SSR |
| `@dagrejs/dagre` | 그래프 자동 배치 (MVP) | 위상 정렬 기반 레이아웃. Phase E+에서 elkjs로 교체 검토 |
| `react-hook-form` + `zod` | 폼 + 검증 | ConfigSchema 기반 자동 폼 생성. Zod가 JSON Schema 호환 |
| `jsonlogic-js` | 클라이언트 규칙 평가 | 서버와 동일한 JSON Logic을 클라이언트에서 미리보기/검증 |

### 검토 중

| 라이브러리 | 용도 | 근거 |
|-----------|------|------|
| `@dagrejs/dagre` vs `elkjs` | 레이아웃 | dagre는 단순, elkjs는 더 강력. MVP는 dagre로 시작 |
| `immer` + `zustand/middleware` | 불변 상태 + 언두 | React Flow 상태 관리. Zustand와 통합 용이 |

### 기존 유지

| 라이브러리 | 용도 |
|-----------|------|
| `zustand` | 상태 관리 |
| `tailwindcss` | 스타일 |
| `lucide-react` | 아이콘 |
| `react-router` | 라우팅 |
| `@tanstack/react-query` | 서버 상태 |

---

## ConfigSchema 포맷 (JSON Schema Draft 2020-12 subset)

ConfigSchema는 **표준 JSON Schema의 subset**을 사용합니다. 에디터는 이를 파싱하여 자동 UI를 생성합니다.

**지원 키워드**: `type`, `properties`, `required`, `enum`, `minimum`, `maximum`, `default`, `description`, `items`, `$ref`

**미지원**: `allOf`, `oneOf`, `anyOf`, `not`, `patternProperties`, `dependencies` (복잡도 제어)

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
        "boardType": {
            "type": "string",
            "enum": ["floor", "room", "map"],
            "description": "탐색 방식"
        },
        "explorationRounds": {
            "type": "integer",
            "minimum": 1,
            "maximum": 10,
            "default": 3,
            "description": "탐색 라운드 수"
        },
        "tradeEnabled": {
            "type": "boolean",
            "default": true
        }
    },
    "required": ["boardType", "explorationRounds"]
}
```

클라이언트는 `ajv` 또는 `zod`로 검증, 서버는 `antonmedv/expr`로 평가합니다.

---

## 룰 엔진 분담

| 용도 | 엔진 | 이유 |
|------|------|------|
| 제작자 정의 규칙 (에디터에서 편집) | **JSON Logic** | JSON 직렬화, 프론트엔드 미리보기, 언어 비종속 |
| 서버 내부 규칙 (성능 크리티컬) | **antonmedv/expr** | Go 네이티브, 타입 안전, 빠른 평가 |

---

## JSON Logic 규칙 예시

```json
// 단서 공개 조건
{"and": [
    {">": [{"var": "phase.round"}, 2]},
    {"==": [{"var": "players.0.status"}, "alive"]}
]}

// 승리 조건: 모든 생존자가 핵심 단서를 보유
{"every": [
    {"var": "alivePlayers"},
    {"in": [{"var": "clue.id"}, ["clue_weapon", "clue_motive", "clue_opportunity"]]}
]}

// 페이즈 전환 조건: 과반수 투표 완료 또는 타이머 만료
{"or": [
    {">": [{"var": "votes.count"}, [{"var": "votes.total"}, "/", 2]]},
    {"==": [{"var": "phase.timer.remaining"}, 0]}
]}
```
