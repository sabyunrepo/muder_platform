# Phase 18.8 — E2E Skip Recovery 설계 (index)

> **상태**: 확정
> **시작**: 2026-04-16
> **다음 단계**: plan.md → wave 기반 실행
> **상위 참조**: Phase 18.6 (E2E Recovery) + Phase 18.7 (CI Hardening)
> **MD 200줄 제한**: 모든 문서 <200줄. 상세는 `refs/` 분할.

---

## 목적

현재 E2E 테스트는 `4 pass / 11 skip / 0 fail`. skip 11건은 세 뿌리에서 비롯됨: (1) H7 `MaxPlayers` 계약 drift로 `createRoom` 400 실패, (2) `PLAYWRIGHT_BACKEND` env gate로 live spec 3종 전체 skip, (3) single-context 한계로 멀티플레이 시나리오 미검증. 이 Phase는 세 원인을 전부 해소해 `game_runtime_v2` 런타임 전반에 회귀 방지망을 깐다.

---

## Scope

| 카테고리 | 항목 |
|---------|------|
| Backend | `CreateRoomRequest.MaxPlayers` optional + theme fallback |
| E2E 인프라 | MSW v2 foundation + Playwright fixtures + common helpers |
| 멀티플레이 | `createPartyOfN` 4-context helper + Investigation 단서 수신 검증 |
| Stub 복제 | `game-redaction-stubbed`, `clue-relation-stubbed` 신규 spec |
| CI | real-backend main push post-merge gate (알림 전용) + `workflow_dispatch` |

**Out of scope**: Voting/엔딩 페이즈 커버리지 (Phase 19), real-backend required 승격 (Phase 18.9), MSW-Storybook 공유.

상세는 [refs/scope-and-decisions.md](refs/scope-and-decisions.md).

---

## 7대 결정 (변경 금지)

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | Scope | C (최대) | H7+live 3종+multi-context+CI 승격까지 포함해 회귀망 두텁게 |
| 2 | H7 아키텍처 | 서버 optional + theme fallback | FE는 이미 `theme_id`만 전송 — 서버 변경이 계약의 진실 |
| 3 | Multi-user lifecycle | P1 단일 테스트 N-context | pw.dev 권장 패턴, flaky 위험 예측 가능 |
| 4 | Stub 기술 | 혼합 (HTTP MSW + WS page.route) | HTTP SSOT로 drift 방지, WS는 Playwright 안정성 우선 |
| 5 | Persistence | e2e-themes.sql 기존 4인 테마 재사용 | 별도 seed 추가 불필요 |
| 6 | 운영 안전성 | 점진적 CI gate (관측 → 3일 green → required) | 베타 단계 flaky 리스크 완화 |
| 7 | 도입 전략 | 3 Wave / 5 PR / worktree 병렬 | W1 foundation → W2 stub → W3 CI |

상세는 [refs/scope-and-decisions.md](refs/scope-and-decisions.md).

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/scope-and-decisions.md](refs/scope-and-decisions.md) | 7대 결정 상세 + 옵션 분석 |
| [refs/architecture.md](refs/architecture.md) | 컴포넌트 + MSW/page.route 경계 |
| [refs/execution-model.md](refs/execution-model.md) | **Wave DAG + 파일 구조 설계** |
| [refs/observability-testing.md](refs/observability-testing.md) | 검증 시나리오 + 메트릭 + flaky 가드 |
| refs/pr-1-maxplayers-optional.md | PR-1 상세 |
| refs/pr-2-msw-party-helper.md | PR-2 상세 |
| refs/pr-3-redaction-stubbed.md | PR-3 상세 |
| refs/pr-4-clue-relation-stubbed.md | PR-4 상세 |
| refs/pr-5-ci-promotion.md | PR-5 상세 |

---

## 전체 구조 요약

```
E2E stubbed CI (PR + main)      E2E real-backend (nightly + main post-merge)
  ├─ MSW handlers (HTTP SSOT)     ├─ docker-compose backend
  ├─ page.route (WS)              ├─ seed user + theme
  ├─ common helpers               └─ game-session-live + webkit
  │   ├─ login()
  │   ├─ createRoom()
  │   └─ createPartyOfN(n=4)
  └─ stubbed specs
      ├─ game-redaction-stubbed
      └─ clue-relation-stubbed
```

---

## 실행 전략 요약

| Wave | PRs | 모드 | 의존 |
|------|-----|------|------|
| W1 | PR-1, PR-2 | parallel | - |
| W2 | PR-3, PR-4 | parallel | W1 |
| W3 | PR-5 | sequential | W2 |

상세는 [refs/execution-model.md](refs/execution-model.md).

**속도 이득**: 순차 5T → 병렬 3T (40% 단축)

---

## 종료 조건

- [ ] 5개 PR main 머지 (3 waves 완료)
- [ ] E2E stubbed CI: `13+ pass / ≤3 skip / 0 fail`
- [ ] 4인 party flow Investigation 단서 수신까지 검증
- [ ] real-backend workflow main push 트리거 + 알림 채널 도달 확인
- [ ] 3일 연속 nightly green 관측
- [ ] `memory/project_phase188_progress.md` 최종 갱신
- [ ] `MEMORY.md` 인덱스 업데이트

---

## 다음 단계

1. plan.md 작성 완료 — PR별 task breakdown 위치 `refs/pr-N-*.md`
2. checklist.md 작성 완료 — STATUS 마커 포함
3. `/plan-start docs/plans/2026-04-16-e2e-skip-recovery` 실행
4. `/plan-go` 실행 → Wave 1부터 자동 진행
