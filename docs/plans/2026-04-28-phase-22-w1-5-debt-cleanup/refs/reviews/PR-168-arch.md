---
pr: 168
title: "feat(w1-5): PR-4 Runner Cache Volume + 다중 fix"
branch: chore/w1-5-runner-cache
base: origin/main
commits: 8 (c3f68c5 → b320681)
files_changed: 6
diff: "+341/-36"
review_type: architecture-scope
review_date: 2026-04-29
reviewer_role: opus arch
verdict: "**MEDIUM** — single-concern 기술적 위반은 인정되나 fold-in 정당화 가능. spec drift 1건은 즉시 갱신 필요."
---

# PR-168 — Architecture / Scope Review

## TL;DR (250 단어 이내)

PR-168 은 명목상 PR-4 (Runner Cache Volume) 단일 PR 이지만 8 commit 동안 5 개 concern 으로 확장되었다. 이는 `memory/feedback_branch_pr_workflow.md` 의 single-concern 카논 **기술적 위반**이다. 그러나 5 concern 중 4 개는 PR-4 본 목적의 **차단 의존성** (service container fix · psql · RUNNERS_NET · shellcheck) 으로 fold-in 정당화 가능 — split 시 PR-4 자체가 CI green 불가. 단 1 건 (Stop hook schema) 은 PR-169 별도 머지되었고 본 PR 의 SC2034 cleanup 만 잔존.

**Spec drift HIGH**: `pr-4-runner-cache.md` 는 cache volume + fork PR 게이트 + H-2 결정만 정의. 실제 구현은 (a) GHA `services:` block → workflow step `docker run` 전환 (Phase 22 W1 spec 부재 사후 패치) (b) RUNNERS_NET 동적 검출 fallback (compose prefix race) (c) `runs-on: [self-hosted, containerized]` 부분 전환 — 셋 모두 spec 갱신 또는 별도 ADR 필수. 특히 (a) 는 myoung34/github-runner ↔ GHA services 호환성 카논 부재로 Phase 22 W1 의 architectural debt.

**RUNNERS_NET dynamic detection 은 dead code 후보**: explicit `name: runners-net` 적용 후 grep fallback 은 이중 안전장치. 다음 host 재배포 후 반드시 한 쪽 제거 (technical debt 누적 방지).

**일관성**: e2e-stubbed 만 `containerized` 라벨, ci.yml 4 job 미전환 — PR-5 carry-over 명시되어 의도 일치. dev compose `:8080` 충돌 회피 목적 명시 부족.

**권고**: admin-merge 허용 (HIGH-1 spec 갱신 즉시 fold-in 또는 PR-5 entry 에 carry-over). split 권고 X — 시점 손실 > 카논 준수 이득.

---

## 1. Single-Concern 위반 분석

PR-168 의 5 concern:

| # | Concern | Commit | PR-4 본 목적 의존? | Split 가능? |
|---|---|---|---|---|
| a | Runner Cache Volume | `c3f68c5` `c8a6110` | ✅ 본 목적 | — |
| b | Service container init bug fix (myoung34 ↔ GHA services) | `542497b` `6aa013c` | **🔴 차단** — fix 없으면 PR-4 자체 fail | ❌ |
| c | RUNNERS_NET 동적 검출 + explicit name | `4b21eba` `6d5a71d` | **🔴 차단** — (b) 의 직접 후속 | ❌ |
| d | Seed E2E theme — psql CLI 대신 docker exec | `f300b5f` | **🔴 차단** — services block 제거의 직접 후속 (runner image psql 미설치) | ❌ |
| e | shellcheck SC2034 (TEMPLATE 변수) | `b320681` | **🟡 차단** — ci-hooks workflow fail → PR-168 status check 미통과 | ❌ |

**결론**: 5 concern 중 4 개 (b/c/d/e) 는 PR-4 의 CI green 차단 의존성. 분리 시 PR-4 단독으로 머지 불가능 → fold-in 정당화. PR-167 의 H-ARCH-2 lesson (4-agent 리뷰 결과 fold-in 분량 과다) 은 본 PR 에서도 동일 패턴이지만 **본질적 차이**는 fold-in 항목이 별도 PR 로 머지 가능한 독립 작업이 아닌, PR-4 의 1st CI run 자체를 막는 차단 버그.

**기록 권고**: PR description 또는 commit message 에 "myoung34/github-runner ↔ GHA `services:` block 비호환 발견 → 사후 패치 fold-in" 명시 (현재 commit message 만으로는 의도 재구성 어려움).

**Stop hook schema (PR-169)** 는 본 PR 과 무관 — 머지된 별도 PR. 본 PR 의 hook 변경은 SC2034 cleanup 1 줄 만, 카논 위치 일치.

