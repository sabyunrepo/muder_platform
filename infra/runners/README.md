# `infra/runners/` — Phase 22 Runner Pool

myoung34/github-runner 4 컨테이너 ephemeral pool. PR-164 fix를 넘어 runner workspace ↔ dev workspace 동거 함정 자체를 격리.

> **Spec**: `docs/superpowers/specs/2026-04-28-phase-22-runner-containerization-design.md`

## Bootstrap (최초 1회)

1. fine-grained PAT 발급 (`.env.example` 주석 참조).
2. `cp .env.example .env`.
3. `.env`에 `ACCESS_TOKEN`, `REPO_URL`, `DOCKER_GID` 채우기.
   - macOS: `DOCKER_GID=$(stat -f '%g' /var/run/docker.sock)`
4. `docker compose up -d`.
5. GitHub Settings → Actions → Runners → 4 row idle 확인.

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
