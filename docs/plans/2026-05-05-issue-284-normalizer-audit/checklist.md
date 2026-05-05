# #284 Legacy Normalizer 제거 조건 검증 Checklist

## 범위

- Issue: #284
- PR 성격: cleanup/migration planning
- 구현 제외: `NormalizeConfigJSON` 실제 제거, 운영 DB destructive query, 사용자 승인 없는 data rewrite

## 확인 결과

- [x] `NormalizeConfigJSON` 호출 경로 확인
- [x] `validateConfigShape` write rejection 경계 확인
- [x] 로컬 seed/mock/preset 비테스트 fixture scan
- [x] normalizer 제거 가능/불가 판단 문서화
- [x] 운영 DB read-only scan 쿼리 초안 작성
- [x] legacy read telemetry 후속 이슈 분리

## 검증 명령

```bash
rg -n '"clue_placement"|"module_configs"|"character_clues"|"modules"\s*:\s*\[|"clueIds"' \
  apps/server/db/seed apps/web/src/mocks apps/web/src/features/editor \
  --glob '!**/__tests__/**' -S
```

결과: 비테스트 seed/mock/fixture에서 legacy key 발견 없음.

```bash
rg -n 'NormalizeConfigJSON|validateConfigShape|hasLegacyKeys' apps/server/internal/domain/editor -S
```

결과: read path는 `GetTheme` normalizer, write path는 config shape rejection으로 분리됨.

## 판단

- [x] 지금 제거 불가: 운영 DB 확인과 legacy read telemetry가 없다.
- [x] 후속 구현 필요: telemetry + read-only DB 검증 + 제거 전 조건 gate.
- [x] 후속 이슈 번호 기록: #368

## PR 전 검증

- [ ] `git diff --check`
- [ ] docs-only scope 확인: `scripts/mmp-pr-ci-scope.sh <PR>`
