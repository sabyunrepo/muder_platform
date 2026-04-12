# Persistence

## 저장소 맵

| 데이터 | 저장소 | PR |
|--------|--------|----|
| 게임 세션 | `game_sessions` (기존) | 변경 없음 |
| 게임 스냅샷 | `game_snapshots` (기존) | 변경 없음 |
| 테마 | `themes` (기존) | 변경 없음 |
| 감사 로그 | `audit_events` (신규) | A3 |
| 템플릿 프리셋 | `go:embed` 파일 시스템 | T2 |

## 신규 테이블 — `audit_events`

```sql
CREATE TABLE audit_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  seq BIGINT NOT NULL,
  actor_id UUID,                    -- player UUID or NULL (system)
  action VARCHAR(64) NOT NULL,      -- e.g. 'player.action', 'phase.enter', 'module.panic'
  module_id VARCHAR(128),
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, seq)
);

CREATE INDEX idx_audit_events_session ON audit_events(session_id, seq);
CREATE INDEX idx_audit_events_action ON audit_events(action);
CREATE INDEX idx_audit_events_created ON audit_events(created_at DESC);
```

### 보존 정책
- **기본**: 무제한 (append-only)
- **GDPR 대응 (future)**: 플레이어 삭제 요청 시 해당 session_id 의 actor_id 를 NULL 로 업데이트
- **아카이빙 (future)**: 90 일 이상 된 완료 세션 → cold storage

## 템플릿 저장 — `go:embed`

```go
// apps/server/internal/template/loader.go
package template

import "embed"

//go:embed presets/*/*.json
var presets embed.FS
```

### 디렉터리 구조
```
internal/template/presets/
├── murder_mystery/
│   ├── mm-classic-6p.json
│   ├── mm-expert-8p.json
│   └── mm-quick-4p.json
├── crime_scene/
│   ├── cs-small-3loc.json
│   └── cs-large-5loc.json
├── script_kill/
│   ├── sk-3rounds.json
│   └── sk-5rounds.json
└── jubensha/
    ├── ju-1st-person.json
    └── ju-3rd-person.json
```

### MVP → Future 전환
- **MVP (Phase 9.0)**: embed 만
- **Future**: `templates` 테이블 추가, user-uploaded templates 지원
  ```sql
  CREATE TABLE templates (
    id UUID PRIMARY KEY,
    genre VARCHAR(64) NOT NULL,
    version VARCHAR(32) NOT NULL,
    owner_user_id UUID,
    visibility VARCHAR(16) DEFAULT 'public',
    definition JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  );
  ```
  Loader 는 embed → DB fallback 순서로 조회.

## 스냅샷 — `game_snapshots` 재사용

Phase 9.0 은 기존 테이블 그대로 사용. 변경점:
- `state_json` 컬럼 내 포맷만 `PhaseEngine.GetState()` 결과로 변경
- `PluginStates map[module_id]json.RawMessage` 를 state_json 내에 중첩

기존 migration 없음.

## 테마 — `themes` 재사용

테마는 "특정 template 에 대한 overrides" 로 정의:
```json
{
  "template_id": "mm-classic-6p",
  "overrides": {
    "modules": {
      "cluedist.round": {"rounds": 4},
      "decision.voting": {"type": "majority"}
    },
    "phases": {
      "round1": {"duration": 900}
    }
  }
}
```

Theme 저장 시 validator 는 `template.schema ⊇ overrides` 검증.

기존 migration 없음.