## 2. Spec 정합성 (HIGH — 즉시 fold-in 또는 carry-over)

`refs/pr-4-runner-cache.md` (PR 머지 직전 commit `c8a6110` 추가) 는 다음 3 항목이 누락:

1. **myoung34/github-runner ↔ GHA `services:` 비호환 결정** — 본 PR 이 사후 패치한 architectural assumption. Phase 22 W1 (PR-165) spec 부재. 권고: `pr-4-runner-cache.md` 에 "§ Service Container Compatibility (PR-168 fold-in)" 섹션 추가, 또는 Phase 22 W1 plan 에 ADR 추가 (`docs/plans/2026-04-28-phase-22-runner-containerization/refs/adr-services-block.md`).
2. **H-2/H-4/H-5 carry-over 결정** — `pr-4-runner-cache.md` 는 H-2/H-4 fold-in 명시했으나 H-3 (`ci.yml` 4 job) 은 "PR-5 별도" 라고만 — H-5 (Custom Image Option A) 의 Phase 23 entry 명시는 OK. H-3 의 ci.yml 부분 전환은 본 PR 의 `runs-on: [self-hosted, containerized]` 일관성 부족 항목 (§ 4) 과 직결.
3. **Seed E2E theme — docker exec 전환** — services block 제거의 직접 후속이지만 spec 미언급. 운영 시점 회귀 방어 (host 에 psql 재설치 시 silent fallback 가능) 위해 spec 명시 권고.

**Severity HIGH**: 본 PR 이 myoung34 image 의 architectural assumption (GHA services 비호환) 을 사후 패치한 형태. spec 없이 머지 시 Phase 23 진입 시 회귀 가능성.

## 3. 상위 Phase 의존성 (MEDIUM)

Phase 22 W1 (PR-165) 가 myoung34/github-runner pool 을 도입할 때 GHA services block 호환성 검증을 누락. 본 PR 이 사후 패치 + W1.5 진입. 처리 옵션:

- **Option A**: 본 PR 에 inline spec 갱신 (commit 1 추가, `pr-4-runner-cache.md` 보강).
- **Option B**: PR-5 entry (ci.yml runs-on 전환) 에 carry-over 항목으로 명시. 단, PR-5 가 `runs-on` 전환 시 같은 services block 문제 재발 가능 → PR-5 에서 동일 패턴 (workflow step `docker run`) 적용 강제.
- **Option C**: Phase 22 W1 retroactive spec 갱신 (`adr-services-block.md`) — 가장 깨끗하지만 단독 PR 필요.

**권고**: **Option A + B** 동시. 본 PR 머지 전 `pr-4-runner-cache.md` 에 1 섹션 추가 + PR-5 spec 에 carry-over 명시.

## 4. `runs-on: [self-hosted, containerized]` 일관성 (LOW — 의도 일치)

`e2e-stubbed.yml` 만 `containerized` 라벨, `ci.yml` 4 job 은 `self-hosted` 잔존. 현재 PR-168 + PR-167 머지 후 host 의 모든 runner 가 `containerized` 라벨을 가지므로 두 라벨 모두 같은 pool 매칭 → **기능적 차이 없음**. 그러나:

- **의도 명시 부족**: 본 PR 의 `containerized` 추가가 dev compose `:8080` 충돌 회피 임시 split 인지, 영구 분리인지 코드/spec 모두 미언급.
- **PR-5 carry-over**: `pr-4-runner-cache.md` § "적용 범위 밖" 에 PR-5 명시되어 의도 일치. OK.

**권고**: `e2e-stubbed.yml` 의 `runs-on: [self-hosted, containerized]` 위에 1 줄 주석 — "PR-5 까지 partial migration. ci.yml 전환 후 라벨 일원화".

## 5. RUNNERS_NET Dynamic Detection Robustness (MEDIUM — dead code 위험)

```bash
RUNNERS_NET=$(sudo docker network ls --format '{{.Name}}' | grep -E '(^|_)runners-net$' | head -1)
```

문제:
1. **Explicit `name: runners-net` 적용 후 (commit `6d5a71d`) 본 grep 은 항상 `runners-net` 정확 매칭** → fallback 의 compose prefix 케이스 (`infra-runners_runners-net`) 는 host 재배포 전 한 번만 유효. 사용자 host 재배포 후 dead code.
2. **Robustness**: `head -1` 은 multiple match 가능 시 비결정적 (예: `dev-runners-net` 추가 시 false positive). regex `^runners-net$` 또는 `^([a-z0-9-]+_)?runners-net$` 더 정확.
3. **사용자 host 재배포 시점**: 사용자 SSH 작업 (`docker compose down && docker compose up -d`) 완료 후 dynamic detection 무효 — 다음 PR 에서 `--network runners-net` 직접 지정으로 단순화 권고.

