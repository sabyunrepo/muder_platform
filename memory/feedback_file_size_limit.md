---
name: 파일/함수 크기 티어 (Go 500 / TS·TSX 400 / MD 500 · CLAUDE.md만 200)
description: 유형별 하드 리밋. 2026-04-21 MD 200→500 완화 (CLAUDE.md만 자동 로딩 비용 때문에 200 유지). 한도 초과 시 요약 금지, index + refs/ 분할 공식.
type: feedback
---
모든 소스 파일은 유형별 티어 한도 이내로 유지.

| 유형 | 파일 | 함수/컴포넌트 |
|------|------|-------------|
| `.go` | **500줄** | 80줄 (table-driven 데이터 제외) |
| `.ts` / `.tsx` | **400줄** | 일반 60줄, JSX 컴포넌트 150줄 |
| `.md` | **500줄 (분할 기준)** | - |
| `CLAUDE.md` | **200줄** | - |

**예외**: sqlc/mockgen 자동 생성물. MD는 index 파일일 경우 한도 초과 OK(단 refs 분할 선검토 후).

**Why:** 200줄 일괄 규칙은 Go 패키지(에러 체이닝 + DI + 인터페이스)에 과도하게 타이트해 잦은 분할 노이즈를 만들었다. 업계 표준(stdlib 평균 300~500, Clean Code 함수 20~80)에 맞춰 유형별 티어로 진화. 1차 변경: 2026-04-15 commit `52c6216`. **2차 변경 (2026-04-16 PR #65)**: MD 200 하드 강제가 설계 근거·시나리오를 잘라내는 역효과. 분할 기준으로 완화 + `index + refs/<topic>.md` 분할 공식. **3차 변경 (2026-04-21 phase-19-residual md-rule-relax-500)**: MD 200줄 강제가 여전히 plan/PR 스펙을 과도하게 잘라 분할 노이즈 누적. CLAUDE.md만 자동 로딩 토큰 비용 때문에 200 유지하고 나머지 MD는 500으로 완화. 분할 임계는 올라가도 패턴(index+refs)은 동일.

**How to apply:**
1. **구현 전**: 변경 예정 파일의 현재 `wc -l` + 추가 예상 라인을 유형별 한도에 대조. 초과 예상 시 분할 설계 먼저 제시.
2. **CLAUDE.md 편집 시 200줄 한도 우선** — 토큰 비용 직결.
3. **그 외 MD**: 500줄까지 허용. 초과 시 `refs/<topic>.md` 분리 패턴 공식.
4. **서브에이전트 프롬프트**: 파일/함수 한도를 유형에 맞게 명시 ("Go 500/80" / "TS 400/60·컴포넌트 150" / "MD 500 (CLAUDE.md 200)").
5. **분할 패턴**:
   - Go: handler 분리 / service 인터페이스 쪼개기 / 모듈은 core+schema+factory+reactor / 긴 함수 헬퍼 추출
   - React: 서브컴포넌트 추출 / hooks 개별 파일 + 배럴 / api 도메인별 파일 + 배럴
   - MD: `design.md`/`plan.md`/`checklist.md` index + `refs/architecture.md`, `refs/execution-model.md`, `refs/prs/pr-N.md` 등 — 요약 금지, 상세 보존
   - 공통: 한 파일 내 anonymous closure 욱여넣기 금지
6. **코드 리뷰 체크**: `wc -l` + 큰 함수 스캔 (`awk '/^func /{...}'`)
