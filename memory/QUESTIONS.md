# MMP v3 Open Questions

미해결 의문·결정 보류 사항을 적층. compound-mmp `/compound-wrap` Step 5-1 결과로 자동 append. 해소 시 entry 삭제 또는 `~~strikethrough~~` + 해소 PR/commit 링크.

Q-gate 적용 후 NEW로 분류된 항목만 등재 (중복은 `duplicate-checker` agent로 사전 필터). `learning-quality-gate.md` Q1·Q2·Q3 통과 항목.

---

## 2026-05-01 — Phase 21 E-1/E-6 wrap-up (PR #184)

### Q-auditlog-testcontainer-flaky — `internal/auditlog` testcontainer postgres timeout 재발 빈도 미측정
- **위치**: `apps/server/internal/auditlog/store_test.go:346` `TestStore_LatestSeq_Empty`
- **가설**: arc-runner-set cold start (image pull + initdb) 경계 조건. PR #184 1회 발생, `gh run rerun --failed`로 통과. 재발 빈도 미측정.
- **다음 액션**: 다음 2~3 PR의 Go CI 결과 관찰. 재발 시 `feedback_ci_infra_debt.md`에 신규 섹션 (Phase 18.3 해소 항목과 별도 신규 entry로 구분) + `testcontainers-go` start timeout 상향 또는 retry 로직 검토. 단발이면 종결.
- **블로커 risk**: MED. flaky CI가 4-agent verdict 정상이어도 admin-merge 강행 노이즈 유발.

### Q-backlog-rule-collision — backlog 등록 시 글로벌/프로젝트 CLAUDE.md 충돌 미검증
- **위치**: Phase 18.4/18.5 종료 시 등록된 E-2 (`@jittda/ui` 마이그레이션) → 2026-04-30 검증에서 `apps/web/CLAUDE.md` L3 "Tailwind 4 직접 사용, 디자인 시스템 라이브러리 의존 없음" 룰과 충돌하여 무효 판정.
- **가설**: backlog 항목 등록 시 글로벌 → 프로젝트 → 패키지 3계층 CLAUDE.md override 검증 단계 부재. brainstorm checklist에 추가 가능성.
- **다음 액션**: 동일 패턴 1건 추가 발생 시 카논화 (예: `feedback_backlog_canon_check.md`). 현재는 단발 — 사용자 결정 보류.
- **블로커 risk**: LOW. 이미 무효 처리됨. 향후 동일 패턴 발견 시 불필요 구현 비용.

---

## 2026-04-28 — compound-mmp Wave 2 PR-6 wrap-up

### Q-regex: PATTERN 정규식 단어 경계 미설정 — bash 3.2 `\b` 지원 spike 필요
- **위치**: `.claude/plugins/compound-mmp/hooks/pre-task-model-guard.sh:54` `PATTERN='(claude-)?sonnet-4[-.]5'`
- **가설**: 가상 미래 모델 ID `sonnet-4-50` 등이 false positive로 deny될 가능성 (낮음 — 명명 규칙 미존재)
- **다음 액션**: PR-10 dogfooding sim 작성 시 bash 3.2 `=~` 에서 `\b` 동작 spike (~30분). 결과에 따라 `(claude-)?sonnet-4[-.]5([^0-9-]|$)` 또는 `\b` 변형 채택.
- **블로커 risk**: LOW. 4-agent 리뷰 architecture MED-1.

### ~~Q-shopt: dispatch-router.sh `shopt -u nocasematch` 복원 carry-over phantom 검증~~ — **PHANTOM 확정 / 폐기 (2026-04-28)**
- **검증**: `bash .claude/plugins/compound-mmp/hooks/test-dispatch.sh` → 41/41 pass. 추가로 격리 subshell `shopt -s/-u nocasematch` 함수 외 누수 없음 확인 (case-sensitive 복원).
- **결론**: dispatch-router.sh L42→L47, L51→L61, L67→L81 각 블록 모두 명시적 `-s`/`-u` 짝. exit 경로(L45)도 `-u` 통과. `trap RETURN` 보강 불필요.
- **carry-over 폐기**: Wave 3 진입 spec에서 제거.

