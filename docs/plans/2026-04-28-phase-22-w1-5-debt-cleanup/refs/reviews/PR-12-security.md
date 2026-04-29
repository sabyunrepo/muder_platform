---
pr: 12
title: "chore(w1-5): 9 workflow setup-go cache: false + actions/cache narrow (go/pkg/mod only)"
branch: chore/w1-5-go-cache-narrow
base: main
review_type: security
reviewer: security-agent
review_date: 2026-04-29
files_reviewed:
  - .github/workflows/ci.yml
  - .github/workflows/e2e-stubbed.yml
  - .github/workflows/flaky-report.yml
  - .github/workflows/module-isolation.yml
  - .github/workflows/phase-18.1-real-backend.yml
  - .github/workflows/security-deep.yml (2 job)
  - .github/workflows/security-fast.yml
verdict: "conditional — MEDIUM-1 수정 권고, 나머지 pass"
---

# PR-12 Security Review

## Verdict: conditional

MEDIUM-1 (fork PR write isolation) 을 merge 전 해소 권고. HIGH 없음. SHA pin + single-concern 은 pass.

---

## HIGH

없음.

---

## MEDIUM

### MEDIUM-1 [Fork PR Cache Write] 5개 pull_request 트리거 workflow — restore-keys fallback 이 stale cache carryover 허용

**대상**: `ci.yml`, `module-isolation.yml`, `security-deep.yml`, `security-fast.yml` (pull_request 트리거 4개 + e2e-stubbed.yml 은 fork gate 기존 존재)

**시나리오**:
- GitHub Actions `actions/cache` 는 `pull_request` 이벤트에서 **write(save)를 fork PR 에 차단**하지만, **same-repo PR 은 cache write 허용**된다.
- 같은 `go-mod-Linux-` restore-keys prefix 를 9 workflow 가 공유한다. same-repo malicious PR 이 go.sum 을 수정해 악성 module 을 `~/go/pkg/mod` 에 populate 하면, 동일 prefix cache entry 가 저장된다.
- 다음 run 에서 다른 workflow 의 restore-keys fallback (`go-mod-Linux-`) 이 이 오염된 partial cache 를 히트, 악성 module 이 carryover된다.
- 단, `go mod verify` 가 없는 job 은 체크섬 검증 없이 오염 module 을 사용하게 된다.

**실제 위험도**: same-repo write access 가 전제이므로 외부 공격자 경로는 차단됨. 그러나 내부 contributor trust + supply chain 사고(계정 탈취) 가 결합되면 실현 가능.

**권고 (둘 중 택1)**:
1. (선호) `go mod verify` step 을 Go 테스트 실행 직전에 추가:
   ```yaml
   - name: Verify Go modules
     working-directory: apps/server
     run: go mod verify
   ```
2. (대안) restore-keys fallback 제거 — exact key miss 시 cache 없이 진행:
   ```yaml
   # restore-keys 블록 전체 제거
   ```

---

## LOW

### LOW-1 [SHA 검증] `5a3ec84eff668545956fd18022155c47e93e2684` — v4.2.3 태그 일치 확인 필요

PR 에서 사용하는 `actions/cache@5a3ec84eff668545956fd18022155c47e93e2684 # v4.2.3` SHA 를 독립 검증하지 못했다 (오프라인 환경). 단, Renovate `helpers:pinGitHubActionDigests` 가 활성화되어 있고 이 SHA 가 PR-12 내 신규 도입이므로, **merge 전 담당자가 `gh api repos/actions/cache/git/ref/tags/v4.2.3` 으로 SHA 일치 여부를 직접 확인**할 것을 권고. Renovate 가 다음 monthly PR 에서 자동 업데이트 추적한다.

### LOW-2 [Cache Scope 공유] 9 workflow 동일 key prefix — 비정상 cache hit 가능성

`go-mod-${{ runner.os }}-${{ hashFiles('apps/server/go.sum') }}` 를 9 workflow 가 공유한다. go.sum 이 동일하면 모든 workflow 가 같은 cache entry 를 사용하는 것이 **의도된 설계**이며 운영 효율이 높다. 단, 하나의 workflow job 이 cache 를 corrupt 시키면 9 workflow 전체가 영향받는 구조임을 문서화 권고 (ops 인지).

---

## carry-over

- `go mod verify` 추가를 PR-12 에서 해소하거나 Phase 23 task 로 명시 등록 필요.
- SHA `5a3ec84e...` 검증 결과를 pr-12-go-cache-narrow.md 에 기록.

---

## 결론

SHA pin + `helpers:pinGitHubActionDigests` + Renovate monthly tracking 조합은 supply chain pin 카논(Phase 18.7)과 일치한다. `cache: false` + narrow path 는 `~/.cache/go-build` 누락이라는 single root cause 에 대한 일관된 수정이므로 single-concern 위반 아님. fork PR write 는 GitHub Actions 기본 정책(fork PR = read-only cache)으로 **외부 공격 경로는 차단**되나, same-repo PR 의 restore-keys fallback 오염 경로(MEDIUM-1) 는 `go mod verify` 한 줄로 완전 차단 가능하다. 이를 추가하면 unconditional pass.
