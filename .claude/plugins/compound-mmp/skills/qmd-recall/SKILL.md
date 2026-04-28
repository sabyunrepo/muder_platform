---
name: qmd-recall
description: |
  QMD `mcp__plugin_qmd_qmd__vector_search`를 wrapper로 표준화. compound-mmp 4단계 라이프사이클 진입 시 컬렉션별 자동 회상 — Plan stage `mmp-plans` 5건 (유사 phase 패턴), Work stage `mmp-memory` N건 (코딩 규칙·feedback), Wrap stage `mmp-memory` (이전 세션 핸드오프).
  자동 활성화 트리거: `/compound-plan` 진입, `/compound-work` 진입, `/compound-wrap` 진입, "계획 세워", "이전에 비슷한 phase", "기억해 둔 ...", "memory 검색", "QMD 회상" 등 한글/영문 키워드.
  Compound `ce-compound`의 Phase 0.5 패턴(MEMORY.md 스캔→subagent inject)을 QMD vector_search로 변형 (plan Appendix A.7). `qmd-recall-table` 슬롯 출처 — `refs/mandatory-slots-canon.md` sister 카논 인용.
allowed-tools: mcp__plugin_qmd_qmd__vector_search, mcp__plugin_qmd_qmd__search, mcp__plugin_qmd_qmd__get, mcp__plugin_qmd_qmd__multi_get
---

# qmd-recall — QMD 기반 remembering-conversations

compound-mmp의 라이프사이클 진입 시 **이전 plan·메모리·세션 핸드오프**를 자동 회상해 다음 단계의 컨텍스트로 inject. 카논: plan Appendix A.7.

## 활성 컨텍스트별 회상 정책

| 진입점 | 컬렉션 | k | 쿼리 형식 |
|--------|--------|---|----------|
| `/compound-plan <topic>` | `mmp-plans` | 5 | `<topic>` 그대로 (helper.steps[0].args.query) |
| `/compound-work [pr-id]` | `mmp-memory` | 3 | 활성 phase title + scope (메인 컨텍스트가 결정) |
| `/compound-wrap` | `mmp-memory` | 3 | 직전 세션의 PR 키워드 + 미해결 키워드 |
| 일반 "이전에 비슷한 ..." 발화 | `mmp-memory` 또는 `mmp-plans` | 5 | 사용자 발화 그대로 |

## 입력 contract

```json
{
  "collection": "mmp-plans" | "mmp-memory" | "mmp-specs" | "mmp-v2-docs",
  "query": "<자연어 또는 슬러그>",
  "k": 5,
  "minScore": 0.5
}
```

`k`와 `minScore`는 호출 측이 override 가능. 기본값은 본 SKILL이 정한다.

## 출력 contract

```markdown
| # | path | 인용 | docid | score |
|---|------|------|-------|-------|
| 1 | <relative path> | <한 줄 요약> | #abc123 | 0.78 |
| 2 | ... | ... | ... | 0.72 |
| 3 | ... | ... | ... | 0.68 |
| 4 | ... | ... | ... | 0.61 |
| 5 | ... | ... | ... | 0.55 |
```

`minScore` 미달 row는 표에서 제외하고 "회상 부족 (score 낮음)" 메시지 출력. 폴백 없이 0건 회상도 정상 — 신규 phase 토픽일 때 자연스러움.

## 호출 시퀀스 (메인 컨텍스트)

### 1. `mcp__plugin_qmd_qmd__vector_search` 호출

```
collection: <위 표의 컬렉션>
query: <위 표의 쿼리>
k: <위 표의 k>
```

Out: 결과 array. 각 element에 `path`, `score`, `docid`, `excerpt` 필드 포함.

### 2. excerpt 추출 + 표 포맷

각 결과의 `excerpt` 첫 1-2문장만 인용. 50단어 초과 시 절단. **헤딩·코드블록은 인용에서 제외** (표가 깨짐).

### 3. Plan/Work 단계로 inject

- `/compound-plan` Step 1 종료 후 → 표 그대로 brainstorm Step 2 컨텍스트로 전달
- `/compound-work` 진입 직후 → 메인이 활성 phase 작업 시작 전 1회 read
- `/compound-wrap` Step 5 핸드오프 노트 작성 시 → 직전 세션 패턴 인용

## 도구 호출 카논 (참고)

```
mcp__plugin_qmd_qmd__vector_search:
  collection (str): "mmp-plans" 등 4개 컬렉션 중 하나
  query (str): 자연어
  k (int): 1-20
  minScore (float, opt): 0.0-1.0

mcp__plugin_qmd_qmd__search (~30ms):
  키워드/exact phrase. vector보다 빠르나 의미 매칭 약함. fallback 용도.

mcp__plugin_qmd_qmd__get:
  path/docid 단일 fetch. 회상 표의 docid를 사용해 정밀 read.

mcp__plugin_qmd_qmd__multi_get:
  glob 또는 comma-separated. 여러 docid를 한 번에 read.
```

## Anti-pattern

- ❌ vector_search 결과를 raw JSON dump → 메인 컨텍스트가 사람 읽기 좋게 표 포맷 필수
- ❌ 회상 결과를 brainstorm·write-plans에 inject 안 하고 별도 출력만 → 회상의 의미 상실 (Compound A.7 핵심)
- ❌ k > 10 → vector_search latency 증가, 컨텍스트 토큰 비용 ↑. 기본 5 유지
- ❌ minScore=0 → 무관한 결과까지 표에 포함 → 메인이 잘못 판단. 기본 0.5 유지
- ❌ search(키워드) 단독 사용 → 의미 매칭 누락. vector_search가 1차, 0건일 때만 search fallback

## 실패 모드

- **0건 회상**: "유사 phase 회상 없음 — 신규 토픽" 메시지 출력 후 brainstorm 단계로 진입. 정상 흐름.
- **MCP 미가용**: `mcp__plugin_qmd_qmd__*` 도구 자체 부재 시 (~/.claude/projects 메타 누락) → 메인 컨텍스트가 "QMD MCP 미연결, 회상 skip" 메시지 + plan 직접 작성으로 fallback.
- **컬렉션 임베딩 미완료**: status 체크는 호출 측이 결정 (본 SKILL은 단순 wrapper).

## 검증

- `/compound-plan` Step 1 산출이 helper.steps[0].args.query 와 일치하는지 메인이 자가검증
- 회상 표가 brainstorm 단계 컨텍스트에 포함되었는지 메인이 자가검증 (없으면 A.7 핵심 위반)
