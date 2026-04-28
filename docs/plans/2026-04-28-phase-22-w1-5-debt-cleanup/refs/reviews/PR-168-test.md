---
pr: 168
reviewer: test
title: "PR-168 — 테스트/검증 가능성 리뷰"
branch: chore/w1-5-runner-cache
base: main
review_date: 2026-04-29
files_reviewed:
  - .github/workflows/e2e-stubbed.yml
  - infra/runners/docker-compose.yml
  - .claude/plugins/compound-mmp/hooks/test-compound-plan-dry-run.sh
---

# PR-168 테스트/검증 가능성 리뷰

## 요약 (200자 이내)

shellcheck SC2034 fix는 41/41 self-test 통과 확인. Stop hook systemMessage 스키마 fix(PR-169 fold-in)는 로컬 수동 검증만 가능. 캐시 효과 측정 자동화 없음, RUNNERS_NET 실패 path 테스트 없음, `docker run` 무결성 미보장(set -e 없음), fork PR skip 자동 assertion 없음. 5건의 갭이 W1.5 후속 PRs에서 보강 필요.

---

## Findings

### T-1 [HIGH] 캐시 효과 측정 자동화 부재

**위치**: `.github/workflows/e2e-stubbed.yml` — `Install Playwright browsers` step  
**갭**: 1st run vs 2nd run timing 비교가 전혀 없음. `pnpm exec playwright install` 소요 시간을 측정하거나 캐시 hit/miss를 판별하는 step이 없다. 캐시 볼륨 효과를 주장하지만 그린 CI 이후에도 실제로 `playwright-cache` volume이 동작하는지 확인 불가.  
**회귀 가능성**: `PLAYWRIGHT_BROWSERS_PATH` 환경변수가 컨테이너 내부에서 인식 안 될 경우 — 예: `myoung34` 이미지 업그레이드 시 환경변수 처리 방식 변경 — 캐시가 silently miss 됨.  
**보강 제안**:
```yaml
- name: Playwright cache status
  run: |
    echo "PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH"
    ls -la "$PLAYWRIGHT_BROWSERS_PATH" 2>/dev/null || echo "cache empty (1st run expected)"
    if [ -d "$PLAYWRIGHT_BROWSERS_PATH/chromium-"* ] 2>/dev/null; then
      echo "CACHE_HIT=true" >> "$GITHUB_ENV"
    fi
```
W1.5 PR-5 (ci.yml 전환) 진행 전 본 step을 추가하여 2nd run에서 `CACHE_HIT=true` 확인 권고.

---

### T-2 [HIGH] `docker run` 실패 무시 — set -e 부재

**위치**: `.github/workflows/e2e-stubbed.yml` L109~126 (`Start postgres + redis` run block)  
**갭**: GHA `run:` block은 기본적으로 `set -e`가 없음. `sudo docker run -d ... postgres:17-alpine` 이 실패해도 다음 `docker run redis` 명령으로 진행된다. 결과적으로 health loop에서 pg_health="starting" 반복 후 30초 타임아웃으로 실패하지만, 실제 원인(image pull 실패, 권한 오류 등)이 즉시 드러나지 않아 디버깅 지연.  
**회귀 가능성**: 이미지 다이제스트 고정(`postgres:17-alpine`) 이 아닌 floating tag 사용 중. myoung34 이미지 업그레이드 시 `pull_policy: never`와 무관한 base image 변경은 영향 없지만, `postgres:17-alpine`에 breaking 변경 발생 시 이 경로가 조용히 실패.  
**보강 제안**: `run:` block 첫 줄에 `set -euo pipefail` 추가. `docker run` 직후 컨테이너 존재 여부 즉시 확인:
```bash
set -euo pipefail
# ... docker run postgres ...
sudo docker inspect "$PG_NAME" --format '{{.State.Status}}' || { echo "::error::PG container not created"; exit 1; }
```

---

### T-3 [MEDIUM] RUNNERS_NET 검출 실패 path 테스트 없음

