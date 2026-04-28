# MMP v3 Open Questions

미해결 의문·결정 보류 사항을 적층. compound-mmp `/compound-wrap` Step 5-1 결과로 자동 append. 해소 시 entry 삭제 또는 `~~strikethrough~~` + 해소 PR/commit 링크.

Q-gate 적용 후 NEW로 분류된 항목만 등재 (중복은 `duplicate-checker` agent로 사전 필터). `learning-quality-gate.md` Q1·Q2·Q3 통과 항목.

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

### Q-ci-d3: CI admin-skip 만료 D-3 (2026-05-01) 결정
- **맥락**: CI admin-skip 정책이 2026-05-01 만료 (오늘 4-28). 본 세션 모든 PR (#161/#162/#163) admin-merge로 진행, CI 13개 fail 무시.
- **가설**:
  - (a) golangci-lint↔Go1.25 + ESLint9 fix 우선 — 정식 CI 활성화
  - (b) admin-skip 연장 — 추가 시간 확보
  - (c) PR-11 이전 hotfix PR로 CI 인프라만 정비
- **다음 액션**: 다음 세션 첫 결정 게이트. `feedback_ci_infra_debt.md` 참조.
- **블로커 risk**: HIGH (5/1부터 모든 PR이 BLOCKED).

### Q-rogue-branch: PR-9 round-2 직전 `feat/-evil/PR-1-go` rogue branch 생성 미스터리
- **맥락**: PR-9 round-2 commit 시점에 git이 갑자기 `feat/-evil/PR-1-go` branch로 이동 (commit 출력에 명시). 머지된 commit이라 안전 삭제했으나 원인 미해결. dispatch-router/hook 영향 가능성.
- **가설**: fixture가 LOW-S-dash 검증 시도 중 실제 `git switch --create` 호출 또는 사용자가 환경에서 시도? 또는 helper의 brand 이름 출력이 어떤 도구에 입력되어 branch 생성?
- **다음 액션**: PR-11 first task 또는 별도 hotfix에서 `dispatch-router.sh`, `compound-work-dry-run.sh`, fixture 코드 audit. 재현 불가 시 carry-over.
- **블로커 risk**: LOW. 단발 사건이며 admin-merge로 해소.
