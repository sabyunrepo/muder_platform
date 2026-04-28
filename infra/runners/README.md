# `infra/runners/` — Phase 22 Runner Pool

myoung34/github-runner 4 컨테이너 ephemeral pool. PR-164 fix를 넘어 runner workspace ↔ dev workspace 동거 함정 자체를 격리.

> **Spec**: `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md`

## ⚠️ PAT Blast Radius (반드시 읽고 운영)

이 PAT는 **`Administration: Read and write`** 권한을 가집니다 — runner 등록 endpoint(`POST /repos/{owner}/{repo}/actions/runners/registration-token`)에 GitHub가 강제하는 최소 scope입니다. 그러나 동일 권한으로 다음도 가능:

- repo 삭제 / ownership 이전
- default branch 변경
- **branch protection 우회** (`feedback_branch_pr_workflow.md` main 보호 정책 무력화)
- collaborator/team 관리
- webhook 변조

**완화 절차 (필수)**:

1. **1Password CLI 패턴** — `.env`를 plaintext로 디스크에 두지 말 것. 1Password에 PAT 저장 후:
   ```bash
   op run --env-file=.env.template -- docker compose up -d
   ```
   `.env.template`은 `ACCESS_TOKEN=op://Personal/mmp-runner-pat/credential` 형태.
2. **30일 회전** — admin-skip 정책 종료(2026-05-01) 전까지. 6개월 표준은 정책 만료 후 적용.
3. **PAT 노출 금지** — 스크린샷, PR description, log, Slack 모두. 노출 발견 시 즉시 revoke + repo audit log 검토.

## Bootstrap (최초 1회)

1. fine-grained PAT 발급 (`.env.example` 주석 참조).
2. `cp .env.example .env`.
3. `.env`에 `ACCESS_TOKEN`, `REPO_URL`, `DOCKER_GID` 채우기.
   - macOS: `DOCKER_GID=$(stat -f '%g' /var/run/docker.sock)` 결과를 직접 입력 (env 파일은 shell expansion 안 됨)
   - **검증**: `cat .env | grep DOCKER_GID` 결과가 숫자(보통 `0` 또는 `1`)인지 확인. 빈 문자열이면 group_add silent fail → docker.sock permission denied.
4. **PAT scope 검증** (boot 전 안전 확인):
   ```bash
   curl -sH "Authorization: Bearer $(grep ACCESS_TOKEN .env | cut -d= -f2)" \
     https://api.github.com/repos/sabyunrepo/muder_platform/actions/runners | jq '.total_count'
   ```
   숫자(0 이상) 반환 시 정상. `401`/`404`이면 PAT 또는 Resource owner 잘못.
5. `docker compose up -d`.
6. GitHub Settings → Actions → Runners → 4 row idle 확인.

## Troubleshooting (PAT 만료 detection)

`restart: always` + entrypoint registration fail → 32초 간격 무한 restart (max-retry 없음). detection:

```bash
# 5분 윈도우에서 token request fail 카운트
docker compose logs --since=5m runner-1 | grep -c 'Token request failed'
# 5회 이상이면 PAT 만료/취소 의심 → .env ACCESS_TOKEN 교체 + docker compose up -d --force-recreate

# 또는 docker.sock permission denied 음성 확인
docker compose logs runner-1 --tail 50 | grep -i 'permission denied'
# hit 있으면 DOCKER_GID 잘못 → .env 재확인 + docker compose up -d --force-recreate
```

## Register (재등록)

`EPHEMERAL=true`로 job 완료마다 자동 deregister + restart로 자동 re-register. 수동 개입 불필요. 강제 재등록은:

```bash
docker compose restart runner-1   # 단일
docker compose restart            # 전체
```

## Rotate PAT (6개월 주기)

1. GitHub에서 신규 PAT 발급 (구 PAT는 expired 처리 전까지 유지).
2. `.env`의 `ACCESS_TOKEN` 교체.
3. `docker compose up -d --force-recreate` (env 다시 로드).
4. GH UI에서 4 runner re-register 확인.
5. 구 PAT revoke.

## Decommission (Phase 22 완료 후 또는 운영 중단)

1. GH UI에서 모든 runner remove.
2. `docker compose down --volumes` (named volume 같이 삭제).
3. `infra/runners/.env` 안전 삭제 (PAT 포함).

## 운영 기록

- 2026-04-28: Phase 22 W1 부팅 (PR-1)
- 2026-XX-XX: W4 host runner deregister (별도 운영 노트로 기록)
