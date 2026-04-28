---
pr: 168
title: "chore(w1-5): Runner Cache Volume + service container init + RUNNERS_NET + Stop hook schema"
branch: chore/w1-5-runner-cache
base: main
review_type: security
reviewer: security-agent
review_date: 2026-04-29
commits_reviewed: 9 (c3f68c5..b320681)
files_reviewed:
  - infra/runners/docker-compose.yml
  - .github/workflows/e2e-stubbed.yml
  - .claude/plugins/compound-mmp/hooks/stop-wrap-reminder.sh
  - .claude/plugins/compound-mmp/hooks/test-compound-plan-dry-run.sh
  - infra/runners/README.md
verdict: "MEDIUM 3건 — 머지 차단 아님, 단 MEDIUM-1 은 PR 머지 전 제거 권고"
---

# PR-168 Security Review

## Context

이 리뷰는 원본 4-agent 리뷰(`refs/reviews/PR-168.md`, 커밋 c3f68c5 기준)의 **후속**이다. 해당 리뷰의 HIGH 5건이 후속 커밋(c8a6110 fold-in + 542497b/6aa013c/6d5a71d/4b21eba/f300b5f/b320681)에서 부분 해소됐는지 검증하고, 새 커밋이 도입한 추가 공격 면을 평가한다.

## 원본 HIGH 5건 해소 상태

| ID | 설명 | 현재 상태 |
|---|---|---|
| H-1 | Fork PR cache poisoning | **FIXED** — `if: github.event_name != 'pull_request' \|\| github.event.pull_request.head.repo.fork == false` e2e + merge-reports 양쪽 추가 (라인 36, 346) |
| H-2 | setup-go/setup-node GHA cache 충돌 | **FIXED** — `GOMODCACHE`/`PNPM_STORE_PATH`/`GOCACHE` 제거. `PLAYWRIGHT_BROWSERS_PATH` + `RUNNER_TOOL_CACHE` 만 유지 |
| H-3 | ci.yml 적용 범위 밖 | **OUT OF SCOPE (acknowledged)** — pr-4-runner-cache.md 에 "W1.5 PR-5 별도" 명시. 보안 gap 아님 (ci.yml 은 shared volume 미사용) |
| H-4 | 격리 원칙·race-safe 주장 검증 부재 | **ADDRESSED** — pnpm-cache/go-cache 제거로 concurrent write race 주요 경로 소멸. H-4 결정 문서화 완료 |
| H-5 | Option A (Custom Image) 정당화 부족 | **ADDRESSED** — Phase 23 entry 명시, pr-4-runner-cache.md H-5 섹션 기록 |

## 신규 커밋 도입 공격 면

### MEDIUM-1 [Info Disclosure] Diagnostic Step — sudo NOPASSWD 능력 공개 CI 로그에 영구 기록
- **위치**: `.github/workflows/e2e-stubbed.yml` lines 57-76 (커밋 6aa013c)
- **위험도**: MEDIUM
- **시나리오**: 퍼블릭 레포의 CI 로그는 누구나 읽을 수 있다. Diagnostic step이 `sudo -n true && echo "sudo NOPASSWD OK"` 를 실행하고 결과를 plain text로 출력한다. 공격자가 CI 로그를 읽으면 "이 runner는 passwordless sudo를 가진다"는 사실을 정확히 알게 된다. 이는 runner 침해(supply chain, malicious same-repo PR) 후 권한 상승 계획에 직접 활용될 수 있는 정보다. 또한 `HOME`, `PATH`, `USER`, docker.sock GID 등도 노출되어 공격자가 runner 환경을 사전 매핑할 수 있다.
- **추가 맥락**: `sudo NOPASSWD` 자체는 이번 PR이 도입한 것이 아니다 (myoung34/github-runner 이미지가 기본 제공). 그러나 이 사실을 공개 CI 로그에 명시적으로 확인·기록하는 것은 불필요한 정보 제공이다.
- **권고**: PR 머지 전 Diagnostic step 제거 또는 `if: false` 비활성화. 디버그 목적이라면 별도 수동 workflow_dispatch only job으로 분리.
  ```yaml
  # 제거 또는:
  - name: Diagnostic — step user/group/docker
    if: false   # 임시 비활성 (디버그 완료 후 삭제)
  ```