### Q-sim-c: PR-10 sim-case-c.md 작성 scope — live deny 시나리오 포함 여부
- **맥락**: Plan ~/.claude/plans/vivid-snuggling-pascal.md § "검증 절차 3개 시뮬레이션 케이스" Case C — Sonnet 4.5 fallback 차단 검증
- **가설**: 실제 4.5 spawn 시도 → deny 확인은 보안 강도를 높이지만 CI에서 의도적 위반 시도는 부작용 위험 (잘못된 매칭 시 수십 토큰 낭비, log noise)
- **다음 액션**: PR-10 spec 진입 시점에 사용자 결정 필요 — "sim 문서에 live deny 시나리오 포함?" Y/N. 기본은 "fixture 검증만" 보수적 옵션.
- **블로커 risk**: LOW.

---

### Q-pr11-vs-phase21: Wave 4 종료 후 PR-11 hygiene 우선 vs Phase 21 dogfooding 우선
- **맥락**: Wave 4 PR-10 admin-merge 완료. carry-over 17건 (HIGH 2 + sister hotfix 1 + MED 6 + LOW 11)이 PR-11 후보. 동시에 compound-mmp 4단계 라이프사이클 첫 실 사용 (Phase 21 dogfooding) 대기.
- **가설**:
  - (A) PR-11 우선: HIGH-A2 (next_gate review/compound unreachable)/A4 (SKILL dual source)/sister hotfix가 production false 신호. dogfooding 전 정리.
  - (B) Phase 21 우선: 실 사용에서 추가 carry-over 발견 가능. PR-11과 합쳐 단일 hygiene PR로 정리.
- **다음 액션**: 다음 세션 시작 시 사용자 결정. 지금 추세는 (A) — sister PR-9 PROJECT_SLUG hotfix는 명확한 보안 부채.
- **블로커 risk**: MED. dogfooding 시 false `next_gate=done` 신호로 wrap 누락 risk.

### ~~Q-ci-d3: CI admin-skip 만료 D-3 (2026-05-01) 결정~~ — **해소 (2026-04-29)**
- **결과**: PR #170 머지로 main DEBT 5건 모두 해소 → admin-skip 정책 2026-04-29 만료 확정 (`project_ci_admin_skip_expired_2026-04-29.md`). 정상 `gh pr merge --squash` 모드 복귀. 옵션 (a) 채택.

### Q-rogue-branch: PR-9 round-2 직전 `feat/-evil/PR-1-go` rogue branch 생성 미스터리
- **맥락**: PR-9 round-2 commit 시점에 git이 갑자기 `feat/-evil/PR-1-go` branch로 이동 (commit 출력에 명시). 머지된 commit이라 안전 삭제했으나 원인 미해결. dispatch-router/hook 영향 가능성.
- **가설**: fixture가 LOW-S-dash 검증 시도 중 실제 `git switch --create` 호출 또는 사용자가 환경에서 시도? 또는 helper의 brand 이름 출력이 어떤 도구에 입력되어 branch 생성?
- **다음 액션**: PR-11 first task 또는 별도 hotfix에서 `dispatch-router.sh`, `compound-work-dry-run.sh`, fixture 코드 audit. 재현 불가 시 carry-over.
- **블로커 risk**: LOW. 단발 사건이며 admin-merge로 해소.

## 2026-04-28 ci-infra-recovery / phase-22 진입

### Q-runner-secrets: runner 컨테이너화 시 release.yml secrets 처리 방법
- **맥락**: Phase 22 Runner 컨테이너화 (myoung34/github-runner) 진행 중. release.yml은 secret 사용 (예: registry token, signing key) — 컨테이너화된 self-hosted runner에서 secret 노출 경로 미정의.
- **옵션**: (a) GitHub Actions secrets 그대로 사용 (myoung34 runner가 자동 노출), (b) Vault/SOPS 매개, (c) 외부 클라우드 release만 분리.
- **다음 액션**: Phase 22 brainstorm Q2~ 단계에서 결정. 상위 보안 카논(`feedback_4agent_review_before_admin_merge.md`)와 align.
- **블로커 risk**: MEDIUM. Phase 22 PR 진입 전 결정 필수.

