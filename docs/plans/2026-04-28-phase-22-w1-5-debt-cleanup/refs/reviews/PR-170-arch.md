---
pr: 170
reviewer: architecture (opus-4-7)
date: 2026-04-29
findings: {high: 1, medium: 4, low: 3}
verdict: conditional
---

# PR-170 — Architecture / Scope Review

## TL;DR (200 단어 이내)

PR-170 은 PR-168 의 CI 노출 부채 4건 (DEBT-1~4) 을 단일 root cause (`runs-on: self-hosted` → containerized routing) 라는 명확한 spec 으로 1 PR 묶음 처리. `memory/feedback_branch_pr_workflow.md` single-concern 카논 **명목 위반은 인정되나 spec 의 예외 정당화 (L31-32) 가 충분**. 4건 모두 동일 환경 비호환 root cause, 분리 시 4 review × 4 ci-cycle 부담.

**HIGH-1 (보일러플레이트 중복)**: ci.yml `Start postgres + redis` step 70 줄이 e2e-stubbed.yml 과 95% 동일. spec L322 가 자체 인지 (`Phase 23 reusable composite action 추출 검토`) 하나, **검토** 가 아니라 **확정 carry-over** 로 escalate 필요. 사용처 3+ trigger (spec L137 wave-3-label-switch.md) 가 본 PR 머지로 이미 발생 (e2e-stubbed.yml + ci.yml = 2, W3 atomic switch 시 +N).

**MEDIUM 4건**: (a) DEBT-4 W3 atomic switch 와 dead code 충돌 가능성, (b) symlink override 의 host 영향 격리 불명, (c) RUNNERS_NET dynamic detection PR-168 carry-over 미해소, (d) `pr-8-runner-action-compat.md` spec 의 PR-5/PR-8 재배열 미반영. **LOW 3건**: 주석 위치, env scope, cleanup robustness.

**머지 결정**: **conditional** — HIGH-1 fold-in (composite action carry-over Phase 23 entry 추가) 또는 PR-5 spec 에 명시 후 admin-merge 허용.

---

## 1. Single-Concern 카논 평가 (PASS — 정당화 충분)

PR-170 의 4 concern (DEBT-1/2/3/4) 분석:

| # | DEBT | 파일 | Root cause | 단독 PR 가능? |
|---|------|------|-----------|--------------|
| a | DEBT-1 gitleaks artifact | `security-fast.yml` | containerized runner working dir mismatch | ⚠️ 가능 (env 1줄) |
| b | DEBT-2 CodeQL Node v20 | `security-deep.yml` | image default Node v10 ↔ `??` syntax | ⚠️ 가능 (step 2개) |
| c | DEBT-3 Trivy docker.sock | `security-deep.yml` | sup group 990 lost in workflow | ⚠️ 가능 (step 1개) |
| d | DEBT-4 ci.yml services | `ci.yml` | GHA services ↔ myoung34 network namespace | ❌ 70+ 줄 manual + cleanup |

**spec L31-32 정당화**: "4건 모두 단일 root cause (`runs-on: self-hosted` → containerized routing)". 기술적으로 4 concern 이 별 PR 가능하나:

1. **공통 컨텍스트 review 비용**: 분리 시 4 review × "containerized runner 환경 이해" 4번 반복. 본 PR 의 commit 분리 (`5be282a` / `fd227f9` / `e2106ad`) 가 이미 single-concern 검토 가능 단위 제공.
2. **부채 정리 phase 의도**: W1.5 phase 자체가 "main DEBT 5건 정리" goal (`checklist.md` L15). DEBT-1/2/3/4 묶음은 phase scope 일치.
3. **분리 시 진행 시간**: 4 PR × ci 런타임 (~25-30 min/PR) = ~2 시간 vs 본 PR 1 회 ~30 min. admin-skip 만료 (2026-05-01, 2 일 후) 시점 고려 시 묶음 정당화.

**PR-168 lesson 비교**: PR-168 도 8 commit 5 concern 묶음 → MEDIUM 평가. 본 PR 은 4 concern 모두 spec 사전 정의 (`pr-8-runner-action-compat.md` 132 줄) → spec drift 없는 fold-in. **PR-168 보다 우월**.

