# #368 Legacy Normalizer Telemetry Checklist

## 범위

- Issue: #368
- 목적: normalizer 제거 전 관찰 근거 확보
- 제외: normalizer 제거, 운영 DB rewrite, destructive query

## 구현

- [x] legacy axis 감지 helper 추가
- [x] `/editor/:id` read path에서 legacy axis 로그 추가
- [x] raw `config_json` 비노출 테스트 추가
- [x] canonical config는 로그를 남기지 않는 테스트 추가
- [x] 운영 DB read-only scan 절차 문서화
- [x] 제거 gate 문서화

## 검증

- [ ] `cd apps/server && go test ./internal/domain/editor -run 'Test(LegacyConfigAxes|LogLegacyConfigRead|Normalize)'`
- [ ] `git diff --check`

## 후속

- [ ] 운영 DB scan 실행은 별도 사용자 승인 후 진행
- [ ] telemetry 관찰 기간 후 legacy read 0이면 normalizer 제거 implementation issue 생성
