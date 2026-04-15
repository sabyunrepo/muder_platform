---
name: mmp-qmd-first
description: MMP v3 프로젝트에서 docs/plans/, memory/, docs/superpowers/ 경로의 문서를 조회할 때 반드시 QMD MCP를 먼저 사용하도록 안내. Grep/Read 직접 접근이 Hook으로 차단됨. 설계 문서, PR 스펙, 피드백, 이전 Phase 결과를 찾을 때 트리거.
---

# mmp-qmd-first — QMD 우선 검색

## 왜
`docs/plans/`, `memory/`, `docs/superpowers/` 경로는 Grep 차단 + Read 경고 Hook이 설치되어 있다. QMD MCP(`plugin:qmd:qmd`)는 3개 컬렉션에 사전 인덱싱된 벡터 임베딩을 제공하므로, grep보다 빠르고 정확하며 토큰 비용이 낮다.

## 컬렉션
- `mmp-plans` — 설계 문서, Phase 체크리스트, PR 스펙, 아키텍처 결정
- `mmp-memory` — 프로젝트 메모리, 피드백, 코딩 규칙, Phase 진행 상황
- `mmp-specs` — Superpowers 브레인스토밍 결과, 엔진 재설계 스펙

## 도구 선택
| 의도 | 도구 | 속도 |
|------|------|------|
| 정확 매칭(파일명, PR ID, 함수명) | `search` | ~30ms |
| 개념/의도/"왜" 질문 | `vector_search` | ~2s |
| 모호한 쿼리, 여러 표현 가능 | `deep_search` | ~10s |
| 경로/docid로 전문 조회 | `get` | 즉시 |
| glob 또는 리스트 배치 조회 | `multi_get` | 즉시 |

## 워크플로우

1. **컬렉션 선택**: 기본 `mmp-plans`. 코딩 규칙·피드백·Phase 진행 → `mmp-memory`. 엔진 스펙 → `mmp-specs`.
2. **키워드 우선 → 실패 시 벡터 → 여전히 모호하면 deep**:
   ```
   qmd search "PR-A7" -c mmp-plans
   qmd vector_search "왜 Factory 패턴을 썼는가" -c mmp-specs
   qmd deep_search "토큰 redaction" -c mmp-memory
   ```
3. **상위 3-5건만 `get`으로 전문 확인**. 무턱대고 전체 문서 로딩 금지.
4. **Read 허용 케이스**: QMD로 대상 파일을 특정한 후 소스코드(.go/.ts/.tsx) 읽기. 정확한 경로 + 줄 번호가 필요할 때만.

## 실패 시 폴백
- QMD 결과 0건 → `vector_search`로 동일 쿼리 재시도.
- 여전히 0건 → 유사 키워드 3개 생성해 `search` 재시도.
- 마지막 수단으로만 Read 허용(docs-navigator가 판단).

## 예시

### Bad
```
grep -r "snapshot redaction" docs/plans/   # Hook이 차단
```

### Good
```
qmd search "snapshot redaction" -c mmp-plans
qmd vector_search "복구 경로 민감 정보 마스킹" -c mmp-plans
qmd get "2026-04-15-phase-18.3-cleanup/design.md"
```

## 체크리스트
- [ ] 경로가 `docs/plans/`, `memory/`, `docs/superpowers/` 중 하나인가? → QMD 필수
- [ ] `search`로 먼저 시도했는가?
- [ ] 최대 3개 문서만 `get`했는가? (컨텍스트 절약)
- [ ] 원문 덤프 대신 요약을 팀원에게 전달했는가?
