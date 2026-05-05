# #368 Legacy Config Read-Only 검증 절차

## 목적

`NormalizeConfigJSON` 제거 전 운영 DB와 실제 read path에서 legacy config shape가 0건인지 확인한다.

## 제거 Gate

Normalizer 제거 PR은 아래 조건을 모두 만족한 뒤에만 만든다.

- 운영 DB read-only scan 결과 legacy count 0
- 최소 2주 또는 전체 테마 read sweep 동안 `editor config_json legacy shape normalized on read` 로그 0건
- legacy count가 0이 아닐 경우 canonical rewrite, backup, rollback 절차가 별도 승인됨

## Read-Only Scan 초안

아래 쿼리는 변경을 수행하지 않는다. 1차 위험 탐지용이며, 정확한 마이그레이션 전에는 JSONPath 기반 검증이나 애플리케이션 스캔으로 보강한다.

```sql
select
  count(*) filter (where config_json::text like '%"clue_placement"%') as clue_placement_count,
  count(*) filter (where config_json::text like '%"module_configs"%') as module_configs_count,
  count(*) filter (where config_json::text like '%"character_clues"%') as character_clues_count,
  count(*) filter (where config_json::text ~ '"modules"\\s*:\\s*\\[') as modules_array_count,
  count(*) filter (
    where config_json::text like '%"clueIds"%'
      and config_json::text not like '%"locationClueConfig"%'
  ) as dead_location_clue_ids_count
from themes;
```

## Runtime Log

`GetTheme` read path에서 legacy axis가 감지되면 아래 구조화 로그가 남는다.

- message: `editor config_json legacy shape normalized on read`
- fields:
  - `theme_id`
  - `legacy_axes`: `modules_array`, `module_configs`, `clue_placement`, `locations_clueIds`, `character_clues`

로그에는 raw `config_json`, clue id, character id, creator-authored text를 남기지 않는다.

## Legacy Count가 0이 아닐 때

1. affected theme id 목록을 read-only로 추출한다.
2. theme별 backup 절차를 먼저 확정한다.
3. canonical rewrite migration 또는 admin-only repair job을 별도 PR로 만든다.
4. rewrite 후 scan count 0과 runtime legacy read 0을 다시 확인한다.
