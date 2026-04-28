# Task 5 — apps/server/CLAUDE.md 카논 갱신

**Files:**
- Modify: `apps/server/CLAUDE.md` (끝에 새 섹션 추가)

**근거:** CLAUDE.md는 server 팀 룰 카논. dev compose 시작 시 `HOST_UID`/`HOST_GID` env가 없으면 fallback 1000:1000인데, Mac dev 환경(UID 501)에서는 mismatch → 다시 root-like 권한 문제 가능. 카논 명령어로 명시.

- [ ] **Step 5.1: 섹션 추가**

`apps/server/CLAUDE.md` 끝에 추가:

````markdown
## 개발 환경 시작 (dev compose)

```bash
HOST_UID=$(id -u) HOST_GID=$(id -g) \
  docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

**왜 `HOST_UID`/`HOST_GID` 필요?**
`Dockerfile.dev`가 ARG로 호스트 UID/GID 받아 매칭되는 non-root user(`appuser`)
생성. 미설정 시 fallback `1000:1000` 사용 → Mac dev (UID 501) 등에서 mismatch
시 호스트 bindmount(`apps/server/tmp/`) 권한 충돌 발생.

**1회만 `--build` 필요** — Dockerfile.dev 변경 반영. 이후엔 `--build` 생략 가능.

**`direnv` 사용 시** — `.envrc`에 다음 추가:
```bash
export HOST_UID=$(id -u)
export HOST_GID=$(id -g)
```
이후 `direnv allow` 1회로 자동 적용.

**근거:** `docs/superpowers/specs/2026-04-28-ci-infra-recovery-design.md`,
`memory/feedback_explanation_style.md` 사용자 친화 설명 카논.
````

- [ ] **Step 5.2: 라인 수 확인**

Run:
```bash
wc -l apps/server/CLAUDE.md
```
Expected: 변경 후 ≤ 200줄 (CLAUDE.md 다이어트 정책 root 카논). 초과 시 다른 섹션 trim 또는 sub-doc 분리.

- [ ] **Step 5.3: commit**

```bash
git add apps/server/CLAUDE.md
git commit -m "$(cat <<'EOF'
docs(ci-infra): apps/server/CLAUDE.md — dev compose 시작 명령 카논

HOST_UID/HOST_GID env 명시 카논. Dockerfile.dev + docker-compose.dev.yml
변경에 따라 dev 시작 시 호스트 UID/GID 주입 필수. 미주입 시 fallback
1000:1000 — Mac dev (UID 501) 등에서 권한 mismatch 발생.

direnv 사용자 가이드도 함께 명시.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