**결론**: single-concern 위반 명목적, spec 정당화 충분. **추가 분리 권고 X**.

## 2. HIGH-1 — 보일러플레이트 중복 carry-over escalate 필요

**요약**: ci.yml `Start postgres + redis` (70 줄) + `Cleanup postgres + redis` (8 줄) 이 e2e-stubbed.yml 과 95% 동일. spec L322 `Phase 23 reusable composite action 추출 검토` 가 자체 인지하나 carry-over 우선순위 부족.

**Evidence**:
- `ci.yml:31-93` (PR diff +63 line) ↔ `e2e-stubbed.yml:53-119` 95% 동일. 차이는 (i) PG 이름 prefix `ci-go-` vs `e2e-`, (ii) DB 이름 `mmp_test` vs `mmp_e2e`, (iii) matrix shard suffix.
- `pr-8-runner-action-compat.md:322` — "Trade-off: 보일러플레이트 (PR-168 e2e-stubbed.yml 와 동일 패턴 중복). Phase 23 reusable composite action `.github/actions/start-services/action.yml` 으로 추출 검토".
- `wave-3-label-switch.md:137` — "bash 3.2 step composite action 추출 (사용처 3+ 발생 시)". 본 PR 머지 후 사용처 = 2 (ci.yml + e2e-stubbed.yml). **PR-5 (ci.yml runs-on 전환) 머지 시 다른 ci.yml job 4개 (ts-check, web-build, build-server) 도 services 사용 시 +N**.

**영향**:
1. **회귀 위험 dual write**: 한 쪽 수정 시 다른 쪽 drift. 예: PR-168 의 RUNNERS_NET dynamic detection grep 패턴이 e2e-stubbed.yml 에서 개선되어도 ci.yml 미반영 가능.
2. **code review 부하**: 향후 services-related PR 마다 2 파일 동시 검토 강제.
3. **Phase 23 carry-over 우선순위 약함**: spec 이 "검토" 표현 → 실제 이행 보장 X.

**권고**:
- **Option A (preferred)**: 본 PR 에 commit 1 추가 — `pr-8-runner-action-compat.md` § "Phase 23 carry-over" 의 "Reusable composite action" 항목을 (검토 → **확정**) 으로 escalate. checklist.md PR-8 entry 의 carry-over 항목에도 동일 명시.
- **Option B**: PR-5 (ci.yml runs-on 전환) entry 에 "ci.yml services 패턴 composite action 추출 의무" 추가. PR-5 가 본 패턴을 4 job 으로 확대할 가능성 → 추출 시점 PR-5 가 자연스러움.
- **Option C (reject)**: 본 PR 에서 직접 추출 — scope 폭증. 4-agent review 재시작 필요.

**Severity HIGH** — Phase 23 진입 시 잊혀질 위험. 명시적 carry-over commit 1 추가 강제.

## 3. MEDIUM-1 — DEBT-4 W3 atomic switch 와 dead code 충돌

**요약**: 본 PR 의 DEBT-4 fix (ci.yml services → manual docker run) 는 `runs-on: self-hosted` 가정. Phase 22 W3 (`wave-3-label-switch.md`) 머지 시 ci.yml 4 job 이 `[self-hosted, containerized]` 로 전환 → 본 PR 의 70 줄 manual docker run 은 여전히 필요 (services block 비호환은 라벨 무관) 하지만 **dynamic detection grep fallback 은 dead code**.

**Evidence**:
- `ci.yml:39` — `RUNNERS_NET=$(sudo docker network ls --format '{{.Name}}' | grep -E '(^|_)runners-net$' | head -1)` — PR-168 의 compose prefix race fallback. host 재배포 후 explicit `name: runners-net` 적용 시 fallback 무효 (PR-168 arch review § 5).
- `wave-3-label-switch.md:46` — "❌ workflow `runs-on` 점진 변경 (half-state 회피) — W3 단일 PR atomic switch". W3 가 ci.yml `runs-on` 전환만 다룰 뿐 services step 변환 spec 없음.
- W3 plan 의 `bash 3.2 의존 step 식별` (Task 3) 이 services 변환 사용처와 중복 가능.

