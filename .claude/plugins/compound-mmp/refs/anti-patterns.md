# compound-mmp Anti-Patterns

이 플러그인이 **절대 하지 말아야 할 것**. 사용자 명시 결정·과거 사고·검증된 carve-out에 근거한 항목만 등재.

## 1. plan-autopilot 자동 진행 부활 X
- **근거**: 사용자가 2026-04-21 폐기 결정. preflight 경로 버그 #121/#126/#127 누적
- **대안**: `docs/plans/<phase>/checklist.md` 직접 read + 수동 STATUS 갱신
- **carve-out (PR-2 spike 후 강화)**: `/compound-work`가 OMC `team-exec`/`executor`를 wrap 호출할 때 **`team-fix` stage 진입 차단** 강제 (`max_fix_loops=0` 또는 ralplan 우회 금지). post-task-pipeline.json v2의 `manual_review_required.policy = halt_and_notify`와 정렬. spike 결과 (`refs/spike-omc-overlap.md` A 항목)에서 OMC team-fix 자동 루프가 이 anti-pattern과 정면 충돌함을 확인 → wrapper에서 명시 차단

## 2. user-home memory 작성 X
- **근거**: 2026-04-21 PR-0 이후 `memory/`(repo) canonical만 인정. user home은 archival
- **대안**: 모든 새 메모리는 `/Users/sabyun/goinfre/muder_platform/memory/`에만

## 3. Sonnet 4.5 fallback X
- **근거**: 2026-04-19 Sonnet 4.6 기본화 결정 (`feedback_sonnet_46_default.md`)
- **강제**: `hooks/pre-task-model-guard.sh`가 `claude-sonnet-4-5`/`sonnet-4-5` 문자열 차단

## 4. graphify post-commit 자동 fresh rebuild X
- **근거**: `_rebuild_code`가 semantic 노드 ~6% 영구 손실 (정책 D, 2026-04-18)
- **허용**: `--update` 증분만. fresh rebuild는 Phase 종료 시점만 수동 PR
- **wrap 예외 (review #5 모순 해결)**: `/compound-wrap --phase` 모드는 Phase 종료 시점이므로 fresh rebuild 자동 실행 허용 (`refs/wrap-up-checklist.md` Step 7). `--session`/`--wave`는 skip 또는 `--update` 안내만.

## 5. 새 SQLite 벡터 인덱스 구축 X
- **근거**: QMD MCP 4 컬렉션이 동일 기능 제공. 추가 인덱스는 메모리 누수 운영 부담
- **대안**: `qmd-recall` 스킬이 `mcp__plugin_qmd_qmd__vector_search` 호출

## 6. CLAUDE.md `@import` 사용 X
- **근거**: nested lazy-load 효과 0 (메타 룰)
- **대안**: 카논 매트릭스 1줄 링크만 추가

## 7. 4-agent 리뷰 스킵 후 admin-merge X
- **근거**: PR-2c (#107) deadlock latent → hotfix #108 사고
- **강제**: `/compound-review`가 post-task-pipeline.json 4 entry 병렬 호출. HIGH 발견 시 사용자 결정 대기

## 8. `~/.claude/claude.md` 수정 X
- **근거**: OMC가 `<!-- OMC:START --> ... <!-- OMC:END -->` 마커 영역을 SessionStart마다 자동 갱신 → 충돌 시 손실
- **대안**: repo `CLAUDE.md` 카논 매트릭스에 1줄만 추가

## 9. Wrap-up MEMORY.md 카논 구조 자동 변경 X
- **근거**: 사용자 결정 "균형형" — entry append (기존 구조 유지)는 자동, 인덱스 카테고리·헤더·기존 줄 수정은 승인
- **명확화 (code-reviewer review #9 dangling fix)**: MEMORY.md는 인덱스 파일이지만 "entry append"는 기존 카테고리 끝에 1줄 추가만 의미. 카테고리 신설·기존 줄 수정·재정렬은 인덱스 구조 변경 → 승인 필수
- **강제**: `refs/wrap-up-checklist.md` Step 5 (entry append만 자동) + Step 6 (구조 변경은 사용자 승인). 실제 구현은 PR-3 (`skills/wrap-up-mmp/SKILL.md`)

## 10. OMC agent frontmatter override 시도 X
- **근거**: OMC agent의 `model:` 필드는 read-only. plugin namespace 분리로 충돌 0
- **대안**: 모델이 다른 호출이 필요하면 `compound-mmp:*` 새 agent 정의

## 11. dispatch-router 강제 진입 X
- **근거**: dispatch는 항상 추천일 뿐. 사용자 의도가 다르면 무시
- **강제**: `dispatch-router.sh`는 `additionalContext`만 반환, `permissionDecision: "deny"` 사용 X

## 12. wrap-up agent에 Bash/Edit/Write 권한 부여 X
- **근거**: Session-Wrap 검증 — 분석 전용. 실제 변경은 메인 컨텍스트가 사용자 승인 후 수행
- **강제**: `agents/*.md` frontmatter `tools: [Read, Glob, Grep]` 명시
