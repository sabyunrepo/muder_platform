# Custom Runner Image CI는 ubuntu-latest로 빌드 (chicken-egg self-bootstrap 회피)

> 본 카논은 Phase 23 (`memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md`)에서 발견된 chicken-egg self-bootstrap pattern의 영구 fix 단일 source.

## 정공

`build-runner-image.yml` 등 **Custom Runner Image build CI**의 `runs-on`은 항상 `ubuntu-latest` (또는 GitHub-hosted runner) 고정. self-hosted runner는 user CI workflow (ci.yml / security-* / e2e-stubbed)에만 사용.

## Why

자기 자신이 빌드하는 image의 runner pool을 build CI에 사용하면 chicken-egg:
- runner pool 일제 down → image build 불능 → GHCR push X → docker compose pull X → bootstrap 영구 lock-out

Phase 23 PR #174 머지 후 사용자 host docker compose down → up 시 `ghcr.io not found`로 실 발현. 옛 myoung34 image 잔존이 fallback이 되어 mitigation됐지만 image 삭제 시 lock-out.

## How to apply

```yaml
# .github/workflows/build-runner-image.yml
jobs:
  build:
    runs-on: ubuntu-latest   # ← self-hosted X (chicken-egg 회피)
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@<sha>
      - uses: docker/setup-buildx-action@<sha>
      - uses: docker/login-action@<sha>
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@<sha>
        with:
          ...
```

## 위반 시 detection

- PR review에서 build-runner-image.yml `runs-on:` 라인 검사 — `self-hosted` 발견 시 CRITICAL flag
- 향후 image build CI 추가 시 동일 검사

## 카논 ref

- `memory/MISTAKES.md` 2026-04-29 entry (chicken-egg self-bootstrap)
- `memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md`
- `docs/superpowers/specs/2026-04-29-phase-23-custom-runner-image-design.md` § 9 Risks (Phase 23+ entry로 갱신 후보)
- Phase 23 P0-1 follow-up (Hotfix PR `runs-on: ubuntu-latest`)

## Carve-out

- self-hosted [containerized] image **외**의 build (예: server image, web image)는 docker GID 990 권한 + buildx 사용 가능 → self-hosted OK. 본 카논은 **자기 자신을 build하는 image의 self-bootstrap 회피**에 한정.