**영향**:
1. W3 atomic switch PR 검토 시 본 PR 의 dynamic detection grep 이 dead code 인지 재평가 부담.
2. W3 PR 이 explicit `--network runners-net` 직접 지정으로 단순화 시 본 PR 과 drift.

**권고**: W3 plan (`wave-3-label-switch.md`) 의 Task 3 에 "ci.yml + e2e-stubbed.yml 의 RUNNERS_NET dynamic detection cleanup (PR-168/170 carry-over)" 명시. 본 PR 머지 시 **W3 entry 의 carry-over 추가 commit 권고**.

**Severity MEDIUM** — Phase 22 W3 (1주 관측 후 진입) 시점 dead code 누적 위험.

## 4. MEDIUM-2 — DEBT-2 symlink override host 영향 격리

**요약**: `sudo ln -sf "$NODE_BIN" /usr/local/bin/node` 가 host 의 `/usr/local/bin` 을 mutate. self-hosted runner 는 job 간 host filesystem 공유 → 다음 job 이 v20 symlink 영향 받음.

**Evidence**:
- `security-deep.yml:147-153` — `sudo ln -sf "$NODE_BIN" /usr/local/bin/node`.
- 본 PR 의 codeql job 외 다른 workflow (e2e-stubbed.yml, ci.yml ts-check) 가 동일 host 의 `/usr/local/bin/node` 사용 시 silent v20 dependency 도입.
- spec L131 `setup-node@v4 가 PATH 만 update 해도 subprocess resolve 실패` 만 명시. cleanup step 부재.

**영향**:
1. **Cross-job interference**: codeql job 후 다른 job 의 Node 동작 변경 가능 (특히 ts-check 가 v18 LTS 가정 시).
2. **격리 부재**: containerized runner 가 myoung34 docker container 내부 `/usr/local/bin` 이라면 container ephemeral → 영향 격리됨. 그러나 `runs-on: self-hosted` (containerized 라벨 없음) 시 host filesystem mutate.
3. **Architectural assumption 부재**: spec L131 가 "spawn child PATH resolve" 만 다루고 host filesystem mutation 의 격리 boundary 미언급.

**권고**:
- spec `pr-8-runner-action-compat.md` 에 "Symlink Lifecycle" 섹션 추가 — 본 step 이 host vs container 어느 filesystem 영향, 다른 workflow 영향 평가 명시.
- (선택) 본 step 끝에 cleanup `if: always() && matrix.language == 'javascript-typescript'` 추가 — `sudo rm -f /usr/local/bin/node /usr/local/bin/npm` (구 symlink 복원). 단 동일 runner 의 다른 job 이 이미 v20 사용 중일 시 race → cleanup 생략이 더 안전 가능.
- `docker exec containerized-runner-N which node` 로 실제 container filesystem 격리 boundary 확인 후 spec 보강.

**Severity MEDIUM** — 회귀 미관측이지만 architectural assumption 누락. Phase 23 Custom Image (Node v20 사전 install) 후 자연 해소되므로 carry-over 가능.

## 5. MEDIUM-3 — DEBT-3 docker/build-push-action 제거의 GHA 생태계 이탈

**요약**: `docker/build-push-action@v6.9.0` (SHA-pinned) 제거 → manual `sudo docker build`. GHA action 생태계 이탈은 architectural debt 누적 (cache type=gha, multi-platform, BuildKit secret mount, attestation 등 기능 손실).

**Evidence**:
- `security-deep.yml:33-44` (PR diff) — `docker/setup-buildx-action` + `docker/build-push-action` 8 줄 → `sudo docker build` 5 줄.
- spec L180 `옵션 A 채택 — buildx + cache-from gha 효과 포기되지만 Trivy scan 만의 1회용 이미지라 cache 무가치`.
- 동일 패턴 (PR-168 e2e-stubbed.yml) 이 다른 build 작업으로 확대 시 (예: container CVE scan multi-image, registry push) GHA action 으로 회귀 필요.