### Q-spec-host-survey: spec 작성 시 호스트 환경 사전조사 의무화 카논화 여부
- **맥락**: PR-164에서 spec이 `5432:5432`를 그대로 적었다가 langfuse 점유 발견 후 `25432:5432` 시프트. 호스트 환경 의존 spec 항목은 사전 조사가 카논화 가치 있는가.
- **가설**: 호스트 환경 의존 항목(포트, 디스크 path, 권한)은 spec PR 전 `ss/df/id` 결과 참조 의무화. 그러나 일반 룰로 카논화하기엔 재발 빈도 데이터 부족.
- **다음 액션**: 유사 사례 1~2건 누적 시 `feedback_plan_autopilot_gotchas.md`에 항목 추가 검토. 현재는 보류.
- **블로커 risk**: LOW. 정보성.

---

## 2026-04-28 — Phase 22 W1 완료 wrap-up

### Q-runner-w3-fallback: Phase 22 W3 atomic label switch 시 sabyun runner fallback 정책
- **맥락**: Phase 22 W3에서 모든 workflow `runs-on`을 `[self-hosted, containerized]`로 atomic switch 예정. 기존 sabyun runner는 `self-hosted, Linux, X64` 라벨로 W4까지 유지 (회귀 fallback). switch 시점에 큐 대기 job과 신규 라벨 매칭 race condition 정의 부재.
- **가설**: drain → relabel → verify 3단계 절차 필요. 또는 W3 PR 머지 시점에 기존 host runner를 일시 offline → switch → online 복귀.
- **다음 액션**: Phase 22 W3 진입 전 brainstorm 단계에서 라벨 전환 순서 명시.
- **블로커 risk**: MEDIUM. W3 진입 시 결정 필요.

### Q-pat-rotation-automation: GitHub PAT 30일 수동 회전 자동화 방식
- **맥락**: README가 30일 수동 회전 명시. PAT 만료 시 4 컨테이너 동시 401 → restart loop, 알림 부재 (DEBT-2 만료 전 detection 명령은 있음). 자동화 후보: 1Password CLI (`op run --env-file`) / GitHub Actions scheduled workflow (만료 7일 전 알림) / launchd cron.
- **가설**: 1Password CLI는 .env plaintext 디스크 잔존 회피 가능. scheduled workflow는 알림만 + 사용자 수동 회전. 둘 다 도입 가치 있지만 우선순위 결정 필요.
- **다음 액션**: Phase 22 W4 또는 별도 chore PR로 1Password CLI 기반 자동 회전 spike. scheduled 알림은 PR-11 hygiene 후보.
- **블로커 risk**: HIGH (만료 시 runner 전체 registration loop 재발 + 4 컨테이너 동시 401).

### Q-graphify-wrap-update: graphify wrap-session 시점 auto-update 호출 여부
- **맥락**: `memory/project_graphify_refresh_policy.md`에 따르면 Phase 종료 시점만 fresh rebuild. wrap-wave는 `--update` 안내만, wrap-session은 skip. 그러나 wrap-session에서도 코드 변경이 누적되면 graphify drift 발생.
- **가설**: wrap-session에서 변경 50줄 이상이면 `make graphify-update` 자동 안내 (실행 X) 또는 사용자 결정. 카논 명시 필요.
- **다음 액션**: graphify refresh 정책 문서에 "wrap-session = skip 또는 임계 도달 시 안내" 한 줄 추가 (사용자 결정).
- **블로커 risk**: LOW. compound 효율 영향, 블로커 아님.

---

## 2026-04-29 — Phase 23 Custom Image pivot wrap-up

### ~~Q-myoung34-ephemeral-fs: EPHEMERAL=true 재시작 후 ~/go/pkg/mod overlay layer 잔존 범위~~ — **해소 (2026-04-29)**
- **결과**: Phase 23 Custom Runner Image 머지 (PR #174 + hotfix #175)로 cleanup hook (`ACTIONS_RUNNER_HOOK_JOB_STARTED`) 도입. multi-stage Dockerfile + GHCR build CI 정착 → file system reset 보장. baseline 한정이 아닌 영구 해소.
- **연관**: `memory/sessions/2026-04-29-phase-23-custom-runner-image-merge.md`, `feedback_runner_bootstrap.md`, `feedback_multi_stage_dockerfile_runner.md`