### MEDIUM-2 [Volume Persistence] 공유 write volume — 장기 toolchain 오염 경로
- **위치**: `infra/runners/docker-compose.yml` lines 88-89 (hostedtool-cache, playwright-cache)
- **위험도**: MEDIUM
- **시나리오**: `hostedtool-cache` 와 `playwright-cache` 는 4 runner가 공유하는 named volume이다. Fork PR 게이트(H-1)로 외부 contributor는 차단되지만, **레포에 write access를 가진 same-repo collaborator 가 malicious PR을 push하면** 게이트를 통과한다. 해당 PR의 CI job이 `hostedtool-cache:/opt/hostedtoolcache` 에 접근해 node/go 바이너리를 변조하면, 이후 모든 runner job이 변조된 toolchain을 사용하게 된다. EPHEMERAL=true 로 runner 컨테이너가 재시작해도 volume은 유지되므로 오염이 지속된다.
- **현재 완화**: H-1 fork gate + README의 `docker volume rm playwright-cache hostedtool-cache` 수동 정화 가이드. same-repo collaborator trust level 의존.
- **권고**: README의 보안 섹션에 "hostedtool-cache 는 toolchain 바이너리(node, go) 포함 — 오염 의심 시 즉시 볼륨 정화" 경고 추가. Phase 23에서 Custom Image(Option A)로 전환 시 자연 해소.
  ```bash
  # README에 추가 (긴급 대응):
  # 의심스러운 same-repo PR 머지 후: docker volume rm playwright-cache hostedtool-cache && docker compose up -d
  ```

### MEDIUM-3 [Info Disclosure] E2E DB 평문 자격증명 워크플로우 로그 노출
- **위치**: `.github/workflows/e2e-stubbed.yml` lines 112-115, 170, 246-250 (커밋 542497b)
- **위험도**: MEDIUM (낮은 실제 위험, 원칙 위반)
- **시나리오**: `POSTGRES_PASSWORD=mmp_e2e`, `password=mmp_e2e`, `PGPASSWORD=mmp_e2e` 가 워크플로우 정의에 하드코딩되어 퍼블릭 레포에서 누구나 읽을 수 있다. CI 로그에도 일부 출력될 가능성 있다. 실제 위험은 낮다 — 이 자격증명은 수명이 짧은 E2E 전용 컨테이너(`e2e-pg-{run_id}-...`)에만 사용되고, 컨테이너는 job 완료 후 `docker rm -f` 로 정리된다. 단, runners-net 브리지에 접근 가능한 다른 컨테이너가 있다면 해당 자격증명으로 E2E DB 접근이 가능하다.
- **권고**: 실제 위험이 낮아 이번 PR에서 즉시 수정 불필요. 단, `PGPASSWORD` 는 `-e` 플래그로 전달하는 현행 방식(프로세스 테이블 노출 회피)을 유지하는 것이 올바르다. GitHub Secret으로 이동은 E2E fixture DB이므로 과잉 — LGTM on approach.

## 낮은 심각도 관찰 (LOW / FYI)

### LOW-1 [Defense-in-Depth] RUNNERS_NET 동적 검출 — 네트워크 스푸핑
- **위치**: `e2e-stubbed.yml` line 96
- **분석**: `docker network ls --format '{{.Name}}' | grep -E '(^|_)runners-net$' | head -1` 로 검출. 공격자가 `bad_runners-net` 등의 이름으로 네트워크를 생성한다면 regex `(^|_)runners-net$` 이 `bad_runners-net` 을 매칭할 수 있다. 단, Docker 네트워크를 생성하려면 호스트에 대한 docker.sock 접근이 필요하다 — 즉, 이미 runner 컨테이너를 침해했어야 한다. 스푸핑 성공 시 postgres/redis 컨테이너가 공격자 제어 네트워크에 올라가 DNS/트래픽 가로채기 가능. 현실적 가능성은 낮음.
- **권고**: 단순 방어 강화: `grep -E '^(runners-net|infra-runners_runners-net)$'` 로 허용 목록 명시. 또는 PR-4-runner-cache.md H-4 결정에 이 분석 추가.

