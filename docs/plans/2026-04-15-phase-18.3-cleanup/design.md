# Phase 18.3 — 보안 하드닝 + CI 인프라 정비 설계 (index)

> **상태**: 확정
> **시작**: 2026-04-15 (Phase 18.2 직후)
> **목적**: Phase 18.0~18.2 누적 잔여 이슈 마무리 — 보안 관련 Medium/Low +
> CI 인프라 부채 + E2E 신뢰도 보강.
> **MD 200줄 제한**: 각 문서 <200줄. 상세는 `refs/` 분할.

---

## 배경

- Phase 18.0 리뷰에서 발견된 Medium 10건 중 M-1/M-3/M-4/M-5/M-6 은 Phase 18.2 에서 처리했지만 **M-7 (recovery path redaction)**, **M-a (start 실패 cleanup)**, **M-e (KindStop vs 엔딩 플로우)** 가 남음.
- Low 8건은 전부 미처리.
- CI 인프라 부채: `config.TestLoad_Defaults` env leak, golangci-lint ↔ Go 1.25, ESLint 9 config — main CI 가 flaky 하게 실패 중.
- Phase 18.1 E2E 는 `PLAYWRIGHT_BACKEND` skip guard 로 CI에서 사실상 전부 스킵 — 신뢰도 낮음.

---

## Scope

| 카테고리 | 항목 | Severity |
|---------|------|----------|
| Security | Recovery path snapshot redaction | M-7 |
| Reliability | startModularGame 실패 시 bus/modules cleanup | M-a |
| Reliability | KindStop 과 엔딩 플로우 상호작용 확인·수정 | M-e |
| Hygiene | persistSnapshot/SendSnapshot ctx parent | L-2 |
| Hygiene | Session snapshot Redis 네임스페이스 (`mmp:session:*`) | L-4 |
| Hygiene | Hub.Stop 동시 writer 경합 | L-5 |
| Hygiene | `recentLeftAt` 선형 스캔 최적화 | L-3 |
| Operability | Panic dump 내부경로 누출 제거 | L-6 |
| Operability | 모듈 에러 메시지 원문 노출 축소 | L-7 |
| Test | E2E auto-skip 의존도 축소 (stubbed backend) | L-8 |
| CI | `config.TestLoad_Defaults` env leak 제거 | CI-1 |
| CI | golangci-lint Go 1.25 호환 | CI-2 |
| CI | ESLint 9 config 정비 | CI-3 |

상세: [refs/findings.md](refs/findings.md), [refs/ci-infra.md](refs/ci-infra.md).

**Out of scope**: Phase 19.0 모바일, 공간 음성, GM 제어판.

---

## 5대 결정

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | 보안 우선순위 | M-7 먼저 (재접속 경로 redaction) | 게임 void 가능성 |
| 2 | Recovery path 접근 | 블롭 자체를 redaction-at-persist 로 변경 | engine 없는 상태에서 재구성 불가 |
| 3 | CI infra 경로 | `config` env leak + linter 2종을 같은 PR 에서 | 상호 의존, 한번에 정리 |
| 4 | E2E 전략 | backend stub 컨테이너 기반 CI job 으로 skip 제거 | 실제 회귀 감지 복원 |
| 5 | 브랜치 | Phase 18.x cleanup 성격 → main 직접 merge | 배포 블로커 아님 |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/findings.md](refs/findings.md) | M-7/a/e + L-2~L-8 상세 + 파일:라인 |
| [refs/ci-infra.md](refs/ci-infra.md) | CI-1/2/3 진단 및 수정 전략 |
| [refs/execution-model.md](refs/execution-model.md) | Wave DAG + 스코프 충돌 분석 |

---

## 실행 전략 요약

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W0 | PR-0, PR-1 | parallel | - |
| W1 | PR-2, PR-3 | parallel | W0 |
| W2 | PR-4 | sequential | W1 |

**속도 이득**: 순차 5T → 3T

---

## 종료 조건

- [ ] M-7 recovery redaction 완료 — 비원인 블롭 전송 경로 없음
- [ ] M-a start 실패 시 누수 0 검증 테스트 통과
- [ ] M-e 엔딩 플로우 → snapshot 의존 여부 명문화 + 수정
- [ ] L-2~L-8 전부 반영 or 이월 설명 문서화
- [ ] `config.TestLoad_Defaults` 클린 env 에서 통과
- [ ] golangci-lint 로컬/CI 둘다 실행
- [ ] ESLint 9 로 `pnpm lint` 정상 작동
- [ ] CI stubbed-backend E2E job 기본 수트 포함
- [ ] `/plan-finish` 실행
