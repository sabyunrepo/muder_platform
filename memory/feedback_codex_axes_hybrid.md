---
name: Codex 하이브리드 4-agent axis 매핑 (V1)
description: compound-review 4-agent axis ↔ 모델 매핑 카논. perf+test = Codex outside-view, arch+security = Claude canon. V2 sensitive PR override placeholder.
type: feedback
---

compound-review 4-agent 리뷰 (security/perf/arch/test) 의 **axis ↔ 모델 매핑**은 `post-task-pipeline.json` `before_pr` 배열이 단일 source (HIGH-A1 카논). 이 파일은 V1 하이브리드 결정의 *이유·적용법·anti-pattern*을 정의하는 카논.

## Why

2026-05-02 사용자 + codex peer-mode 합의. PR-2c #107 deadlock class(`handleCombine` lock-during-publish)를 4-Claude-agent 리뷰가 **놓친** 사고 이후, 동일 모델 4개 병렬 = inside-view bias 구조적 한계를 인정.

codex의 직접 pushback 3개를 수용:
1. **test axis에서 Codex 우위는 추측** — 불변식 prompt 주입 없으면 얕은 리뷰 (test wrapper에 경고 의무화)
2. **security 단일 모델 위험** — auth/WS/permission/PlayerAware 터치 PR에서 단일 outside-view로는 부족 (V2 sensitive PR override 계획)
3. **PhaseReactor arch는 카논 prompt-pack 필수** — 카논 없이 outside-view 검출 불가 (arch prompt에 33-module 팩 의무화)

## How to apply

### V1 활성 (이번 PR 기준)

| axis | agent | 모델 | 역할 |
|------|-------|------|------|
| arch | `oh-my-claudecode:critic` | opus | SOLID/SRP/PhaseReactor·PlayerAware/33-module 카논 보유, inside-view 강점 |
| security | `oh-my-claudecode:security-reviewer` | opus | WS `?token=`/PlayerAware redaction/RFC 9457/OAuth-local auth 카논 집중 |
| perf | `codex-perf-reviewer` | sonnet (wrapper) | Codex(gpt-5.4) outside-view: deadlock+goroutine+lock-during-publish 카논 체크리스트 자동 주입 |
| test | `codex-test-reviewer` | sonnet (wrapper) | Codex(gpt-5.4) outside-view: 불변식 prompt 주입 필수 — wrapper가 누락 시 경고 |

**카논 prompt-pack 의무**: Codex axis는 반드시 각 axis별 카논 체크리스트를 prompt에 인라인. wrapper 서브에이전트가 자동 prepend. Codex는 대화 컨텍스트·카논 메모리가 없으므로 wrapper가 보충하지 않으면 outside-view 검출 불가.

### V2 placeholder (미래)

auth/WS/permission/PlayerAware 터치 sensitive PR 감지 시:
- security axis → `codex-adversarial-security-reviewer` (Codex: replay/token logging/cross-player leak/stale auth/lock-during-publish/privilege escalation/WS frame injection/msg type confusion)
- test axis → Claude (swap back)

sensitive PR detection 구현 후 `pipeline.json`에서 조건 분기 활성화. 현재는 `codex-adversarial-security-reviewer.md` 파일만 존재, pipeline.json 미연결.

### 검증 단계

1. dry-run 1건 (`compound-review-dry-run.sh`) → subagent_type 4개 확인
2. 일반 PR 1건에 적용 → Codex가 Claude 대비 unique finding 잡는가 비교
3. unique finding 확인 후 V2 활성화 결정

## anti-pattern

- ❌ `pipeline.json` 단일 source 우회해 슬래시 본문에 axis 하드코딩
- ❌ Codex axis prompt에서 카논 체크리스트 누락 (wrapper 자동 주입 검증 필수)
- ❌ test axis에 불변식 미주입 (codex peer feedback 직접 지적 — 얕은 리뷰로 이어짐)
- ❌ codex 응답 verbatim 사용자 전달 (integrator 책임 회피 — Opus가 압축·번역·통합)

## 카논 cross-link

- [`feedback_codex_opus_peers.md`](feedback_codex_opus_peers.md) — peer 권한 (Codex ↔ Opus 동등, Opus는 판정관 아닌 integrator)
- [`feedback_4agent_review_before_admin_merge.md`](feedback_4agent_review_before_admin_merge.md) — 강제 정책 master (admin-merge 전 4-agent 필수)
- `feedback_codex_escape_hatch.md` — TBD rescue 카논 (V2 sensitive PR 감지 실패 시 수동 override)
