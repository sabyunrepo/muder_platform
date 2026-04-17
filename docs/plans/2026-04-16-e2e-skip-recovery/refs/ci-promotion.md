# CI Promotion Plan — real-backend E2E

> 부모: [pr-5-ci-promotion.md](pr-5-ci-promotion.md)
> 상태: PR-5 머지 후 관측 단계 (Phase 18.8)
> 다음 액션: Phase 18.9 required 승격

---

## 현재 상태 (PR-5 시점)

| 항목 | 값 |
|------|-----|
| 트리거 | nightly cron `0 2 * * *` + `push:[main]` + `workflow_dispatch` |
| Required check | ❌ (관측 only — failing run이 main에 남아도 머지 차단 X) |
| 알림 채널 | staging Slack webhook (`E2E_STAGING_SLACK_WEBHOOK_URL`) |
| 알림 조건 | `push` 또는 `schedule` 트리거 + `failure()` (workflow_dispatch는 noise 방지로 제외) |
| 사용자 수동 작업 | repo Settings → Secrets에 `E2E_STAGING_SLACK_WEBHOOK_URL` 등록 (Discord 사용 시 incoming-webhook 호환 URL) |

---

## 관측 단계 통과 조건

PR-5 머지 후 다음을 모두 만족하면 Phase 18.9 진입:

1. **3일 연속 green** — nightly cron 3회 + main push 트리거 결과 모두 success
2. **알림 도달 1회 이상 검증** — 의도적 failing 커밋(예: `expect(false).toBe(true)` 임시 추가) push → staging 채널 메시지 도달 확인 → revert. 또는 자연 발생 실패 1건으로 갈음
3. **playwright-real-backend-report 아티팩트 다운로드 가능** — failing run에서 trace zip 회수 가능 확인

---

## Phase 18.9 작업 (required 승격)

3일 green 달성 후 별도 PR로 진행. branch protection 변경은 workflow YAML 수정과 분리.

### 9-1. Workflow 변경
- `phase-18.1-real-backend.yml`에서 step `Notify staging channel on failure`의 `secrets.E2E_STAGING_SLACK_WEBHOOK_URL` → `secrets.E2E_MAIN_SLACK_WEBHOOK_URL`로 교체 (또는 staging→main 매핑 secret rename)
- 알림 메시지에 `:rotating_light:` 또는 `@channel` 추가 (main 채널 가시성 향상)

### 9-2. Branch protection 변경 (사용자 수동 작업)
- GitHub UI: `Settings` → `Branches` → `main` rule 편집
- "Require status checks to pass before merging" 체크
- 추가할 check 이름:
  - `Real-Backend E2E Smoke` (workflow `Phase 18.1 — Real-Backend E2E (nightly)`의 job)
- "Require branches to be up to date before merging" 활성화 (선택)
- Save

### 9-3. 회귀 시 절차
- required로 승격 후 push 차단이 자주 발생하면:
  1. branch protection을 임시로 해제 (UI에서 체크 해제)
  2. workflow 안정화 PR 머지
  3. 안정화 후 다시 required 활성화
- Phase 18.7 CI Hardening에서 적용한 `cancel-in-progress` 와 timeout-minutes는 그대로 유지

---

## 알림 채널 운영

### staging (현재 — Phase 18.8)
- 채널 이름 예시: `#e2e-staging` (Slack) 또는 `e2e-staging-alerts` (Discord)
- 권장 구성원: 백엔드 개발자 1-2명 + QA 1명
- 보존: 실패 메시지 90일 (Slack 무료 플랜 한계 고려)

### main (Phase 18.9 후)
- 채널 이름 예시: `#engineering` 또는 `#mmp-alerts`
- 권장 구성원: 전체 엔지니어링 팀
- 메시지 형식에 `🚨` 추가 + run URL + 이전 green commit hash diff 링크

---

## 모니터링 대시보드 (선택, Phase 19+)

- GitHub Actions 워크플로우 실행 통계 → Datadog 또는 Grafana로 export
- nightly success rate 30일 이동 평균 추적
- 실패 원인 카테고리 (flaky / regression / infra) 태깅

---

## 보안 고려사항

- Slack webhook URL은 secret으로만 노출. workflow 로그에 `${{ secrets.* }}`가 echo되지 않도록 `payload`는 직접 inline JSON 사용 (현재 구현)
- Discord webhook URL 사용 시 동일하게 secret 처리. `slackapi/slack-github-action`의 `webhook-type: incoming-webhook` 모드는 Discord와 호환 (양쪽 모두 POST JSON)
- 알림 메시지 안에 PII (사용자 이메일, 토큰) 포함 금지. 현재는 commit SHA + run URL만 포함

---

## 검증 체크리스트

- [ ] PR-5 머지 후 첫 main push 시 workflow Actions 탭에서 자동 실행 확인
- [ ] nightly cron 1회 실행 (다음 02:00 UTC) 후 success 관측
- [ ] 의도적 failing 커밋 push → 알림 도달 확인 → revert
- [ ] `e2e-stubbed.yml`을 PR에서 workflow_dispatch 버튼으로 수동 실행 가능 확인
- [ ] 3일 green 누적 후 Phase 18.9 PR draft 시작
