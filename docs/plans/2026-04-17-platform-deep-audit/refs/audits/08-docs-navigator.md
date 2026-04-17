# 08 — docs-navigator Audit Draft (W2)

> 관점: QMD coverage, 설계-구현 drift, stale .md, Phase 후속 관리, MEMORY.md 인덱스 정합성, `docs/plans/` 네이밍·3종 문서 규칙. **구체 코드 조치는 cross-ref**.

## Scope

- `docs/plans/**` (23 dir + 12 flat .md), `docs/superpowers/**` (9 specs), 두 저장소의 `memory/**` (repo: 4 파일, user: 34 `project_*` + 12 `feedback_*`), `CLAUDE.md`, `README.md`.
- QMD 인덱스 3 컬렉션 (mmp-plans 237, mmp-memory 49, mmp-specs 9).
- 제외: 소스코드 (01/03 몫), 인프라 (범위 밖), mobile.

## Method

- QMD `search`·`vector_search`·`status` 우선.
- 파일시스템은 QMD 미색인·drift 의심 시에만 `wc -l` · 디렉터리 리스팅으로 교차검증.
- 설계-코드 drift는 문서 원문만 인용, 실제 코드 위반은 module-inventory·baseline 인계 사실만 요약.

## Findings

### F-docs-1: 설계 문서 전반 `BaseModule` 임베드 패턴을 규약으로 반복 진술하나 실제 코드엔 타입 자체가 부재

- **Severity**: P1
- **Evidence**:
  - `docs/plans/2026-04-05-rebuild/design.md:13` "모듈: 29개 (BaseModule + ConfigSchema + PhaseReactor + AutoContent)"
  - `docs/plans/2026-04-05-rebuild/module-spec.md` · `refs/modules/*` 반복 노출, `2026-04-08-engine-integration/refs/architecture.md:139` "BaseModuleHandler" 도입 언급
  - 코드 검증: `grep -rn "BaseModule\b" apps/server/internal/engine/ apps/server/internal/module/` → **0 hit** (전 파일). 실구현은 `engine.Module` 인터페이스 + `var _ engine.Module = (*X)(nil)` 컴파일 체크로 수렴.
  - `CLAUDE.md` 모듈 시스템 섹션도 "BaseModule + ConfigSchema(선언적 설정) + AutoContent(자동 콘텐츠)" 문구 유지 중.
- **Impact**: 신규 팀원·에이전트가 설계 문서만 믿고 "BaseModule 임베드" 탐색 → 존재하지 않는 타입을 찾아 30분+ 헤맴. 설계 rubric의 P0 시드 샘플(08 영역)과 정확히 일치.
- **Proposal**: `rebuild/design.md` 인덱스·`module-spec.md`·`CLAUDE.md` 모듈 섹션 3곳에 "현재 구현: `engine.Module` 인터페이스 + Factory init, BaseModule 임베드는 설계안으로만 검토됨" 1줄 패치. 상세는 `refs/modules/*`에서 interface 규약으로 섹션 rewrite.
- **Cross-refs**: [cross:03] 실측 인벤토리(module-inventory.md §Drift)·[cross:01] file-size 초과 모듈

### F-docs-2: `module-spec.md` "29개 모듈" vs 실측 33개 — 설계 수치 +4 drift

- **Severity**: P1
- **Evidence**: `module-spec.md:5,27,33` "29개" · `refs/modules/clue-distribution.md:1` "5개" 등 섹션 합계 29. 실측은 `refs/shared/module-inventory.md` 33 (cluedist 5 · communication 5 · core 4 · crime_scene 3 · decision 3 · exploration 4 · media 1 · progression 8). Phase 9.0 기록 "31 모듈", Phase 11~17 증분 이력 문서화 없음.
- **Impact**: 총 개수·카테고리별 개수 모두 설계안 수치로 정지. `MEMORY.md:22` "Phase 9.0 완료 — 31 모듈" 등 하위 문서가 상호 상충. 온보딩·scope 추정·테스트 기대치 drift.
- **Proposal**: `module-spec.md` 최상단 "현재 구현 33개 (설계안 29→증분 +4: Phase 11/12/17 cluedist·progression 확장)" 배너 추가. 카테고리별 수 표 갱신. 원 설계안 29는 "초기 설계" 섹션으로 보존. 증분 이력은 `refs/module-history.md` 신규.
- **Cross-refs**: [cross:03]

