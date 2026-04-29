# PR-5 Architecture Review

> Reviewer: opus-4-7 (architecture lens)
> Diff scope: `.github/workflows/ci.yml` 4 jobs `runs-on: self-hosted` → `[self-hosted, containerized]` (4 lines) + checklist.md status update (4 lines)
> Date: 2026-04-29

## Verdict: pass

근거: single-concern 카논을 정밀하게 준수했고 (4 라인 routing label만), 모든 step-level 호환 부채는 PR-170 fold-in 으로 선행 해소되어 있으며, carry-over (W3 / Phase 23) 매핑이 spec/checklist 양쪽에 일관되게 명시됨. 발견된 architectural 부채는 모두 PR-5 scope 밖 carry-over 로 정확히 escalate.

## HIGH (구조적 부채 / 다음 PR 필수)

없음. 본 PR diff 자체는 4 라인 routing 변경이며, HIGH 급 구조 부채는 모두 W3/Phase 23 carry-over 로 분리됨 (아래 carry-over 매핑 검증 참조).

## MEDIUM (개선 권고)

- **M-1 Composite action 추출 (PR-170 Arch-HIGH-1) 의 deferred 상태 재확인 필요**
  PR-170 review 에서 escalate 된 `.github/actions/start-services/action.yml` 추출은 Phase 23 carry-over 로 명시됨 (spec L108, checklist L119). 그러나 PR-5 머지 후 ci.yml#go-check (L34-92, 59 lines) + e2e-stubbed.yml 의 `Start postgres + redis` step 이 95% 동일 패턴으로 양쪽 동시 routing 됨 → 보일러플레이트 확산 위험. PR-5 의 single-concern 정당성은 인정하지만, Phase 23 entry 의 첫 번째 task 로 composite action 추출을 우선순위 1 로 고정 권고. routing 좁힘만 하는 PR-5 가 추출을 미루는 것은 정합성 있음 (4 lines vs 60+ lines refactor 의 review scope 분리).

- **M-2 RUNNERS_NET regex (`grep -E '(^|_)runners-net$'`) 의 routing 확장 영향**
  ci.yml L44 의 동적 검출 regex 는 PR-170 fold-in 산출물. PR-5 머지 후 본 패턴이 ci.yml 4 job 중 go-check 1 job 만 사용하나, e2e-stubbed.yml 이 이미 동일 regex 보유. W3 RUNNERS_NET 강화 carry-over (spec L102-104, checklist L130-131) 가 두 파일 동시 적용 필요함을 명시. 본 PR 은 ci.yml 의 regex 노출을 늘리지 않음 (PR-170 에 이미 존재) — PR-5 fault 아님. 단, W3 PR 진입 시 ci.yml + e2e-stubbed.yml 동시 수정 single-concern 묶음 정당화 필요.

## LOW (관찰)

- **L-1 4 runner pool 점유 trade-off**
  spec L91-96 에서 명시: PR-167 부터 e2e-stubbed.yml 4 shard 가 4 containerized runner 점유 → PR-5 머지 후 ci.yml 4 job 도 동일 풀 공유. pull_request 이벤트 시 동시 trigger 로 queue 포화 가능. 그러나 PR-4 의 named volume cache (Playwright + hostedtool) 효과로 job 시간 단축이 점유 해소 상쇄. 카운터 메저는 W3 stable 1주 관측 후 평가가 합리적 — 본 PR 에서 별도 조치 불필요.

- **L-2 bare-host runner 가시성 (사용자 host 상태)**
  spec L86-89 (Case B) 가 이를 정확히 식별: bare-host runner 등록은 사용자 SSH 직접 작업 영역으로 PR scope 밖. PR-5 routing 좁힘 후 ci.yml 의 4 job 은 bare-host 0 routing → tar 충돌 영구 해소 (이전 PR-170 1st CI run 진단 데이터, spec L29-37). bare-host runner 의 다른 workflow (현재 0건 — security-fast/deep, e2e-stubbed.yml 모두 containerized) 가시성은 W3 PR (사용자 SSH `./svc.sh uninstall`) carry-over 로 깔끔히 분리.