**위치**: `.github/workflows/e2e-stubbed.yml` L96~101  
**갭**: `RUNNERS_NET=$(sudo docker network ls ... | grep -E '(^|_)runners-net$' | head -1)` 이 빈 결과를 반환하면 `exit 1`로 fast-fail하는 구조는 있음. 하지만 이 실패 path를 CI에서 자동으로 검증하는 테스트가 없다. 호스트 환경 변화(runner 재배포 시 네트워크 이름 변경, compose project name 변경 등)에서 어떻게 fail-fast 하는지 검증 불가.  
**회귀 가능성**: Phase 22 W3의 containerized 전환 이후 `compose project name`이 바뀌거나 사용자가 `docker compose down && up`을 다른 디렉토리에서 실행하면 `runners-net`이 아닌 새 이름으로 네트워크가 생성될 수 있음. 정규식 `(^|_)runners-net$`는 이를 잡지만 새 네트워크 이름이 이 패턴과 맞지 않으면 조용히 통과.  
**보강 제안**: `infra/runners/` 에 bash unit test 추가:
```bash
# test-network-detection.sh
# mock docker network ls output — 다양한 prefix 시나리오 커버
assert_detected "runners-net" "runners-net"
assert_detected "infra-runners_runners-net" "infra-runners_runners-net"
assert_not_detected "myrunners-net"  # 이름 앞에 다른 문자열
```

---

### T-4 [MEDIUM] fork PR skip 자동 assertion 부재

**위치**: `.github/workflows/e2e-stubbed.yml` L36 (`if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.fork == false`)  
**갭**: fork PR 게이트가 `e2e` job과 `merge-reports` job 양쪽에 일관되게 적용되어 있음(정상). 그러나 이 게이트가 실제로 fork PR에서 skip을 발동하는지 자동으로 검증하는 assertion이 없다. `.github/workflows/ci.yml` 의 4개 job은 `fork == false` 게이트 없음 — cache volume을 사용하지 않아 현재는 무방하나 W1.5 PR-5(ci.yml containerized 전환) 이후에는 동일한 위험 발생.  
**회귀 가능성**: PR-5 머지 시 ci.yml이 `[self-hosted, containerized]`로 전환되면 fork PR에 대해 cache poisoning 위험이 ci.yml로도 확장됨. 게이트 없는 채로 머지되면 보안 회귀.  
**보강 제안**: PR-5 spec에 fork PR 게이트 요구사항 명시. GitHub Actions에서 `workflow_dispatch`로 fork PR 시뮬레이션은 불가하지만, `if:` 조건 자체를 별도 step으로 추출하여 matrix variable과 함께 comment-level assertion 추가 권고.

---

### T-5 [MEDIUM] `docker compose config` schema 검증 미실시

**위치**: `infra/runners/docker-compose.yml`  
**갭**: 파일 변경에 대한 자동화된 schema 검증이 없다. 로컬에서 `docker compose -f infra/runners/docker-compose.yml config`를 실행하면 `.env` 파일 부재로 실패함(env_file: .env 참조). CI에서는 이 파일이 테스트되지 않는다.  
**회귀 가능성**: 향후 runner 서비스 추가(runner-5 등) 또는 volume 정의 변경 시 오타/문법 오류가 배포 시점까지 발견되지 않음.  
**보강 제안**: `ci-hooks.yml` 또는 별도 workflow에 schema 검증 step 추가:
```yaml
- name: Validate docker-compose.yml
  run: |
    # stub env for CI validation only
    DOCKER_GID=999 docker compose \
      -f infra/runners/docker-compose.yml \
      --env-file /dev/null \
      config --quiet
```
현재 `--env-file /dev/null`도 `env_file: .env` 참조 때문에 실패. `env_file`을 optional로 변경하거나 CI용 `.env.example` fixture 추가 필요.

---

### T-6 [LOW] 서비스 health check 검증의 자동 assertion 부재