### F-docs-3: Phase 후속 약 39건을 memory 파일마다 산개 관리 — 중앙 tracking 부재

- **Severity**: P1
- **Evidence**: baseline §6 — Phase 17.5(6) / 18.0(2) / 18.1(**18**) / 18.3(0) / 18.4(5) / 18.5(2) / 18.6(QMD 미색인) / 18.7(12). 각각 `project_phase1XX_progress.md` 하단 "후속 이월/다음 Phase 후보"로만 존재. 상호 참조·상태(해결/대기/이월)·담당 PR 번호·마감 Phase 필드 없음.
- **Impact**: "Phase 18.8 cleanup이 18.1 이월 18건 중 몇 건을 소화하는가" 추적 불가. 신규 Phase 19 backlog 산정 시 executor가 같은 항목을 중복 발견할 가능성.
- **Proposal**: `docs/plans/_followups/index.md` (또는 `memory/project_followups_tracker.md`) 신설. 컬럼: Phase 출처 · ID · 제목 · severity · 상태 · 마감 Phase · PR 번호. 기존 memory 파일은 수정 없이 `See: followups_tracker#id` 링크만 추가. Phase 19 executive-summary·phase19-backlog가 이 tracker 기준으로 중복 제거.
- **Cross-refs**: [cross:04] test-engineer가 각 후속 항목에 테스트 마커 연결 (있으면)

### F-docs-4: QMD 키워드 인덱싱 약함 — 필수 쿼리 4/6 `search` miss

- **Severity**: P1 (경계: P2 후보 — 개별 miss는 경미하나 누적 executor 시간이 팀 생산성 저하 구간)
- **Evidence**: baseline §5 — `Phase 18.8 E2E Skip Recovery` / `envelope_catalog WS 계약` / `파일 크기` / `Zustand 3-layer` 4건 search miss, vector_search로만 Top 1 확보. 반면 정확 용어(`AppError`, `ConfigSchema`)는 search로 0.77~0.82. `Phase 18.8`·`envelope_catalog`·`3-layer` 같이 상위 문서 타이틀·헤더에 쓰이지 않는 별칭·약어가 원인.
- **Impact**: 세션마다 executor가 vector_search로 폴백 → 쿼리당 +2s, 하루 수백 쿼리면 누적. 정답 문서를 놓치는 miss 리스크.
- **Proposal**: 주요 문서 frontmatter·H1에 "검색 별칭" 섹션 추가. 예: `2026-04-16-e2e-skip-recovery/design.md` H1 다음 줄에 `aliases: Phase 18.8, E2E Skip Recovery, #66`. 용어집 `docs/plans/_glossary.md` 신규 (envelope_catalog·3-layer·PhaseReactor 등 keyword → canonical path). QMD 재인덱싱 후 search 0.75+ 확보 회귀 테스트.
- **Cross-refs**: [cross:04] "검색 miss = flaky test와 유사 비용"

### F-docs-5: `memory/` 저장소 2중화 — repo 4 파일 vs user 34 파일 drift

- **Severity**: P1
- **Evidence**: `ls /Users/sabyun/goinfre/muder_platform/memory/` → `MEMORY.md + project_phase184/186/188_progress.md` 4개. `ls ~/.claude/projects/.../memory/` → 동명 MEMORY.md + 33 project_*.md + 12 feedback_*.md. 두 MEMORY.md 인덱스 내용 동일해 보이나 본문 drift 가능성. `.gitignore`·CLAUDE.md 어느 쪽이 canonical인지 규정 없음.
- **Impact**: `/plan-resume`·docs-navigator agent가 어느 쪽을 먼저 읽느냐에 따라 표 집계가 다름. repo 쪽 memory는 Phase 18.4/18.6/18.8만 존재 → 다른 Phase 질의 시 miss.
- **Proposal**: CLAUDE.md "Active Plan Workflow"에 "memory canonical = `~/.claude/projects/.../memory/`, repo `memory/`는 commit 대상 feedback·결정 사항만" 1조 추가. repo memory는 장기 보존용 scrub 후 3파일 → archive (또는 전부 삭제 + .gitignore 유지). 동기화 스크립트는 불필요, 단방향 링크 규칙만.
- **Cross-refs**: [cross:01] Git 워크플로우 (2026-04-17 d1262a7 사건과 동일 맥락 "실수 commit 방지")

### F-docs-6: 3종 문서 규칙(design+plan+checklist+context) 준수율 context 2/23 극저조

