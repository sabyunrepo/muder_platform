---
pr: 170
reviewer: security (sonnet-4-6)
date: 2026-04-29
findings: {high: 0, medium: 3, low: 3}
verdict: conditional
---

# PR-170 Security Review

## Summary

PR-170은 containerized runner 환경 호환성을 위한 4개 DEBT 수정 PR이다. 직접적인 HIGH 위험은 없으나, `sudo docker` 사용 범위 확대에 따른 구조적 공격 면 3건(MEDIUM)과 방어 강화 권고 3건(LOW)이 있다. MEDIUM-1(RUNNERS_NET 네트워크 스푸핑)만 경미한 수정으로 해소 가능하며 **머지 차단 사유는 아님**. 전체적으로 PR-168 패턴의 일관된 적용이고 보안 기본선은 유지된다.

---

## Findings

### MEDIUM-1 [Network Spoofing] RUNNERS_NET 동적 검출 — 악성 네트워크 명 매칭

**요약**: `ci.yml` 의 `RUNNERS_NET` 검출 regex `(^|_)runners-net$` 가 `bad_runners-net` 처럼 `_runners-net`으로 끝나는 임의 네트워크 이름을 매칭한다.

**Evidence**:
- `ci.yml` line 44: `RUNNERS_NET=$(sudo docker network ls --format '{{.Name}}' | grep -E '(^|_)runners-net$' | head -1)`
- Python 검증: `bad_runners-net` → `MATCH`, `evil-runners-net` → no match, `runners-net2` → no match
- `infra/runners/docker-compose.yml` line 96: 실제 네트워크 이름은 `runners-net` (고정)

**영향**: 공격자가 이미 `docker.sock`을 통해 호스트에 접근한 경우 `bad_runners-net`이라는 이름의 네트워크를 생성하면, `head -1`이 알파벳순으로 이 네트워크를 먼저 선택할 수 있다. 성공 시 CI job의 postgres/redis 컨테이너가 공격자 제어 네트워크에 배치되어 DNS/트래픽 가로채기 가능. 단, docker.sock 접근이 이미 runner 침해를 전제로 하므로 실질 위험은 낮음. PR-168 `e2e-stubbed.yml`의 동일 패턴에서 LOW-1로 지적된 사안이 `ci.yml`로 확산됨.

**권고** (follow-up, 머지 차단 아님):
```yaml
# 허용 목록 방식으로 강화:
RUNNERS_NET=$(sudo docker network ls --format '{{.Name}}' | grep -E '^(runners-net|infra-runners_runners-net)$' | head -1)
```
Phase 23 `.github/actions/start-services/action.yml` 추출 시 반드시 적용.

---

### MEDIUM-2 [Forensic Gap] gitleaks artifact upload 비활성 — 실제 유출 발견 시 증거 보존 불가

**요약**: `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false`로 설정하여 gitleaks scan artifact가 생성되지 않는다. 스캔 자체는 동작하지만, LEAK 감지 시 CI artifact로 접근 가능한 상세 리포트가 없어 incident response 속도가 저하된다.

**Evidence**:
- `security-fast.yml` line 70: `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: false`
- 커밋 5be282a: "scan 자체는 SUCCESS, summary 는 GHA job summary 로 표시"
- `GITLEAKS_ENABLE_SUMMARY: true` 는 유지됨 — 요약 정보는 GHA job summary에서 확인 가능

**영향**: 실제 SECRET 유출이 감지될 경우, GHA job summary의 텍스트 요약만으로 어느 커밋의 어느 파일 몇 번째 줄인지 즉시 파악하기 어렵다. gitleaks SARIF/artifact는 줄 번호·커밋 SHA·엔트로피 값을 포함하므로 포렌식에 필수. 현재 임시 완화로 `GITLEAKS_ENABLE_SUMMARY: true`가 보완하고 있으나 상세도 차이가 있다.

**영향 평가**: gitleaks scan 자체가 실행되고 있고 `GITLEAKS_ENABLE_SUMMARY`로 결과가 표시되므로 즉각적 위험은 아님. 단, HIGH severity SECRET이 감지되는 시나리오에서 포렌식 지연 위험.