- **L-3 Spec drift 부재**
  spec (`refs/pr-5-ci-runs-on.md`) 가 본 PR diff 4 라인을 정확히 기술 (L17). H-1/H-2/H-3 결정 (matrix 의미, fold-in 의존, single-concern) 이 구조적 root cause 와 일치. 미래 reader 가 4-line diff 의 정공 fix 근거를 spec 만으로 재구성 가능.

## carry-over 매핑 검증

PR-5 spec Out of Scope (L98-108) ↔ checklist.md Carry-over (L113-131) 5 항목 일치 확인:

| spec carry-over | checklist 매핑 위치 | 일치 |
|---|---|---|
| W3 fork PR 게이트 (spec L102) | checklist L128 ("PR-5 의존" 섹션 부재 — fork 게이트 단독 entry 없음) | **부분 누락** |
| W3 bare-host runner 등록 해제 (spec L103) | checklist Carry-over 본문 미명시 | **누락** |
| W3 RUNNERS_NET regex (spec L104) | checklist L130 ("RUNNERS_NET regex 강화" Sec-MED-1) | OK |
| Phase 23 Custom Image (spec L106-107) | checklist L120-124 ("Custom Image Option A") | OK |
| Phase 23 Composite action (spec L108) | checklist L119 ("Composite action 추출") | OK |

**발견**: checklist.md 의 "Phase 22 W3 carry-over (PR-5 의존)" 섹션 (L128-131) 에 W3 carry-over 3건 중 1건만 수록 (RUNNERS_NET). fork PR 게이트 + bare-host 등록 해제 2건이 spec 에는 있으나 checklist 에는 미수록.

**권고**: PR-5 머지 PR body 또는 follow-up commit 에서 checklist.md L128-131 섹션에 다음 2 라인 추가:
- `- **[W3] ci.yml#go-check fork PR 게이트** (Sec carry-over) — public repo + sudo go test host docker.sock 접근. 본 PR scope 밖 (single-concern: routing label).`
- `- **[W3] bare-host runner 등록 해제** (사용자 SSH 작업) — ci.yml routing 후 bare-host 0 routing 이지만 다른 workflow 에서 dead reference 방지.`

이는 PR-5 의 single-concern 자체에는 영향 없으나 (4 라인 diff 변경 없음), 미래 reader 의 carry-over 추적성 보호 — checklist 가 phase 진입의 single source of truth 이므로.

## 결론

PR-5 는 본 phase 의 single-concern 카논을 가장 정밀하게 적용한 사례 (PR-170 의 4 DEBT 묶음 single-concern 예외와 대비됨 — PR-170 spec L29 명시). 4 라인 routing 변경이 PR-170 fold-in 으로 선행 해소된 step-level 부채 4건 (services block / testcontainers-go / jq / docker.sock build) 위에 안전하게 얹힘. fold-in 욕구 (composite action / fork 게이트 / RUNNERS_NET regex) 는 모두 carry-over 명시.

**머지 가능 (admin-skip 만료 시점에도 자체 ALL pass 예상)**.

**조건부 후속**: checklist.md L128-131 에 W3 carry-over 2건 (fork 게이트 + bare-host 등록 해제) 추가하여 spec ↔ checklist 5/5 일치 회복. PR-5 자체 머지 차단 조건은 아님 — follow-up commit (또는 PR body changelog) 으로도 충분.

**Phase 23 진입 시 우선순위**: composite action 추출 (Arch-HIGH-1) 을 첫 task 로 — PR-5 머지 후 ci.yml + e2e-stubbed.yml 양쪽에서 60+ 라인 보일러플레이트 동시 active 상태 확대. Custom Image Option A 보다 선행 가능 (independent change, image migration 의존 없음).

## 카논 ref

- 부모 plan: `../checklist.md`
- PR-5 spec: `../pr-5-ci-runs-on.md`
- PR-170 review (composite action escalate 출처): `../reviews/PR-170-arch.md`
- PR-168 spec drift 패턴: `../pr-4-runner-cache.md` (In-flight Spec drift 섹션)
- single-concern 카논: `memory/feedback_branch_pr_workflow.md`
- 4-agent 강제 정책: `memory/feedback_4agent_review_before_admin_merge.md`
