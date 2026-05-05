# #284 Legacy Normalizer 제거 조건 검증

## 결론

`NormalizeConfigJSON`은 아직 제거하지 않는다.

로컬 코드와 fixture 기준으로는 새 write path가 legacy config shape를 거부하고, seed/mock의 운영성 데이터도 canonical shape로 보인다. 하지만 운영 DB의 기존 `theme.config_json` 전체가 canonical인지 확인한 근거가 없고, legacy read가 실제로 0건인지 관찰하는 telemetry도 없다. 따라서 지금 제거하면 오래된 테마를 여는 순간 `/editor/:id` read path가 깨질 수 있다.

## 현재 안전장치

- Read path: `apps/server/internal/domain/editor/themes.go`의 `GetTheme`가 `NormalizeConfigJSON`을 호출해 오래된 `config_json`을 canonical shape로 변환한다.
- Write path: `apps/server/internal/domain/editor/service_config.go`의 `validateConfigShape`가 legacy write를 거부한다.
- 테스트: `apps/server/internal/domain/editor/config_normalizer_test.go`가 modules array, `module_configs`, `clue_placement`, `locations[].clueIds`, `character_clues`, double-pass idempotence를 검증한다.
- 로컬 fixture scan: `apps/server/db/seed`, `apps/web/src/mocks`, `apps/web/src/features/editor`의 비테스트 파일에서는 legacy key가 발견되지 않았다.

## Legacy Shape 목록

- `modules` array: `["voting"]` 또는 `[{ "id": "voting" }]`
- top-level `module_configs`
- top-level `clue_placement`
- `locations[].clueIds`
- top-level `character_clues`

## 제거 가능 근거

- 신규 저장 API는 legacy shape를 거부한다.
- 로컬 seed/mock/preset 계열 비테스트 파일에서는 legacy shape가 없다.
- normalizer는 already-normalized JSON에 대해 `hasLegacyKeys` + `json.Valid` fast path로 대부분의 read 비용을 피한다.

## 제거 불가 근거

- 운영 DB에 과거 테마가 남아 있는지 확인되지 않았다.
- legacy read telemetry가 없어 실제 사용 중인 legacy theme 수를 알 수 없다.
- normalizer 제거 시 장애 증상은 “오래된 테마를 열 때 설정/단서/시작 단서가 사라지거나 editor load가 실패”하는 형태다.
- rollback하려면 제거 PR 되돌리기뿐 아니라 이미 canonical rewrite를 수행했는지 여부까지 확인해야 한다.

## 운영 DB 검증 쿼리 초안

읽기 전용으로만 실행한다.

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

정확한 판정은 JSONPath 기반 쿼리나 애플리케이션 스캔으로 보강한다. 위 쿼리는 빠른 1차 위험 탐지용이다.

## Telemetry 제안

`NormalizeConfigJSON`이 legacy key를 감지했을 때 아래 정보를 구조화 로그 또는 metric으로 남긴다.

- `theme_id`
- legacy axis: `modules_array`, `module_configs`, `clue_placement`, `locations_clueIds`, `character_clues`
- creator/admin 요청 여부
- normalizer 성공/실패

관찰 기간은 최소 2주 또는 운영 테마 전체 1회 read sweep 완료까지로 둔다. 이 기간 동안 legacy read가 0이고 운영 DB 스캔도 0이면 제거 PR을 만든다.

## 제거 전 절차

1. 운영 DB read-only scan을 실행해 legacy count를 확인한다.
2. legacy count가 0이 아니면 canonical rewrite migration 계획과 backup/rollback 절차를 별도 승인받는다.
3. telemetry를 2주 이상 관찰하거나 전체 테마 read sweep을 완료한다.
4. legacy read가 0이면 `NormalizeConfigJSON` 제거 PR을 만든다.
5. 제거 PR에서는 `GetTheme` read path, normalizer tests, frontend legacy read helper를 함께 정리한다.

## 후속 이슈

이번 이슈에서 normalizer 제거는 하지 않는다. 대신 legacy read telemetry와 운영 DB 검증 절차를 [#368](https://github.com/sabyunrepo/muder_platform/issues/368)로 분리한다.