**영향**:
1. **Supply chain attestation 손실**: `docker/build-push-action` 의 `provenance` + `sbom` 옵션 사용 불가. 본 PR 의 Trivy job 은 1회용 이미지라 상관 없으나, PR-5+ 가 본 패턴을 prod image build 로 확대 시 attestation 회귀.
2. **BuildKit cache 손실**: 동일 base image 가 ci.yml + e2e-stubbed.yml + security-deep.yml 3 곳에서 build 시 layer cache 공유 X.
3. **GHA action 생태계 의존도 ↓**: 향후 docker action 신규 기능 (예: harden-runner 와의 integration) 미적용.

**권고**:
- spec `pr-8-runner-action-compat.md` § "Phase 23 carry-over" 에 "**docker action 복원 시점 결정**" 명시 — Phase 23 Custom Image (runner user 의 docker group GID 990 정착) 후 `docker/build-push-action` 복원 가능. 복원 trigger 는 (i) attestation 요구 발생 (ii) prod image build 다수화.
- 본 PR 의 manual `sudo docker build` step 위 주석에 "GHA action 복원 Phase 23 후 검토" 1 줄 추가.

**Severity MEDIUM** — Trivy 1회용 image 라 즉시 영향 없으나 확대 시 회귀.

## 6. MEDIUM-4 — Spec ↔ checklist 정합성 미흡

**요약**: `pr-8-runner-action-compat.md` 와 `checklist.md` PR-8 entry 가 거의 일치하나 carry-over 항목의 우선순위 표현 불일치.

**Evidence**:
- `checklist.md` PR-8 entry (L25-41) 와 `pr-8-runner-action-compat.md` (L132 줄) 는 99% 일치.
- 차이: spec L335 의 "Reusable composite action: ... 으로 추출 **검토**" vs checklist L34 미언급 (composite action carry-over). spec 의 "Phase 23 carry-over" 3 항목 (Custom Image / composite action / gitleaks artifact 복원) 중 checklist 는 Custom Image 만 언급.
- checklist L40 검증 항목이 spec L326-330 와 1:1 매칭 OK.

**영향**:
1. checklist 만 읽는 reviewer 가 carry-over 3 항목 중 2 항목 (composite action / gitleaks artifact 복원) 미인지.
2. Phase 23 진입 시 carry-over backlog 누락 위험.

**권고**: checklist.md PR-8 entry 의 "**Phase 23 carry-over**" 항목 (현재 1 줄) 을 3 항목 list 로 확장. 본 PR 의 `dc7d1e8` commit (docs/plans 변경) 에 이미 포함되었어야 함.

**Severity MEDIUM** — Phase 23 carry-over backlog 정합성. 본 PR 머지 전 fold-in 권고.

## 7. LOW-1 — `Start postgres + redis` step 주석 위치

**요약**: ci.yml 의 step 위 주석 (`L31-35`) 이 step 외부에서 PR-168 e2e-stubbed.yml 패턴 동일 명시. step 내부 본질 (RUNNERS_NET dynamic detection 의 의도) 은 inline 주석 부족.

**Evidence**:
- `ci.yml:39` — `RUNNERS_NET=$(...)` 위 inline 주석 1 줄 (`compose project prefix 무관`). e2e-stubbed.yml 의 동일 위치 (L67-69) 는 3 줄 주석으로 후보 명시.

**권고**: ci.yml 의 inline 주석을 e2e-stubbed.yml 과 동일하게 3 줄로 확장 (PR-168 6d5a71d explicit name + compose prefix race 후보 명시). composite action 추출 시 dual-write 방지.

**Severity LOW** — drift 가능성.

## 8. LOW-2 — `Export service connection env` step env scope

**요약**: ci.yml `L92-93` 의 `${PG_NAME}` `${REDIS_NAME}` 가 직전 step 의 `$GITHUB_ENV` 통해 export 됨. 단 step 간 의존 관계 (Start → Export) 가 GHA 의 step ordering 가정에 의존 — defaults `working-directory` mismatch 시 silent fail 가능.

**Evidence**:
- `ci.yml:91` — `working-directory: ${{ github.workspace }}` 명시 OK.
- `ci.yml:93` — `echo "DATABASE_URL=postgres://mmp:mmp_test@${PG_NAME}:5432/...`. `${PG_NAME}` 미정의 시 silent `postgres://...@:5432/...` (잘못된 URL) 생성 가능.