### LOW-2 [Operational] Diagnostic Step 영구 잔존 → CI 시간 낭비
- **위치**: `e2e-stubbed.yml` lines 57-76
- **분석**: 디버그용 step이 MEDIUM-1과 별개로 4 shard × 각 run에서 불필요하게 실행된다. 보안 이슈와 별개로 운영 기술 부채.
- **권고**: MEDIUM-1과 함께 제거.

### LOW-3 [Disk Quota] Cache volume 크기 제한 없음 (M-SEC-1 carry-over)
- **위치**: `docker-compose.yml` lines 88-89 (`playwright-cache: {}`, `hostedtool-cache: {}`)
- **분석**: 원본 리뷰 M-SEC-1. 이번 PR에서 미수정. local driver 기본값 — 호스트 디스크 전체 사용 가능. DoS 잠재성.
- **권고**: Phase 23 진입 시 driver_opts size 제한 추가. 이번 PR 범위 아님.

## LGTM 항목

- **Fork PR 게이트 구현 정확성**: `github.event.pull_request.head.repo.fork == false` 조건이 e2e job (line 36)과 merge-reports job (line 346) 양쪽에 일관되게 적용됨. GitHub 공식 expression syntax 준수.
- **RUNNERS_NET 주입 안전성**: `"$RUNNERS_NET"` 이중 따옴표 인용 일관 (lines 110, 121). Docker 네트워크 이름은 `[a-zA-Z0-9_.-]` 만 허용 — shell metachar 삽입 불가.
- **PG_NAME/REDIS_NAME 구성 안전성**: `e2e-pg-{github.run_id}-{browser}-{shard}` 패턴. run_id는 서버 생성 정수, browser/shard는 workflow-defined enum — 공격자 제어 불가.
- **PGPASSWORD 전달 방식**: `docker exec -e PGPASSWORD=mmp_e2e` — 환경변수로 전달하여 프로세스 테이블(`/proc/<pid>/cmdline`) 노출 회피. 올바른 접근.
- **SC2034 shellcheck fix**: `TEMPLATE` 미사용 변수 제거. 기능적 변화 없음, 린트 정확성 개선.
- **Stop hook schema fix**: `hookSpecificOutput.additionalContext` → `systemMessage` 로 정정. Stop event 스키마 준수.
- **hostedtool-cache 명시 (`RUNNER_TOOL_CACHE`)**: L-ARCH-1 해소. setup-* actions가 정확한 경로에 toolchain 저장.
- **.env.example `ACCESS_TOKEN=` 비어 있음**: 실제 PAT 미커밋. `.gitignore` 에 `.env` 포함.

## 요약 (250 단어 이내)

PR-168 현재 브랜치는 원본 4-agent 리뷰의 HIGH 5건 중 4건을 명확히 해소하고 1건(H-3)을 적절히 범위 밖으로 이관했다. 새로 도입된 보안 이슈는 다음과 같다.

**MEDIUM-1**: Diagnostic step이 퍼블릭 CI 로그에 `sudo NOPASSWD` 능력과 runner 환경 상세를 영구 기록한다. 즉각적 침해 벡터는 아니지만 공격자의 사전 정보 수집에 활용될 수 있다. PR 머지 전 제거 권고 (1줄: step 삭제 또는 `if: false`).

**MEDIUM-2**: 공유 write volume(`hostedtool-cache`)을 통한 toolchain 오염 경로가 존재한다. Fork gate로 외부 공격자는 차단되나 same-repo write access 보유자가 악의적으로 활용 가능하다. 현실적 위험은 낮으며 Phase 23 Custom Image 전환 시 자연 해소.

**MEDIUM-3**: E2E DB 평문 자격증명이 워크플로우 파일에 하드코딩되어 있으나, 단명 격리 컨테이너 대상으로 실질 위험은 낮다. 현행 `docker exec -e` 방식은 프로세스 테이블 노출을 피하는 올바른 접근.

**머지 차단 여부**: MEDIUM-1 만 머지 전 수정 권고. MEDIUM-2/3과 LOW 항목은 이번 PR 차단 사유 아님. MEDIUM-1 제거 후 보안 관점 merge-ready.

## 카논 ref

- `memory/feedback_4agent_review_before_admin_merge.md`
- `memory/project_ci_admin_skip_until_2026-05-01.md`
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/reviews/PR-168.md` (원본 4-agent)
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-4-runner-cache.md`
