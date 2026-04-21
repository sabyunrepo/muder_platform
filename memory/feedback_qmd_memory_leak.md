---
name: QMD MCP 메모리 누수 운영 규칙
description: bun MCP 프로세스가 임베딩 캐시를 무한 상주시켜 장시간 세션에서 OOM 위험. 컬렉션 최소화 + 주기적 재시작
type: feedback
---
QMD MCP는 단일 bun 프로세스가 모든 컬렉션의 벡터/임베딩 모델(embeddinggemma)을 힙에 상주시키며, 런타임 캐시 flush API가 없다. 장시간 세션에서 RSS 10GB+ 까지 누적 가능 (2026-04-15: PID 41571이 685 docs로 11.8GB / 36분 측정).

**Why:** 2026-04-15 세션에서 PID 41571 RSS 11.8GB / %MEM 35.2% 발견. 분석 결과 vantict(IaaS) 컬렉션 424 docs(전체 61%)가 무관한 프로젝트인데 같이 상주 중이었음. 원인은 글로벌 단일 인덱스 + 캐시 정리 로직 부재.

**How to apply:**
- **컬렉션 등록 최소화**: 현재 작업 프로젝트만 등록. 타 프로젝트는 `qmd collection remove <name>` 후 필요 시 재추가 또는 `--index <name>` 으로 분리
- **검색 우선순위**: `search`(키워드, ~30ms) → 모호할 때만 `vector_search`/`deep_search` (벡터 검색이 모델 메모리 점유)
- **장시간 세션**(3h+): 주기적 수동 재시작 — `kill -TERM <PID>` 후 Claude Code 재기동. 디스크 인덱스는 보존되어 데이터 손실 없음
- **재발 시 진단 명령**: `ps aux | grep "bun.*qmd.ts mcp"` 로 RSS 확인
- **장기 옵션**: bun `--smol` 플래그 또는 `BUN_JSC_heapSize` 환경변수 실험 (인덱스 로드 실패 리스크 있음)
