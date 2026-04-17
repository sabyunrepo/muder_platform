# Scope Matrix — 관점 primary

> W1에서 docs-navigator가 최종 확정. 현재는 초안.
> **파일 경로는 hint, 관점이 primary.** 타 영역 이슈는 `[cross:area]` 태그로 패스.

## 매트릭스

| # | 영역 | Primary 관점 | 1차 파일군 (hint) | 금지 (타 영역 몫) |
|---|------|-------------|-----------------|-----------------|
| 01 | go-backend | 계층 경계(Handler→Service→Repo), AppError, DI 일관성, 파일 500줄/함수 80줄 리밋 | `apps/server/internal/**` 전계층 | WS 스키마(09), 성능(06), 보안(05) |
| 02 | react-frontend | Zustand 3-layer 경계, 컴포넌트 경계, lazy routing, 파일 400줄/컴포넌트 150 리밋 | `apps/web/src/{stores,features,pages,hooks}/**` | WCAG(07), WS 재접속(09) |
| 03 | module-architect | BaseModule/Factory/PhaseReactor/ConfigSchema 준수, 세션 인스턴스 독립성 | `apps/server/internal/module/**`, `apps/server/internal/engine/**` | 파일 크기 리밋(01) |
| 04 | test-engineer | 커버리지 %, skip 목록, flaky, fixture idempotent | `apps/server/**/*_test.go`, `apps/web/{src,e2e}/**/*.{test,spec}.{ts,tsx}` | 각 도메인 미구현 테스트는 해당 영역 Proposal로 반환 |
| 05 | security | OWASP Top 10, AppError+RFC 9457, WS 토큰 노출, auditlog, snapshot redaction, CVE | `apps/server/internal/{apperror,middleware,auditlog}/**`, `go.mod`, `pnpm-lock.yaml` | zerolog 효율(06), WCAG(07) |
| 06 | perf-observability | sqlc N+1, EventBus fan-out, zerolog S/N, OTel hook, pprof, goroutine leak | `apps/server/internal/{ws,eventbus,infra}/**`, `apps/web/src/stores/**` | 계층 경계(01) |
| 07 | design-a11y | Seed Token 커버리지, 네이티브 HTML 잔재, WCAG 2.1 AA, dark token, i18n 하드코딩 | `apps/web/src/{components,pages}/**/*.tsx`, CSS | Zustand(02) |
| 08 | docs-navigator | QMD coverage, 설계-구현 drift, stale .md, Phase 후속 누락 | `docs/plans/**`, `memory/**`, `README.md` | 구체 코드 조치 |
| 09 | ws-contract (공동) | envelope_catalog ↔ MSW ↔ reducer 3자 drift, rollback, snapshot resume, 순서 보장 | `apps/server/internal/ws/**`, `apps/web/src/mocks/handlers/**`, `apps/web/src/services/*MessageHandlers.ts` | (backend+frontend 공동) |

## Finding 태그 규칙

- 모든 Finding은 `F-{area}-{N}` ID + `[area:{area}]` 태그.
- 다른 영역 이슈 발견 시 `[cross:{target-area}]` 태그 + **해당 영역 draft로 포워딩 메모**만 남기고 본인은 분석 금지.
- 교차 영역이 3개 이상이면 advisor가 W3a에서 cross-cutting 이슈로 승격.

## 파일 중복 처리
같은 파일(예: `apps/server/internal/ws/hub.go`)을 여러 영역이 볼 수 있다. 각자 primary 관점에서만 읽고, 파일이 드러내는 다른 signal은 태그만 남긴다.

예시:
- go-backend: "hub.go: Service 계층 없이 DB 직접 접근" → 01 Finding
- security: "hub.go: 토큰 로그 출력" → 05 Finding
- perf: "hub.go: broadcast O(N) loop" → 06 Finding
- **9개 영역이 동일 파일을 9번 스캔해도 관점만 다르면 중복 아님.**

## 제외 (감사 범위 밖)
- `apps/mobile/**` (Expo, 이번 감사 제외)
- `infra/`, `docker/`, `deploy/` (W1에서 필요 시 docs-navigator가 별도 flag)
- 자동 생성 코드 (sqlc gen, `*.pb.go`, `vite-env.d.ts`)
- 테스트 fixture 데이터 파일

## W1 확정 절차
1. docs-navigator가 실제 파일 트리 확인 후 1차 파일군(hint) 수정
2. `baseline.md` 측정값 기반으로 금지 항목 구체화
3. 매트릭스 승인 후 W2 executor에게 배포
