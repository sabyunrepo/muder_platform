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

### Q-shopt: dispatch-router.sh `shopt -u nocasematch` 복원 carry-over phantom 검증
- **위치**: `.claude/plugins/compound-mmp/hooks/dispatch-router.sh` `classify()` 함수
- **가설**: 이전 세션 carry-over에 명시되었으나, learning-extractor 코드 확인 시 모든 분기에 unset 존재. carry-over 자체가 phantom 가능성.
- **다음 액션**: Wave 3 진입 전 `test-dispatch.sh` 실행으로 nocasematch 누수 여부 1회 확인. phantom이면 carry-over 폐기, 실재면 `trap 'shopt -u nocasematch' RETURN` 보강.
- **블로커 risk**: LOW.

### Q-sim-c: PR-10 sim-case-c.md 작성 scope — live deny 시나리오 포함 여부
- **맥락**: Plan ~/.claude/plans/vivid-snuggling-pascal.md § "검증 절차 3개 시뮬레이션 케이스" Case C — Sonnet 4.5 fallback 차단 검증
- **가설**: 실제 4.5 spawn 시도 → deny 확인은 보안 강도를 높이지만 CI에서 의도적 위반 시도는 부작용 위험 (잘못된 매칭 시 수십 토큰 낭비, log noise)
- **다음 액션**: PR-10 spec 진입 시점에 사용자 결정 필요 — "sim 문서에 live deny 시나리오 포함?" Y/N. 기본은 "fixture 검증만" 보수적 옵션.
- **블로커 risk**: LOW.