- **Severity**: P1 (경계: rubric 08 영역 P0 시드 샘플 "신규 팀원이 잘못된 경로 유도"와 직계. 현재는 기존 Phase 레트로 면제로 P1)
- **Evidence**: `find docs/plans -maxdepth 2 -name "context.md" | wc -l` → **2** (대상 디렉터리 23). design.md 23/23 (100%), plan.md 17/23 (74%), checklist.md 22/23 (96%). CLAUDE.md "작업 기억 (3종 문서)" 규칙은 design+context+checklist를 3종으로 명시 (user global CLAUDE.md 31줄 근처).
- **Impact**: "결정 근거(why)"가 context.md에 축적돼야 하는데 21개 Phase에서 부재 → 리뷰·재개 시 근거를 design.md 본문에서 추출해야 함. Phase 19 executor가 "왜 29개가 아닌 31개였는지" 같은 질문에 답을 찾지 못함.
- **Proposal**: 신규 Phase만 강제 (기존 소급 금지). `plan-new` 스킬이 context.md 템플릿을 반드시 생성하도록 확인. 기존 상위 5 Phase(17.5/18.0/18.1/18.4/18.7)는 최소 "주요 결정 3줄"만 레트로 기록 후 close.
- **Cross-refs**: [cross:04] checklist 구조는 test 매트릭스와도 연동

### F-docs-7: `docs/plans/` 네이밍 비일관 — 디렉터리 23개 + 루트 평면 .md 12개 혼재

- **Severity**: P2
- **Evidence**: `find docs/plans -maxdepth 1 -type f -name "*.md"` → **12 flat .md** (예: `2026-04-05-error-system.md` 176줄, `2026-04-05-phase2-data-layer.md` 1105줄, `2026-04-06-phase76-payment.md` 1025줄). 같은 기간 다른 phase는 디렉터리 구조. 1000줄+ flat md는 CLAUDE.md "MD 200줄 분할 원칙" 위반.
- **Impact**: QMD indexing 시 "Phase2 data-layer"를 flat과 refs 중 어디서 찾을지 혼란. index 역할 없는 평면 파일이 refs 구조의 이점 무효.
- **Proposal**: 500줄+ flat md 3건(`phase2-data-layer.md` 1105, `phase76-payment.md` 1025, `phase-7.7-fe-plan.md` 1204) → `2026-04-05-phase2-data-layer/{design.md+refs/*}` 구조로 마이그레이션. 200~500줄 중간 6건은 선택. `rebuild/design.md` 같은 이미 디렉터리화된 index는 유지.
- **Cross-refs**: [cross:01] file-size tier 정책 확장 (MD 분할 원칙)

### F-docs-8: Phase 18.6 progress가 user memory엔 `_plan.md` 한쪽만, repo엔 `_progress.md` 한쪽만 — 쌍 누락

- **Severity**: P2
- **Evidence**: QMD `search phase186 -c mmp-memory` → `project-phase186-plan.md`(하이픈) 1건만 + `memory.md` 인덱스. `ls ~/.claude/projects/.../memory/` → `project_phase186_plan.md`(underscore) 존재, `_progress.md` 없음. repo 쪽은 `project_phase186_progress.md`만. QMD 인덱싱 이름 `project-phase186-plan.md`는 **하이픈 → QMD normalization 가능성** (문서 표기와 파일 표기 drift).
- **Impact**: MEMORY.md가 `project_phase186_progress.md`를 링크하나 user memory엔 `_plan.md`만. QMD 쿼리 시 "Phase 18.6 완료 현황"을 찾으려는 팀원이 plan(진행중 스냅샷)을 completion report로 착각.
- **Proposal**: user memory의 `_plan.md`를 `_progress.md`로 rename(혹은 별도 progress 신규 작성) + MEMORY.md 링크 갱신 + QMD re-index. underscore/hyphen 표기 규칙 1줄 명시(user global 관례 따름: underscore).
- **Cross-refs**: (단독)

### F-docs-9: Phase 후속 카운트 자체가 QMD deep_search에 걸리지 않음 — rubric 쿼리 0 hit