**권고**: Export step 첫 줄에 `[ -z "${PG_NAME:-}" ] && { echo "::error::PG_NAME unset"; exit 1; }` 가드 추가. **선택적** — 회귀 미관측이고 Start step 이 always 실행되므로.

**Severity LOW** — 방어적 코딩.

## 9. LOW-3 — Cleanup step robustness

**요약**: `ci.yml:175-181` cleanup step 의 `${PG_NAME:-}` ${REDIS_NAME:-}` default 가 빈 문자열 → `sudo docker rm -f "" ""` 가 docker error 발생 가능.

**Evidence**:
- `ci.yml:181` — `sudo docker rm -f "${PG_NAME:-}" "${REDIS_NAME:-}" 2>/dev/null || true`.
- `||  true` 가 error 흡수하나 `2>/dev/null` 가 docker daemon 의 진짜 error (예: socket permission) 도 숨김.

**권고**: 빈 문자열 가드 — `[ -n "${PG_NAME:-}" ] && sudo docker rm -f "$PG_NAME" 2>/dev/null || true`. **선택적**.

**Severity LOW** — || true 가 이미 흡수.

## 10. 종합 등급

| 항목 | 등급 | 결정 |
|---|---|---|
| Single-concern 카논 | OK | spec 예외 정당화 충분, 분리 권고 X |
| 보일러플레이트 중복 (HIGH-1) | **HIGH** | **fold-in 또는 PR-5 carry-over 명시** |
| W3 atomic switch dead code (MED-1) | MEDIUM | W3 plan carry-over 추가 |
| Symlink host mutation (MED-2) | MEDIUM | spec § "Symlink Lifecycle" 추가 |
| docker action 제거 (MED-3) | MEDIUM | spec carry-over 보강 |
| Spec ↔ checklist 정합성 (MED-4) | MEDIUM | checklist carry-over 3 항목 확장 |
| 주석 위치 (LOW-1) | LOW | drift 방지 |
| env scope (LOW-2) | LOW | 방어적 |
| Cleanup robustness (LOW-3) | LOW | || true 흡수 OK |

**머지 결정 권고**: **conditional admin-merge** — HIGH-1 fold-in commit 1 추가 후 admin-merge 허용.

## 11. PR-168 비교 (architectural 진보)

| 항목 | PR-168 | PR-170 |
|---|---|---|
| Spec 사전 정의 | `pr-4-runner-cache.md` 가 services block 비호환 결정 미언급 (HIGH spec drift) | `pr-8-runner-action-compat.md` 132 줄 사전 작성, 4 DEBT 모두 spec 정의 |
| Concern 묶음 정당화 | 4/5 차단 의존성 (commit message 의존) | 4/4 단일 root cause (spec L31-32 명시) |
| 보일러플레이트 인지 | 미인지 (e2e-stubbed.yml 1회 등장) | spec L322 자체 인지 (검토 → escalate 필요) |
| Phase 23 carry-over | 미명시 | 3 항목 list (Custom Image / composite action / gitleaks artifact) |

**결론**: PR-170 은 PR-168 의 lesson 을 반영한 architectural 진보. spec 사전 작성 + carry-over 3 항목 list 가 핵심 개선.

## 12. 카논 ref

- `memory/feedback_branch_pr_workflow.md` — single-concern 카논
- `memory/feedback_4agent_review_before_admin_merge.md` — 4-agent 강제 정책
- `memory/project_ci_admin_skip_until_2026-05-01.md` — admin-skip 만료 (2 일 후)
- `docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md` — 상위 phase
- `docs/plans/2026-04-28-phase-22-runner-containerization/refs/wave-3-label-switch.md` — W3 atomic switch
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-8-runner-action-compat.md` — PR-8 spec
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/reviews/PR-168-arch.md` — PR-168 architecture review (lesson source)

## Sign-off

**Reviewer**: opus-4-7 architecture
**Date**: 2026-04-29
**Verdict**: **conditional pass** — HIGH-1 (composite action carry-over escalate) 해소 후 admin-merge 허용. 그 외 MEDIUM 4건 / LOW 3건 은 follow-up commit 또는 Phase 23 entry.
