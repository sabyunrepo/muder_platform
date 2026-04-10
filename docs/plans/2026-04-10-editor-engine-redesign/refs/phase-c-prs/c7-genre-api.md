# PR C-7: Theme API Genre/Preset 확장 (백엔드)

> Phase C | 의존: 없음 | Wave: W1 (C-1~C-6과 병렬)

---

## 목표
장르 목록 + 프리셋 API. ConfigSchema를 서버에서 관리.
GenrePlugin이 `ConfigSchema()` 메서드로 제공.

## 변경 파일

**신규 (Backend)**
```
apps/server/internal/domain/editor/
  genre_handler.go               # GET /genres, GET /genres/{id}/presets
  genre_types.go                 # GenreInfo, GenrePreset types
  genre_service.go               # 장르/프리셋 조회 로직
```

**수정 (Backend)**
```
apps/server/internal/domain/editor/
  handler.go                     # Router에 genre routes
```

## DB (신규)

```sql
CREATE TABLE genre_presets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    genre_id VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    config_defaults JSONB NOT NULL DEFAULT '{}',
    phase_template JSONB NOT NULL DEFAULT '[]',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(genre_id, name)
);
CREATE INDEX idx_genre_presets_genre ON genre_presets(genre_id);
```

## API 엔드포인트

| Method | Path | Response | 설명 |
|--------|------|----------|------|
| GET | `/v1/editor/genres` | `GenreInfo[]` | 4장르 + ConfigSchema |
| GET | `/v1/editor/genres/{id}/presets` | `GenrePreset[]` | 장르별 프리셋 |

## GenreInfo Response

```json
{
  "id": "murder_mystery",
  "name": "머더미스터리 파티",
  "description": "라운드제 단서 배포 + 최종 투표",
  "icon": "Skull",
  "default_players": { "min": 4, "max": 12 },
  "default_duration": 90,
  "config_schema": {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "type": "object",
    "properties": {
      "totalRounds": { "type": "integer", "minimum": 1, "maximum": 5 },
      "voteType": { "type": "string", "enum": ["public", "secret", "sequential"] }
    },
    "required": ["totalRounds"]
  }
}
```

## ConfigSchema 관리 방식

- ConfigSchema는 Go 코드에 하드코딩 (장르당 1개)
- GenrePlugin이 `ConfigSchema() json.RawMessage` 메서드로 제공
- 프리셋의 `config_defaults`가 기본값

## 테스트

- `genre_handler_test.go`: GET /genres 200, GET /genres/{id}/presets 200/404
- ConfigSchema 유효성: 모든 장르 schema가 JSON Schema Draft 2020-12 subset
