---
name: 2026-04-19 세션 — 토큰 최적화 + 스펙 동기화
description: 3 PR 머지 (#116 module-spec 33 동기화, #117 hook slim + advisor 패턴, #118 /plan-* QMD 전환 + Sonnet 4.6 기준). 글로벌 plan-autopilot archive.
type: project
---
**수행 작업:**

1. **PR #116 `docs(module-spec)`** — crime_scene + media 카테고리 신설
   - `docs/plans/2026-04-05-rebuild/module-spec.md` 29 → 33 모듈 인덱스
   - `refs/modules/crime_scene.md` (Location/Evidence/Combination 3종) + `media.md` (Audio) 신규
   - PlayerAware 게이트 분포 표 + LocationClue vs Location 네이밍 혼동 주의표

2. **PR #117 `chore(hooks)`** — 토큰 절감 최적화
   - `.claude/settings.json`: graphify Glob|Grep 리마인더 hook 삭제 (매 grep ~120 토큰 중복)
   - `.claude/scripts/plan-status.sh --compact`: plan 필드 `?`일 때 침묵
   - `.claude/scripts/plan-remind.sh`: 4줄 → 1줄
   - `CLAUDE.md`: graphify 섹션 70줄 → `.claude/refs/graphify.md` + 강제 규칙 5줄 (281→241)
   - `CLAUDE.md`: **Opus↔Sonnet 위임 규칙 (advisor 패턴)** 섹션 신규 추가

3. **PR #118 `chore(plan)`** — /plan-* 커맨드 slim
   - `plan-resume.md`: Read 5 files → `qmd get` 2개 (현재 PR spec + checklist). design/plan은 PreToolUse가 편집 직전 강제하므로 선로드 금지. 호출당 ~10K 절감
   - `plan-go.md`: 103→52줄, Phase 상세 mmp-pilot/SKILL.md 단일 소스 참조
   - `plan-status.md`: deprecated `autopilot-state.json` cat 제거
   - `CLAUDE.md`: **Sonnet 4.6 모델 기준** 섹션 (서브에이전트 `claude-sonnet-4-6`, 4.5 금지)

4. **글로벌 직접 적용** (repo 외)
   - `~/.claude/skills/plan-autopilot/` → `~/.claude/_archive/plan-autopilot-20260419/` 이동 후 plan-go canonical rename (심볼릭 링크 정리)
   - `~/.claude/skills/plan-go/SKILL.md`: frontmatter name 교정 + Anti-patterns → `refs/STOP-list.md` 분리
   - `~/.claude/scripts/skill-injector.sh`: 슬래시/20자 미만 프롬프트 스킵 + skills 빈 rule 침묵
   - `~/.claude/scripts/skill-rules.json`: `design-docs` rule 제거 (10→9)

**예상 세션당 절감:**
- 일반 세션: ~8~15K 토큰
- /plan-resume 쓰는 세션: 추가 ~10K
- /plan-go 반복 세션: 추가 ~2K × N회

**Why**: 직전 세션 (module-spec #116) ~69K 컨텍스트 소모 분석 후 프로젝트 스코프에서 조정 가능한 노이즈·중복 제거. advisor tool (Anthropic API beta) 패턴의 Claude Code 등가 문서화.

**How to apply**: 다음 세션부터 `/plan-resume` 호출 시 QMD get 2개만 로드됨. 서브에이전트 spawn 시 `model: "claude-sonnet-4-6"` 명시 필수.
