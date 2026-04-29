# Custom Runner Image GHCR 첫 push 절차 + 운영 카논

> Phase 23 (`memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md`)에서 정착. self-hosted runner pool용 Custom Image의 GHCR 첫 push + Public visibility + GITHUB_TOKEN 패턴 단일 source.

## 정공 패턴

### Token 선택

`secrets.GITHUB_TOKEN` 사용. 별도 PAT 발급 0건:

```yaml
permissions:
  contents: read
  packages: write   # ← 이 1줄로 GITHUB_TOKEN에 GHCR push 권한 부여
```

**`secrets.ACCESS_TOKEN` (runner 등록용 PAT) 재사용 금지**:
- Blast radius 분리 (`Administration: Read and write` 권한 GHCR push에 과함)
- PAT rotation 시 양쪽 동시 영향
- workflow secrets 등록 부담

### Visibility = Public

- 사용자 host `docker compose pull` 인증 0건 (별도 read-only PAT 발급 X)
- image 내용물은 `infra/runners/Dockerfile`이 git에 공개 — 어차피 노출
- secret은 Dockerfile에 들어가지 않으니 risk 낮음

### Tag 전략

```yaml
tags: |
  ghcr.io/<owner>/<image>:latest        # mutable, 사용자 host pull
  ghcr.io/<owner>/<image>:${{ github.sha }}   # immutable, rollback용
```

### Cache scope 분리

```yaml
cache-from: type=gha,scope=runner-image
cache-to: type=gha,mode=max,scope=runner-image
```

다른 workflow의 GHA cache namespace와 분리 (release.yml `scope=server` align).

## GHCR 첫 push 후 1회 운영 절차

push 첫 회 성공 후 사용자 1회 작업 (브라우저):

1. `https://github.com/<owner>?tab=packages` → 신규 package 등장 확인
2. package settings → "Manage Actions access" → 본 repo add (GITHUB_TOKEN 향후 push 권한)
3. visibility → Public 변경

## 사용자 host 재배포 절차

```bash
ssh <user>@<host>
cd <repo>/infra/runners
git pull
docker compose pull
docker compose up -d
docker compose ps   # 4 service Started
```

`pull_policy: always` 적용 시 `up -d`만으로도 자동 pull.

## Rollback (재배포 후 fail 시)

```bash
git revert <Phase-N commit>   # compose.yml만 되돌림
docker compose pull
docker compose up -d
# 이전 GHCR sha tag 또는 myoung34 base SHA로 ~5분 내 복귀
```

## chicken-egg 회피 (sister 카논)

`memory/feedback_runner_bootstrap.md` — build-runner-image.yml `runs-on: ubuntu-latest` 카논. self-hosted runner pool down 시 image build 불능 회피.

## 카논 ref

- `.github/workflows/build-runner-image.yml` (Phase 23 정착)
- `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md` § 4.3
- `infra/runners/README.md` (사용자 host 운영 절차)
- `infra/runners/.env` (ACCESS_TOKEN — GHCR push와 분리)
- Phase 23 P0-2 follow-up (Manage Actions access)
