# QMD 사용 룰

> `docs/plans/`, `memory/`, `docs/superpowers/` 경로의 문서는 **반드시 QMD MCP 먼저** 사용.
> Grep/Read 직접 접근은 QMD로 대상 파일을 특정한 후에만 허용.

## QMD MCP 도구 (`plugin:qmd:qmd`)

| 도구 | 속도 | 용도 |
|------|------|------|
| `search` | ~30ms | 키워드 정확 매칭 (파일명, 함수명, PR ID) |
| `vector_search` | ~2s | 시맨틱 검색 (개념, 설계 의도) |
| `deep_search` | ~10s | 하이브리드 + 리랭킹 (모호한 쿼리) |
| `get` | 즉시 | 경로/docid로 특정 문서 전문 조회 |
| `multi_get` | 즉시 | glob/리스트로 다중 문서 배치 조회 |

## 컬렉션

- `mmp-plans` (290 docs) — 설계 문서, PR 스펙, 체크리스트, 아키텍처
- `mmp-memory` (60 docs, **canonical = repo `memory/`**) — 프로젝트 메모리, 피드백, 코딩 규칙
- `mmp-specs` (9 docs) — 브레인스토밍 결과, 엔진 재설계 스펙
- `mmp-v2-docs` (98 docs) — MMP v2 머더미스터리 호텔 UX 이식 원본

## 강제 규칙

1. **Grep on `docs/plans/` 절대 금지** — QMD `search` 사용
2. **설계 결정 / PR 스펙 조회** → `qmd get "refs/prs/pr-9.md"` 또는 `qmd search "PR-9" -c mmp-plans`
3. **시맨틱 질문** ("왜 이 결정을 했지?") → `qmd deep_search` 또는 `qmd vector_search`
4. **Read 허용 케이스**: QMD로 대상 특정 후 소스코드 파일(.go, .ts, .tsx) 읽기, 또는 정확한 경로+줄번호 확인

## 메모리 쓰기 룰

- 신규 memory 파일은 `memory/<name>.md` (repo 상대)로만 작성
- user home `~/.claude/projects/.../memory/` 는 archival (읽기·쓰기 금지)
- 상세: `memory/feedback_memory_canonical_repo.md`

## 운영

- QMD MCP는 장시간 세션에서 메모리 누수 가능 — 컬렉션 최소화 + 주기 재시작
- 상세: `memory/feedback_qmd_memory_leak.md`