**Severity MEDIUM**: 현재 host 상태 (compose prefix 적용된 기존 network) 에서는 dynamic detection 필수. 재배포 후 cleanup PR (W1.5 PR-5 또는 W2 entry) 에서 제거 권고.

## 6. Hooks 변경 카논 위치 (LOW — 일치)

`.claude/plugins/compound-mmp/hooks/test-compound-plan-dry-run.sh:9` 의 `TEMPLATE` 변수 1 줄 제거. shellcheck SC2034 dead code. compound-mmp plugin 카논 위치 일치, PR scope 일치 (CI green 차단 의존성). PR-169 Stop hook schema 와는 별개.

## 7. CI Admin-skip 정책 만료 (MEDIUM — 정책 평가 시점)

`memory/project_ci_admin_skip_until_2026-05-01.md` — 만료 2026-05-01 (2 일 후). 본 PR 머지가 admin-merge 일 가능성:

- W1.5 본 plan 의 명시 의도 — "main DEBT 5건 정리" → 만료 평가 시점.
- 본 PR 이 cache + service container fix + RUNNERS_NET + psql + shellcheck 5 fix → 만료 후 standard merge gate 진입 시 동일 issue 재발 가능성 낮음 (cache poisoning 가드 + fork PR 게이트 적용).
- DEBT-4 (gitleaks) + DEBT-5 (govulncheck) 는 W1.5 PR-2/PR-3 별도 carry-over → 만료 시 main fail 가능.

**권고**: 본 PR 머지는 admin-merge 허용 (W1.5 plan 의도 일치). 단 admin-skip 정책 만료 결정은 W1.5 PR-2/PR-3 머지 완료 후 재평가 (현재 만료 일정 무리).

## 8. 종합 등급

| 항목 | 등급 | 결정 |
|---|---|---|
| Single-concern 위반 | MEDIUM (기술적 위반) | **fold-in 정당화** — split 권고 X |
| Spec drift (services block) | **HIGH** | **즉시 fold-in** — `pr-4-runner-cache.md` 1 섹션 추가 |
| 상위 phase 의존 (W1 retroactive) | MEDIUM | PR-5 carry-over 또는 별도 ADR |
| `runs-on` 일관성 | LOW | 주석 1 줄 권고 |
| RUNNERS_NET dynamic | MEDIUM | 사용자 host 재배포 후 cleanup PR |
| Hooks 카논 | LOW | 일치 |
| Admin-skip 정책 | MEDIUM | 만료 평가는 W1.5 완료 후 |

**머지 결정 권고**: **admin-merge 허용** (W1.5 plan 의도 일치). 단 머지 전 spec 갱신 1 commit fold-in (HIGH-1 해소).

## 9. Split 권고 분기점 (최종)

본 PR 의 5 concern 은 split 불가. 향후 유사 상황에서 split 가능 분기점:

1. **Concern 이 PR-4 의 CI green 을 차단하지 않는 경우** → 별도 PR. 예: 본 PR 의 SC2034 cleanup 이 e2e-stubbed.yml 이 아닌 다른 workflow 만 영향 시 split.
2. **Concern 이 별도 spec/ADR 을 요구하는 경우** → 별도 PR + spec PR 2 개. 예: services block 비호환 결정이 Phase 22 전반에 영향 시 ADR PR 우선.
3. **Concern 이 운영 절차 변경 (사용자 host SSH 작업) 을 요구하는 경우** → 별도 PR (rollback safety). 본 PR 의 `name: runners-net` 적용은 host 재배포 필수 → 이상적으로는 별도 PR. 단 본 PR 의 cache volume 도 같은 재배포 필요 → 동일 작업 1 회 수행 효율 우선 fold-in 정당화.

**핵심 분기점**: "별도 PR 로 분리해도 각자 머지 가능한가?" 본 PR 은 NO → fold-in 정당. 차후 PR 작성 시 commit message 에 "PR-N 차단 의존성" 명시 권고 (의도 재구성 도움).

## 카논 ref

- `memory/feedback_branch_pr_workflow.md` — single-concern 카논
- `memory/feedback_4agent_review_before_admin_merge.md` — 4-agent 강제 정책
- `memory/project_ci_admin_skip_until_2026-05-01.md` — admin-skip 만료 일정
- `docs/plans/2026-04-28-phase-22-runner-containerization/checklist.md` — 상위 phase
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-4-runner-cache.md` — PR-4 spec
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/reviews/PR-168.md` — 4-agent 리뷰 (initial commit `c3f68c5`)
