---
name: 파일/함수 크기 티어와 책임 경계 (Go 500 / TS·TSX 400 / MD 500 · CLAUDE.md만 200)
description: 유형별 크기 한도는 숫자 맞추기 목표가 아니라 책임 분리 경보. 초과 예상 시 기능 축소가 아니라 컴포넌트, 함수, adapter, service, refs 경계를 먼저 설계한다.
type: feedback
---
모든 소스 파일은 유형별 티어 한도 이내로 유지하되, 한도의 목적은 "한 파일 안에 최대한 욱여넣기"가 아니다. 줄 수는 책임이 섞였는지 확인하는 경보이며, 완료 기준은 유지보수 가능한 경계다.

| 유형 | 파일 | 함수/컴포넌트 |
|------|------|-------------|
| `.go` | **500줄** | 80줄 (table-driven 데이터 제외) |
| `.ts` / `.tsx` | **400줄** | 일반 60줄, JSX 컴포넌트 150줄 |
| `.md` | **500줄 (분할 기준)** | - |
| `CLAUDE.md` | **200줄** | - |

**예외**: sqlc/mockgen 자동 생성물. MD는 index 파일일 경우 한도 초과 OK(단 refs 분할 선검토 후).

**Why:** 200줄 일괄 규칙은 Go 패키지(에러 체이닝 + DI + 인터페이스)에 과도하게 타이트해 잦은 분할 노이즈를 만들었다. 업계 표준(stdlib 평균 300~500, Clean Code 함수 20~80)에 맞춰 유형별 티어로 진화. 다만 티어 숫자는 설계 품질의 대체물이 아니다. 500줄 이하라도 handler, persistence, adapter, view, interaction, runtime 판단이 한 파일에 섞이면 실패다. 반대로 의미 있는 경계와 테스트 가능성이 분명하면 숫자 경고는 분할 설계를 촉발하는 신호로 다룬다. 1차 변경: 2026-04-15 commit `52c6216`. **2차 변경 (2026-04-16 PR #65)**: MD 200 하드 강제가 설계 근거·시나리오를 잘라내는 역효과. 분할 기준으로 완화 + `index + refs/<topic>.md` 분할 공식. **3차 변경 (2026-04-21 phase-19-residual md-rule-relax-500)**: MD 200줄 강제가 여전히 plan/PR 스펙을 과도하게 잘라 분할 노이즈 누적. CLAUDE.md만 자동 로딩 토큰 비용 때문에 200 유지하고 나머지 MD는 500으로 완화. 분할 임계는 올라가도 패턴(index+refs)은 동일.

**How to apply:**
1. **구현 전**: 변경 예정 파일의 현재 `wc -l` + 추가 예상 라인을 유형별 한도에 대조. 초과 예상 시 기능을 빼거나 한 파일에 압축하지 말고 책임 경계 분할 설계를 먼저 제시한다.
2. **CLAUDE.md 편집 시 200줄 한도 우선** — 토큰 비용 직결.
3. **그 외 MD**: 500줄까지 허용. 초과 시 `refs/<topic>.md` 분리 패턴 공식.
4. **서브에이전트 프롬프트**: 파일/함수 한도와 함께 "LOC 통과가 목표가 아니라 책임 분리, 테스트 가능성, public API 안정성이 목표"라고 명시한다.
5. **분할 기준**: 줄 수가 아니라 변경 이유를 기준으로 나눈다. 서로 다른 이유로 바뀌는 코드는 같은 파일 안에 남기지 않는다.
6. **분할 패턴**:
   - Go: handler 분리 / service 인터페이스 쪼개기 / 모듈은 core+schema+factory+reactor / 긴 함수 헬퍼 추출
   - React: view 서브컴포넌트 / interaction hook / DTO-to-ViewModel adapter / persistence helper / api 도메인별 파일로 분리
   - MD: `design.md`/`plan.md`/`checklist.md` index + `refs/architecture.md`, `refs/execution-model.md`, `refs/prs/pr-N.md` 등 — 요약 금지, 상세 보존
   - 공통: 한 파일 내 anonymous closure 욱여넣기 금지
7. **코드 리뷰 체크**: `wc -l` + 큰 함수 스캔 (`awk '/^func /{...}'`) 후, 초과/경계 파일은 책임이 섞였는지 별도로 리뷰한다.

**Done when:**
- 파일/함수/컴포넌트가 한도 이내이며, 한도에 맞추려고 동작을 줄이거나 검증을 생략하지 않았다.
- 분리된 단위는 이름만 보고 역할을 설명할 수 있고, 소비자는 내부 구현을 읽지 않아도 사용할 수 있다.
- React는 view, interaction, adapter, persistence 책임이 추적 가능하고, Go는 handler, service, repository/provider, engine/runtime 판단 경계가 추적 가능하다.
- 새 helper나 component는 숫자 맞추기용 조각이 아니라 독립 테스트 또는 독립 변경 이유를 가진다.

**Avoid:**
- 500줄/400줄 안에 맞추려고 검색, 목록, 상세, 저장, adapter, validation을 한 파일에 계속 추가하지 않는다.
- 긴 로직을 anonymous closure, 잡다한 `utils`, 의미 없는 `helpers`, 과도한 barrel export로 숨기지 않는다.
- "줄 수 통과"를 리뷰 통과 근거로 쓰지 않는다. 줄 수는 첫 번째 신호이고, 최종 판단은 책임 경계와 유지보수성이다.