**권고** (follow-up): Phase 23 Custom Image 완료 후 `GITLEAKS_ENABLE_UPLOAD_ARTIFACT: true` 복원. 현재 상태는 실용적 타협으로 허용.

---

### MEDIUM-3 [Persistence] Trivy scan 이미지 `mmp-server:security-scan` — 미정리 잔존

**요약**: `security-deep.yml`의 Trivy 스캔 후 `mmp-server:security-scan` 이미지를 삭제하는 cleanup step이 없다. 이 이미지는 runner 호스트에 영구 누적된다.

**Evidence**:
- `security-deep.yml` lines 40-45: `sudo docker build -f apps/server/Dockerfile -t mmp-server:security-scan apps/server`
- `security-deep.yml` line 50: `image-ref: 'mmp-server:security-scan'`
- 이미지 삭제 step: 없음 (`if: always()` cleanup 미존재)
- 이전 `docker/build-push-action` 패턴도 이미지 cleanup을 명시하지 않았으므로 신규 도입 위험은 아님

**영향**: `mmp-server:security-scan` 이미지가 매 run마다 덮어쓰기(`-t mmp-server:security-scan` 고정 태그)되어 실질적으로 하나의 이미지만 존재한다. Dangling layer 누적이 발생하지만 보안상 직접 위협은 낮음. 단, 이 이미지가 runner 침해 시 소스코드를 포함한 빌드 아티팩트로 접근 가능해진다. 스케줄 run(`cron: "0 4 * * *"`)으로 매일 1회 실행되므로 지속 누적.

**권고** (follow-up):
```yaml
- name: Cleanup Trivy scan image
  if: always()
  run: sudo docker rmi mmp-server:security-scan 2>/dev/null || true
```

---

## 낮은 심각도 관찰 (LOW)

### LOW-1 [Sudo Scope] `sudo docker` 사용 확대 — ci.yml 신규 도입

**위치**: `ci.yml` lines 44, 47, 54, 56-68, 77-88, 181

**분석**: PR-168에서 `e2e-stubbed.yml`에 도입된 `sudo docker` 패턴이 이번 PR에서 `ci.yml`의 `go-check` job으로 확산된다. `sudo` 사용은 `myoung34/github-runner` 이미지의 기본 NOPASSWD 설정에 의존하며, 이는 PR-168 MEDIUM-1에서 이미 지적된 바 있다 (이번 PR에서 diagnostic step 자체는 없음). 추가 정보 노출 없이 동일 권한 범위 내 사용이므로 실질 위험 증가 없음.

**권고**: Phase 23 Custom Image에서 runner user의 docker group 영구 편입 시 `sudo` 제거 가능. 현재 수준 허용.

### LOW-2 [Database URL] ci.yml GITHUB_ENV에 DATABASE_URL 평문 기록

**위치**: `ci.yml` line 96: `echo "DATABASE_URL=postgres://mmp:mmp_test@${PG_NAME}:5432/mmp_test?sslmode=disable" >> "$GITHUB_ENV"`

**분석**: `GITHUB_ENV`에 `DATABASE_URL`을 기록하면 해당 값이 GHA 로그에 마스킹 없이 출력될 수 있다. 단, `mmp_test` 자격증명은 `.gitleaks.toml` regex allowlist에 포함되어 있으므로 (`postgres://mmp:mmp_test@` 패턴) gitleaks 스캔에서 false positive 없음. 해당 자격증명은 수명이 짧은 격리 컨테이너 전용이며 외부 노출 포트 없음(`-p` 플래그 미사용 확인).

**권고**: 현재 허용. 실제 운영 DB 자격증명이 아니므로 GitHub Secret 이동은 과잉.

### LOW-3 [Supply Chain] Node v20 symlink — `which node` 경로 검증 부재

**위치**: `security-deep.yml` lines 151-155

