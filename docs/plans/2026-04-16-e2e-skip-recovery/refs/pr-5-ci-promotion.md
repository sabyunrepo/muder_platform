# PR-5 — ci(e2e): real-backend main push + workflow_dispatch

> 부모: [../plan.md](../plan.md)
> Wave: 3 (sequential) | 의존: PR-3, PR-4 | 브랜치: `ci/e2e-real-backend-gate`

---

## 목적

`phase-18.1-real-backend.yml`을 `main` push에 post-merge 관측 모드로 연결 (required 아님) + `e2e-stubbed.yml`에 `workflow_dispatch` 추가. 3일 연속 green 달성 시 Phase 18.9에서 required로 승격하는 **점진적 승격 패턴**의 1단계.

---

## Scope

```yaml
scope_globs:
  - .github/workflows/phase-18.1-real-backend.yml
  - .github/workflows/e2e-stubbed.yml
  - docs/plans/2026-04-16-e2e-skip-recovery/refs/ci-promotion.md
```

---

## Tasks

### Task 1 — real-backend trigger 확장
- `phase-18.1-real-backend.yml:8-18` 트리거 블록:
  ```yaml
  on:
    schedule:
      - cron: "0 2 * * *"
    push:
      branches: [main]
    workflow_dispatch:
  ```
- 기존 schedule·workflow_dispatch 유지

### Task 2 — 알림 step 추가
- job 마지막에 failure 조건부 step:
  ```yaml
  - name: Notify staging channel on failure
    if: failure() && (github.event_name == 'push' || github.event_name == 'schedule')
    uses: slackapi/slack-github-action@<SHA>
    with:
      channel-id: ${{ secrets.E2E_STAGING_CHANNEL }}
      slack-message: "real-backend E2E failed on ${{ github.sha }}"
  ```
- Discord 대체도 허용 (사용자 선호)
- **required 체크 아님** — main에 failing run 남아도 merge 차단 X

### Task 3 — e2e-stubbed dispatch
- `e2e-stubbed.yml:16-20` 트리거에 `workflow_dispatch` 추가
- PR에서 필요 시 수동으로 stubbed CI 재실행 가능

### Task 4 — ci-promotion.md 문서화
- `refs/ci-promotion.md` 신규:
  - 3일 green 관측 조건
  - Phase 18.9에서 수행할 후속 작업 (branch protection 설정, required 승격)
  - 알림 채널 staging → main 이관 타이밍

---

## 핵심 파일 참조

| 파일 | 역할 |
|------|------|
| `phase-18.1-real-backend.yml:8-18` | 기존 trigger 블록 |
| `e2e-stubbed.yml:16-20` | 기존 PR CI trigger |
| GitHub docs: branch protection | 후속 PR 참조 |

---

## 검증

- PR 머지 후 main에 커밋 push → real-backend workflow `Actions` 탭에서 자동 실행 확인
- 의도적 failing 커밋(예: 임시로 Playwright 1건 `expect(false)`) push → 알림 staging 채널 도달 확인 → revert
- `e2e-stubbed.yml`을 PR에서 workflow_dispatch 버튼으로 수동 실행 가능 확인
- 기존 nightly schedule은 변경 없이 동작

---

## 리뷰 포인트

- action SHA pinning 준수 (Phase 18.7 규약)
- `if: failure()` 조건이 success 케이스 알림 누락 방지
- required 아님을 명시적으로 기록 (branch protection 변경 없음)
- 알림 spam 방지: staging 채널 사용
- secrets: `E2E_STAGING_CHANNEL` 저장소 secret에 추가 필요 (사용자 수동 작업)

---

## 완료 후 관측 단계 (Phase 종료 조건)

- main push trigger 3회 이상 성공
- nightly 3회 연속 green
- 실패 알림 도달 1회 이상 관측 (의도적 테스트 또는 자연 발생)
- 이상 확인 시 `/plan-finish` 실행 → Phase 18.9 예약