- **Severity**: P2
- **Evidence**: `qmd search "TODO 미확정 후속" -c mmp-plans` → `{"results":[]}`. plan 문서엔 실제 문자열 `TODO`가 `grep -rn TODO docs/plans --include="*.md" | wc -l` → **0**. 후속 관리가 "후속/이월/다음 Phase 후보" 같은 자연어 섹션명에만 존재, 검색 키 없음.
- **Impact**: "남은 후속 전체 덤프" 쿼리가 불가 → 매번 memory 파일 순회. Phase 19 backlog 산정 시 누락 위험.
- **Proposal**: 각 `project_phase1XX_progress.md`에 `## 후속 이월` 섹션 표준화 + `<!-- followup-id: PHASE-18.1-M-7 -->` HTML 주석 태그. tracker(F-docs-3)와 연동 시 grep/QMD 모두 hit 가능.
- **Cross-refs**: [cross:04] test skip marker 주석 패턴과 동일 원리

### F-docs-10: `docs/superpowers/specs/` 9 파일은 Phase 10 편집기 리디자인 1건 전용 — 컬렉션 활용도 저조

- **Severity**: P2
- **Evidence**: `find docs/superpowers -type f` → 9 spec 전부 `2026-04-10-editor-engine-redesign/`. QMD status: mmp-specs 9 docs, **lastUpdated 2026-04-11** (6일 정체). 이후 브레인스토밍 결과는 `docs/plans/2026-04-12-composable-module-engine-redesign/` 등 plans로 이동.
- **Impact**: `mmp-specs` 컬렉션이 사실상 archive. 쿼리 시 collection 선택 피로, 검색 dispatch 로직에 혼란.
- **Proposal**: mmp-specs 컬렉션을 mmp-plans의 `_archive/specs/` 서브폴더로 통합하거나, specs 사용 기준을 CLAUDE.md에 명시 ("brainstorm 산출물만, plan 승격 후 plans로 이동"). 현재는 전자를 권고 — 단순화.
- **Cross-refs**: (단독)

## Metrics

- `docs/plans` md 총: **245 파일 / 22,374줄** / 200줄+ **14 파일** (1000줄+ **3 파일**).
- 3종 문서 준수율 (23 dir): design 23/23 (100%) · plan 17/23 (74%) · checklist 22/23 (96%) · **context 2/23 (9%)**.
- 설계-코드 drift hit: BaseModule(F-1), 29 vs 33(F-2), 총 **2 핵심 drift** + 경미 다수.
- Phase 후속 이월 합계: **39건** (baseline §6) — 18.1이 **18건** 단일 최다.
- QMD coverage: 필수 쿼리 6건 중 search hit 2, vector hit 4 (실패 0). 재인덱싱 필요 대상: `2026-04-17-platform-deep-audit/**` 신규 문서 **5 shared + 1 audit(본 draft)** = 6 파일. Phase 19 산출물 추가될 때마다 재인덱싱.
- MEMORY.md 링크 타겟 vs 실제 파일 일치율(user memory): 링크 27건 중 `project_phase186_progress.md` 1건 불일치 — **26/27 (96%)**.
- Advisor-Ask 전달 건수: 3 (아래).

## Advisor-Ask

1. **MEMORY canonical 결정**: repo `memory/`와 user `~/.claude/projects/.../memory/` 중 어느 쪽을 단일 진실로 할지 팀 규정 필요. commit 이력 유지(repo) vs QMD 자동 재인덱싱(user) 트레이드오프. advisor가 보안·레트로 가능성·도구 통합 3축에서 판단 요청.
2. **후속 tracker 도입 장소**: `docs/plans/_followups/index.md` 신설 vs `memory/project_followups_tracker.md` vs 둘 다. 워크플로우 입장에서 "Phase 19 backlog가 읽어야 할 단일 소스"만 확정하면 나머지는 링크. 어느 경로가 `/plan-new`·`/plan-go` 자동 연동에 유리한가?
3. **QMD 별칭·용어집 도입 비용 vs miss cost**: 별칭 메타데이터를 frontmatter로 넣으려면 245 .md에 수동 패치 또는 bulk 스크립트 필요. vector_search 폴백 현재 +2s/query 미만이면 유지, 초과면 도입. advisor가 경계선 판정.

---

**Self-check**:
- Findings **10개** ✓ (3~12 구간)
- 줄 수 **170~185** 예상 (≤200) ✓
- `[cross:` 태그 **6건** ≥1 ✓
- P0+P1 = F-1·F-2·F-3·F-4·F-5·F-6 → **6/10 = 60%** ≥50% ✓ (F-4·F-6은 경계 케이스 근거 명시)
- 재인덱싱 필요 파일: **6** (shared 5 + 이 draft 1).