**분석**: `NODE_BIN=$(which node)` 는 `setup-node@v4`가 PATH에 추가한 경로를 그대로 사용한다. `setup-node` action은 SHA-pinned(`49933ea...` = v4.4.0)으로 고정되어 있어 공급망 공격 위험은 낮다. 그러나 PATH 조작이 가능한 환경에서 `which node`가 예상치 못한 바이너리를 반환하고 이를 `/usr/local/bin/node`에 symlink하면 CodeQL 분석 전체가 변조된 Node를 사용하게 된다. 현실적 위험은 낮으나 이론적 경로 존재.

**방어 강화 옵션**:
```bash
# which 대신 setup-node가 주입하는 경로 직접 참조
NODE_BIN="${RUNNER_TOOL_CACHE}/node/20."*"/x64/bin/node"
```
또는:
```bash
# 버전 검증 추가
node --version | grep -E '^v20\.' || { echo "Unexpected node version"; exit 1; }
```
**권고**: informational. 현재 SHA-pinned action이 충분한 완화 제공.

---

## LGTM 항목

- **컨테이너 이름 유일성 보장**: `ci-go-pg-{run_id}-{run_attempt}`, `ci-go-redis-{run_id}-{run_attempt}` — `github.run_id`는 서버 생성 정수, `github.run_attempt`는 재시도 구분. 동시 실행 충돌 방지 구조 정확.
- **포트 미노출 (ci.yml)**: `docker run`에 `-p` 플래그 없음. postgres/redis가 runners-net 브리지 내부에만 노출되어 호스트 포트를 통한 외부 접근 불가.
- **cleanup if: always() 적용**: `ci.yml` line 178의 cleanup step이 `if: always()`로 실패 시에도 컨테이너 정리됨. Container leak 방지.
- **선제적 cleanup**: `ci.yml` line 54: 시작 전 이전 run 동명 컨테이너를 `docker rm -f`로 제거. 이름 충돌 방지.
- **set -euo pipefail 일관 사용**: `ci.yml`, `security-deep.yml` 모든 multi-line run 블록에서 적용. 중간 오류 시 즉시 실패.
- **harden-runner egress-policy: audit 유지**: 변경된 3개 워크플로우의 모든 job에서 `egress-policy: audit`가 유지됨. block 모드 아니더라도 egress 로깅 보존.
- **CodeQL Node symlink 범위 제한**: `if: matrix.language == 'javascript-typescript'` 조건으로 Go 분석 job에는 symlink 불적용. 최소 권한 원칙 부분 준수.
- **sudo docker build 대안 선택 정당성**: 커밋 메시지 `fd227f9`에 "NodeSource apt repo curl | sudo bash 패턴 (RCE 우려)" 거부 근거 명시. 보안 의식적 결정.
- **gitleaks scan 자체 동작 유지**: artifact 비활성화지만 scan(`GITLEAKS_ENABLE_SUMMARY: true`)은 정상 동작. PR의 시크릿 스캔 게이트 기능은 유지됨.
- **SHA-pinned actions 일관**: 새 step에서도 `actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020`로 SHA-pinned 유지.

---

## 머지 결정

| 등급 | 건수 | 머지 차단 |
|------|------|-----------|
| HIGH | 0 | N/A |
| MEDIUM | 3 | 아님 |
| LOW | 3 | 아님 |

**verdict: conditional** — HIGH 없음. MEDIUM-1/2/3 모두 즉각 머지 차단 사유 아님. Phase 23 Custom Image carry-over 항목(RUNNERS_NET 허용 목록 강화, artifact 복원, Trivy 이미지 cleanup)을 Phase 23 backlog에 반드시 기록하는 조건으로 **보안 관점 merge-ready**.

---

## 카논 ref

- `memory/feedback_4agent_review_before_admin_merge.md`
- `memory/project_ci_admin_skip_until_2026-05-01.md`
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/reviews/PR-168-security.md` (LOW-1 RUNNERS_NET 이슈 원출처)
- `docs/plans/2026-04-28-phase-22-w1-5-debt-cleanup/refs/pr-8-runner-action-compat.md`
