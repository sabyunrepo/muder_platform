---
name: mmp-test-strategy
description: MMP v3 테스트 매트릭스. Go mockgen + testcontainers-go, Frontend Vitest + Testing Library + MSW, E2E Playwright. 75%+ 커버리지, flaky 금지, fixture idempotent. 테스트 작성·리뷰·커버리지 분석 시 트리거.
---

# mmp-test-strategy — 테스트 전략 매트릭스

## 왜
프로젝트 규약은 75%+ Go 커버리지와 근본 원인 수정이다. 테스트 완화·스킵·재시도 우회는 품질 퇴행을 은폐한다. 도구·범위·fixture 규칙을 고정하면 회귀를 빠르게 감지할 수 있다.

## 매트릭스

| 범위 | 도구 | 특징 |
|------|------|------|
| Go 순수 함수 | `testing` + table-driven | 빠름, mockgen 불필요 |
| Go service 구현체 | mockgen + testing | 인터페이스 경계만 mock |
| Go DB 통합 | testcontainers-go (Postgres) | 실제 마이그레이션 적용 |
| Go WS 통합 | testcontainers-go + httptest | envelope round-trip |
| Go asynq 워커 | testcontainers-go (Redis) | 잡 처리 idempotency |
| React 컴포넌트 | Vitest + RTL | user-event 기반 상호작용 |
| React 훅 | Vitest + `renderHook` | MSW로 API stub |
| 프론트 API 모킹 | **MSW만** | fetch/axios 직접 모킹 금지 |
| E2E | Playwright (`apps/web/e2e/`) | 백엔드 없으면 로비 플로우 자동 스킵 |

## 작성 규칙

1. **table-driven Go 테스트**: 케이스 이름 + 입력 + 기대값 슬라이스.
2. **t.Cleanup**: 컨테이너, 임시 파일, 구독은 반드시 cleanup.
3. **컨텍스트 전달**: `context.Context`에 타임아웃 설정.
4. **MSW handler 범위**: 테스트 파일별 local handler 우선, 공용만 `apps/web/src/test/handlers.ts`.
5. **E2E 인증**: `e2e@test.com` / `e2etest1234`. `?token=` 쿼리 파라미터로 WS 연결.
6. **Flaky 판정**: 3회 실행 중 1회 이상 실패 → 동기화 포인트 추가(채널 wait, `waitFor`). 재시도 룹 금지.

## 커버리지
- 전체 Go 패키지 75%+.
- 신규 파일은 해당 라인 85%+ 목표.
- 측정: `go test ./... -coverprofile=cover.out && go tool cover -func=cover.out`.
- 프론트는 정책상 선택적. 라우팅/상태 핵심 훅은 작성.

## 근본 원인 수정 원칙
- "테스트가 느려서" → 의존 줄이기, 컨테이너 재사용, 아니면 레이어 이동.
- "테스트가 가끔 깨짐" → 동기화 버그. 재시도 도입 금지.
- "요구 변경" → 테스트 먼저 바꾸고 구현 반영(TDD 유지).

## 금지
- `t.Skip` 남발. 스킵은 환경 의존성 있을 때만(백엔드 부재 E2E 등).
- `time.Sleep`으로 동기화.
- 전역 mock이 테스트 간 누설.
- 빈 assertion, "no error" 만 확인하는 테스트.

## 체크리스트
- [ ] 도구 선택이 매트릭스와 일치
- [ ] table-driven + t.Cleanup 적용
- [ ] MSW만 사용(프론트 API)
- [ ] 커버리지 측정 후 리포트
- [ ] flaky 없음(3회 연속 pass 확인)
- [ ] E2E는 백엔드 부재 시 스킵 로직 유지
