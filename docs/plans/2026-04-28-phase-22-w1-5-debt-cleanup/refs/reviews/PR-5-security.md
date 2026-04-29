---
pr: 5
reviewer: security (sonnet-4-6)
date: 2026-04-29
findings: {high: 0, medium: 0, low: 2}
verdict: pass
---

# PR-5 Security Review

## Verdict: pass

본 PR의 실제 변경은 ci.yml 4개 job의 `runs-on: self-hosted` → `runs-on: [self-hosted, containerized]` 라벨 좁힘 4줄이다. 새로운 공격 면은 도입하지 않는다. 기존 위험(fork PR 게이트 부재, `sudo go test` docker.sock 노출, RUNNERS_NET regex)은 PR-170에서 이미 존재했으며 본 PR이 증폭하지 않는다.

---

## HIGH

없음

---

## MEDIUM

없음

**판단 근거**: 아래 두 항목은 최초 도입이 PR-170임을 확인했으므로 본 PR의 carry-over 명시로 처리한다.

**① `sudo go test` docker.sock 노출** — `go-check` job의 `Run tests` step이 `sudo -E env "PATH=$PATH" go test`로 root 권한 + docker.sock 접근. fork PR 코드가 이 step에서 실행되면 host docker daemon 임의 조작(컨테이너 escape 경로) 가능. **도입: PR-170** (`fix(w1-5): PR-8 — runner third-party action 호환`, `99aa825`). 본 PR는 routing label만 변경하므로 이 step의 존재 여부·권한 모두 PR-170 이전과 동일. **증폭 없음.**

**② fork PR의 악성 Dockerfile RCE** — `docker-build` job이 checkout된 PR ref의 `apps/server/Dockerfile`을 `sudo docker build`로 빌드. fork PR 기여자가 Dockerfile에 임의 명령 삽입 시 runner host에서 RCE 가능. **도입: PR-170** (manual `sudo docker build` fold-in). routing 변경으로 bare-host → containerized runner 전환이 일어나지만, 컨테이너화된 runner도 docker.sock을 공유하므로 호스트 격리 수준은 실질적으로 동일. **증폭 없음.**

두 항목 모두 현재 admin-skip 정책(`project_ci_admin_skip_until_2026-05-01.md`) 하에서는 fork PR이 CI를 통과할 수 없는 구조이므로 실질 위험이 억제되어 있다. 부채 정리 완료 후 admin-skip 만료 전에 반드시 fork PR 게이트를 적용해야 한다.

---

## LOW

### LOW-1 [Network Spoofing] RUNNERS_NET regex — `bad_runners-net` 오매칭 가능

**위치**: `ci.yml` line 44 (`grep -E '(^|_)runners-net$'`)

**분석**: PR-168 `e2e-stubbed.yml` LOW-1, PR-170 MEDIUM-1 carry-over. 본 PR이 이 패턴을 ci.yml에 '확산'하는 것이 아니라 해당 패턴은 PR-170에서 이미 ci.yml에 존재한다. 본 PR은 routing label만 변경하므로 이 line에 대한 직접적 기여 없음.

**권고**: Phase 23 `.github/actions/start-services/action.yml` 추출 시 `^(runners-net|infra-runners_runners-net)$` 허용 목록으로 교체. 현재 docker.sock 접근이 이미 runner 침해를 전제로 하므로 즉각 차단 사유 아님.

### LOW-2 [bare-host runner 잔존] ci.yml 완전 전환 후에도 bare-host runner 다른 workflow 라우팅 가능

**위치**: `/home/sabyun/actions-runner/` (사용자 host)

**분석**: 본 PR 머지 후 ci.yml의 4 job은 containerized runner로만 라우팅된다. 그러나 bare-host runner가 여전히 GitHub에 등록된 상태이므로, `runs-on: self-hosted` label을 사용하는 다른 workflow(또는 미래 추가 workflow)에 의도치 않게 routing될 수 있다. bare-host runner는 격리 없음(EPHEMERAL=false 가능성), 디스크 잔존, 비ephemeral 환경 위험을 가진다.

**권고**: Phase 22 W3에서 bare-host runner 등록 해제 (사용자 SSH 직접 작업). 본 PR scope 밖이므로 즉각 차단 사유 아님.

---

## carry-over 명시

### Phase 22 W3 (조건부 우선 처리)

| ID | 내용 | 우선도 |
|----|------|--------|
| SEC-W3-1 | ci.yml `go-check` + `docker-build` fork PR 게이트 추가 (`if: github.event.pull_request.head.repo.fork == false`) | **admin-skip 만료 전 필수** |
| SEC-W3-2 | bare-host runner 등록 해제 (사용자 SSH) | P1 |

### Phase 23 escalate

| ID | 내용 | 우선도 |
|----|------|--------|
| SEC-23-1 | RUNNERS_NET regex 허용 목록 강화 (Arch-HIGH-1 composite action 추출 시 적용) | P2 |
| SEC-23-2 | runner image에 docker group GID 990 정착 → `sudo go test` / `sudo docker build` `sudo` 제거 | P1 |

---

## 결론

본 PR은 routing label 4줄 변경으로 scope가 극히 좁다. 새로운 보안 위험을 도입하지 않으며, 기존 위험(fork PR 게이트 부재 · docker.sock 노출 · RUNNERS_NET regex)은 모두 PR-170 이전부터 존재하던 carry-over임을 코드 추적으로 확인했다. bare-host runner에서 containerized runner로의 전환은 보안 면에서 EPHEMERAL=true에 의한 잡 격리 향상이라는 긍정적 효과가 있다. **보안 관점 merge-ready (pass).**

---

## 카논 ref

- `memory/feedback_4agent_review_before_admin_merge.md`
- `memory/project_ci_admin_skip_until_2026-05-01.md`
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/reviews/PR-170-security.md` (MEDIUM-1 RUNNERS_NET 원출처)
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-5-ci-runs-on.md` (H-1/H-2/H-3 결정)
