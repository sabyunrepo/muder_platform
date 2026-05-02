# Playwright `--with-deps` 분리 카논

> ARC self-hosted runner OS image의 deprecated apt 패키지가 `--with-deps`를 차단할 수 있음. 분리 패턴 강제. PR-1 (#212) 인지 후 등재.

## 카논

**`pnpm exec playwright install --with-deps <browser>` 단일 명령 사용 금지.** deps install (best-effort)와 browser install (always-required)을 분리한다.

### 패턴 (정답)

```yaml
# Playwright `--with-deps` requires `fonts-freefont-ttf` (and others) which is
# deprecated on the ARC runner's OS image — split into best-effort deps
# install + always-required browser install.
- name: Install Playwright system deps (best-effort)
  working-directory: apps/web
  run: |
    sudo apt-get update -y || true
    pnpm exec playwright install-deps <browser> || \
      echo "::warning::Playwright install-deps failed (likely deprecated package on runner image); continuing without"

- name: Install Playwright browsers
  working-directory: apps/web
  run: pnpm exec playwright install <browser>
```

### 작동 원리

- **`install-deps`**: apt를 통해 system deps 설치 시도. 한 deprecated 패키지가 있으면 전체 transaction 실패 → `|| echo warning` fallback.
- **bare `playwright install`**: Playwright가 download한 chromium/webkit는 자체 fallback fonts 포함. system deps 일부 부재해도 headless QA에서 정상 동작.

### Anti-pattern (금지)

- ❌ `pnpm exec playwright install --with-deps chromium` (단일 명령, deprecated 패키지에 차단됨)
- ❌ `apt-get install fonts-freefont-ttf` 명시 추가 — 매번 다른 deprecated 패키지 등장 가능
- ❌ runner image OS upgrade 시 Playwright 버전 lock 풀기 — Playwright의 deps 리스트가 OS 변경 따라가지 못함

### 검증

PR/push CI에서:
1. `install-deps` step warning 발생해도 workflow 진행
2. `install` step은 항상 PASS (browsers는 bundled)
3. e2e 테스트 정상 실행

## 근거 사례 (PR-1 #212)

- 3 retry 모두 같은 원인 fail:
  ```
  E: Package 'fonts-freefont-ttf' has no installation candidate
  Failed to install browsers
  Error: Installation process exited with code: 100
  ```
- Fix `0a08ff3` — 3 workflow에서 동일 패턴 적용:
  - `.github/workflows/e2e-stubbed.yml` (PR CI)
  - `.github/workflows/phase-18.1-real-backend.yml` (real-backend matrix)
  - `.github/workflows/flaky-report.yml` (nightly)
- 결과: E2E shard 1+2 + Merge Playwright reports 모두 PASS

## 연관 카논

- `apps/web/package.json` `@playwright/test ^1.59.1` (현재 버전, OS deps 리스트 정의 source)
- `feedback_runner_bootstrap.md` (ARC runner image canon)

## 적용 대상

- Playwright e2e workflow (현재 3개)
- 새 Playwright workflow 추가 시 본 카논 참조
- ARC runner image OS 변경 시 (Phase 23+ 인프라 변경) 검증 step 추가

## Future

- Playwright upstream이 `--with-deps` deps 리스트를 OS image별로 dynamic 처리하면 본 카논 deprecate 가능
- runner image에 system deps 사전 설치 (Dockerfile 단계) 시 `install-deps` step 자체 제거 가능