**위치**: `.github/workflows/e2e-stubbed.yml` L133 (`Both services healthy after ${i}s` 로그)  
**갭**: "Both services healthy after Ns" 로그는 사람이 artifact를 열어 확인해야 한다. health check 실패 시 `exit 1`로 fail-fast 하는 구조는 있으나, 실제 healthcheck timeout 값 변경(e.g. `--health-retries` 감소) 또는 image 변경으로 인한 startup 지연 발생 시 회귀를 잡는 assertion이 없다.  
**회귀 가능성**: `myoung34/github-runner` 이미지 업그레이드로 컨테이너 내부 cgroup 설정이 변경되거나 `postgres:17-alpine` → `postgres:18-alpine` 전환 시 startup latency 증가 가능.  
**보강 제안**: health loop 이후 즉시 connection test step 추가:
```yaml
- name: Verify DB connection
  run: |
    sudo docker exec "$PG_NAME" psql -U mmp -d mmp_e2e -c "SELECT 1" 
    sudo docker exec "$REDIS_NAME" redis-cli ping | grep -q PONG
```
현재 migrations step이 사실상 DB connection 검증 역할을 하고 있으나 명시적 separation이 디버깅에 유리.

---

### T-7 [LOW] shellcheck SC2034 fix — 검증 완료

**위치**: `.claude/plugins/compound-mmp/hooks/test-compound-plan-dry-run.sh`  
**상태**: `TEMPLATE` 변수 제거로 SC2034 해소. 로컬 실행 결과: **41/41 PASS**. `ci-hooks.yml`의 `shellcheck` job과 `hook-tests-ubuntu`/`hook-tests-macos` job 모두 이 파일을 커버하므로 CI에서 회귀 방어 완비.  
**잔여 갭 없음**.

---

### T-8 [LOW] Stop hook systemMessage — 로컬 수동 검증만 가능

**위치**: `.claude/plugins/compound-mmp/hooks/stop-wrap-reminder.sh`  
**갭**: Stop event의 `systemMessage` 출력이 실제 Claude Code Stop event에 적용되는지 자동화된 검증 경로 없음. `hookSpecificOutput` 필드가 아닌 `systemMessage`를 사용하도록 PR-169에서 수정되었으나, Claude Code의 Stop hook 스키마 파싱 동작은 로컬 manual 테스트로만 확인 가능.  
**회귀 가능성**: Claude Code CLI 업그레이드 시 Stop hook 스키마가 변경될 경우 silent 무시.  
**보강 제안**: `test-stop-wrap-reminder.sh` fixture 작성 — `DIFF_LINES` 임계값 조작으로 출력 JSON의 `systemMessage` 키 존재 여부 assertion:
```bash
output=$(COMPOUND_WRAP_MIN_LINES=1 bash stop-wrap-reminder.sh 2>/dev/null || true)
echo "$output" | jq -e 'has("systemMessage")' >/dev/null
```

---

## W1.5 신규 PR 등록 권고

다음 보강 작업은 기존 PR로 fold-in이 어려워 별도 PR 권고:

| 우선순위 | 작업 | 적합 PR |
|---|---|---|
| HIGH | `docker run` set -e 추가 + 컨테이너 생성 즉시 검증 | PR-168 fold-in commit 권고 |
| MEDIUM | Playwright cache status step 추가 | PR-168 fold-in 또는 PR-5 진입 전 추가 |
| MEDIUM | fork PR 게이트 — ci.yml PR-5 spec에 요구사항 명시 | W1.5 PR-5 체크리스트에 추가 |
| LOW | `docker compose config` 검증 — `.env.example` fixture | W1.5 별도 hygiene PR (PR-7 후보) |
| LOW | `test-stop-wrap-reminder.sh` fixture | W1.5 PR-1 carry-over 또는 별도 |

---

## 카논 ref

- PR-168 4-agent 리뷰: `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/reviews/PR-168.md`
- PR-4 상세: `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-4-runner-cache.md`
- W1.5 체크리스트: `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/checklist.md`
- 4-agent review 강제: `memory/feedback_4agent_review_before_admin_merge.md`
