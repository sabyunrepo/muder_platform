# Task 3+4 — Workflow Service Container Ephemeral Port

## Task 3: ci.yml — postgres/redis ephemeral host port

**Files:**
- Modify: `.github/workflows/ci.yml:24-34, 43-45` (go-check job only)

**근거:** `ports: - "5432:5432"`는 host 5432 고정 매핑. 같은 self-hosted runner 호스트에 여러 job/dev 컨테이너 동시 실행 시 충돌. `ports: - "5432"`는 host에 무작위 ephemeral port 자동 할당 → `${{ job.services.X.ports['Y'] }}`로 동적 참조. 다른 job (`ts-check`, `coverage-guard`, `docker-build`)은 postgres/redis 미사용 — 변경 영향 없음.

- [ ] **Step 3.1: ports 매핑 변경**

`.github/workflows/ci.yml` line 24:
```yaml
        ports:
          - "5432:5432"
```
→
```yaml
        ports:
          - "5432"
```

같은 파일 line 33:
```yaml
        ports:
          - "6379:6379"
```
→
```yaml
        ports:
          - "6379"
```

- [ ] **Step 3.2: env 템플릿 적용**

`.github/workflows/ci.yml` line 43-45:
```yaml
    env:
      DATABASE_URL: postgres://mmp:mmp_test@localhost:5432/mmp_test?sslmode=disable
      REDIS_URL: redis://localhost:6379
```
→
```yaml
    env:
      DATABASE_URL: postgres://mmp:mmp_test@localhost:${{ job.services.postgres.ports['5432'] }}/mmp_test?sslmode=disable
      REDIS_URL: redis://localhost:${{ job.services.redis.ports['6379'] }}
```

**주의:** GitHub Actions 표현식 안 `'5432'` 따옴표 필수.

- [ ] **Step 3.3: yaml syntax 육안 검증**

Run:
```bash
grep -n "5432\|6379" .github/workflows/ci.yml | head -10
```
Expected:
- `5432:5432` 패턴 0건
- `ports['5432']` 참조 1건 (DATABASE_URL)
- `ports['6379']` 참조 1건 (REDIS_URL)

(`yq` 있으면 `yq eval '.jobs.go-check.services.postgres.ports' .github/workflows/ci.yml`로 더 정확한 검증.)

- [ ] **Step 3.4: commit (Task 4와 묶음 권장)**

이 task의 commit은 Task 4 완료 후 묶음 — 두 workflow를 같은 PR에서 일관 변경하는 게 history 깔끔.

---

## Task 4: e2e-stubbed.yml — ephemeral port + goose 연결 + psql 플래그

**Files:**
- Modify: `.github/workflows/e2e-stubbed.yml:46-66, 96-99, 139-143`

**근거:** ci.yml과 동일 패턴(포트 매핑 + env 템플릿)에 추가로:
- **Run migrations** step의 goose 연결 문자열에 `port=5432` 하드코딩
- **Seed E2E theme** step의 `psql` 명령에 `-p` 플래그 미사용 → libpq default 5432

- [ ] **Step 4.1: ports 매핑 변경**

`.github/workflows/e2e-stubbed.yml` line 46:
```yaml
        ports:
          - "5432:5432"
```
→
```yaml
        ports:
          - "5432"
```

line 56:
```yaml
        ports:
          - "6379:6379"
```
→
```yaml
        ports:
          - "6379"
```

- [ ] **Step 4.2: env 템플릿 적용**

line 64-66:
```yaml
    env:
      DATABASE_URL: postgres://mmp:mmp_e2e@localhost:5432/mmp_e2e?sslmode=disable
      REDIS_URL: redis://localhost:6379
```
→
```yaml
    env:
      DATABASE_URL: postgres://mmp:mmp_e2e@localhost:${{ job.services.postgres.ports['5432'] }}/mmp_e2e?sslmode=disable
      REDIS_URL: redis://localhost:${{ job.services.redis.ports['6379'] }}
```

- [ ] **Step 4.3: goose 연결 문자열 템플릿**

line 94-99:
```yaml
      - name: Run migrations
        working-directory: apps/server
        run: |
          goose -dir db/migrations postgres \
            "host=localhost port=5432 user=mmp password=mmp_e2e dbname=mmp_e2e sslmode=disable" \
            up
```
→
```yaml
      - name: Run migrations
        working-directory: apps/server
        run: |
          goose -dir db/migrations postgres \
            "host=localhost port=${{ job.services.postgres.ports['5432'] }} user=mmp password=mmp_e2e dbname=mmp_e2e sslmode=disable" \
            up
```

- [ ] **Step 4.4: psql `-p` 플래그 추가**

line 139-143:
```yaml
      - name: Seed E2E theme
        run: |
          PGPASSWORD=mmp_e2e psql -h localhost -U mmp -d mmp_e2e \
            -v ON_ERROR_STOP=1 \
            -f apps/server/db/seed/e2e-themes.sql
```
→
```yaml
      - name: Seed E2E theme
        run: |
          PGPASSWORD=mmp_e2e psql -h localhost -p ${{ job.services.postgres.ports['5432'] }} -U mmp -d mmp_e2e \
            -v ON_ERROR_STOP=1 \
            -f apps/server/db/seed/e2e-themes.sql
```

- [ ] **Step 4.5: 검증 + commit**

Run:
```bash
grep -n "5432\|6379\|ports\['5432'\]\|ports\['6379'\]" .github/workflows/e2e-stubbed.yml | head -15
```
Expected:
- `5432:5432` / `6379:6379` 패턴 0건
- `ports['5432']` 참조 3건 (env DATABASE_URL + goose + psql)
- `ports['6379']` 참조 1건 (env REDIS_URL)

```bash
git add .github/workflows/ci.yml .github/workflows/e2e-stubbed.yml
git commit -m "$(cat <<'EOF'
fix(ci-infra): workflow service container ephemeral ports

postgres/redis service container의 host port 매핑을 고정 (5432:5432,
6379:6379) 에서 ephemeral (5432, 6379) 로 전환. GitHub Actions가 자동
ephemeral host port 할당 → 같은 self-hosted runner 호스트의 병렬 job
충돌 차단.

DATABASE_URL/REDIS_URL은 ${{ job.services.X.ports['Y'] }} 템플릿으로
동적 host port 참조. e2e-stubbed.yml의 goose 연결 문자열 + psql -p
플래그도 동일 패턴 적용.

다른 job (ts-check, coverage-guard, docker-build, merge-reports)은
postgres/redis service 미사용 — 변경 영향 없음.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
