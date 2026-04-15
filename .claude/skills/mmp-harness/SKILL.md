---
name: mmp-harness
description: [DEPRECATED — use mmp-pilot] MMP v3 6인 전문가 팀 오케스트레이터. mmp-pilot 스킬의 Layer 2 팀 편성 참조 문서로만 남음. 직접 트리거하지 말 것 — 모든 구현·리뷰·테스트는 mmp-pilot + /plan-go 경유.
---

> ⚠️ **Deprecated (M3)** — mmp-pilot의 Layer 2 팀 편성 로직으로 흡수되었습니다.
> 직접 호출 금지. `mmp-pilot` 스킬 또는 `/plan-go` 커맨드 사용.
> 이 문서는 팀 편성 규칙·에이전트 책임 매핑을 위한 **내부 레퍼런스**로만 유지됩니다.

# mmp-harness — (참조용) 전문가 팀 편성 규칙

Go 1.25 + React 19 + gorilla/websocket + pgx/sqlc + asynq + Zustand + @jittda/ui 기반 실시간 머더미스터리 플랫폼 작업을 6인 전문가 팀으로 수행한다.

## 팀원
- `docs-navigator` — QMD 기반 설계 문서·메모리 조회
- `go-backend-engineer` — Go 3계층 + 200줄 리밋
- `react-frontend-engineer` — React 19 + Zustand 3-layer + @jittda/ui
- `module-architect` — BaseModule+ConfigSchema+PhaseReactor+Factory
- `test-engineer` — mockgen+testcontainers+Vitest+MSW+Playwright 75%+
- `security-reviewer` — AppError+RFC 9457, WS 토큰, OWASP, redaction

## Phase 0: 컨텍스트 확인 (필수)

매 실행 시작 시 다음을 확인한다:
1. `.claude/active-plan.json` 읽기 — 현재 phase/wave/PR/task와 scope를 파악.
2. `.claude/runs/{run-id}/{wave}/{pr}/{task}/` 디렉토리 존재 여부:
   - 없음 → **초기 실행**
   - 있음 + 사용자가 부분 수정 요청 → **부분 재실행** (해당 에이전트만 재호출, 다른 산출물은 보존)
   - 있음 + 사용자가 새 요구 제공 → **새 실행** (`.claude/runs/{run-id}/{wave}/{pr}/{task}/` → `_workspace_prev/`로 이동 후 재생성)
3. scope 외 파일 편집 요청인지 확인(Hook BLOCK 대상). scope 외이면 사용자에게 확인.

## Phase 1: 작업 분해 및 실행 모드 선택

요청을 다음 카테고리로 분류하고 팀 편성을 결정한다:

| 작업 유형 | 편성 (Agent 호출 또는 팀원) |
|----------|---------------------------|
| 순수 조사/설계 질문 | `docs-navigator` 단독 (서브 에이전트) |
| Go 백엔드 단일 변경 | go-backend → test → security (파이프라인 팀 3인) |
| React 프론트 단일 변경 | react-frontend → test → (필요 시 security) |
| 풀스택 기능 | docs → go+react 병렬 → test → security (팀 5인) |
| 신규 모듈 추가 | docs → module-architect → go-backend → test → security |
| 보안/에러 핸들링 변경 | security가 설계 리드 → go-backend → test |
| 리뷰 전용 | security + test 병렬 (팀 2인, 생성-검증의 검증만) |

**실행 모드:**
- 팀원 2명 이하 → 서브 에이전트(`Agent` 도구, `model: "opus"`, 필요 시 `run_in_background: true`)
- 팀원 3명 이상 → 에이전트 팀(`TeamCreate` + `TaskCreate` + `SendMessage`)
- Phase별 특성이 다를 때 → 하이브리드(수집=서브, 합의=팀)

## Phase 2: 팀 편성 및 작업 할당

### 에이전트 팀 모드
1. `TeamCreate`로 팀 편성 (팀 이름: `mmp-<작업코드>`, 예: `mmp-ws-fix`).
2. `TaskCreate`로 작업 분해 — 각 task에 담당 에이전트, 의존 task, 입출력 파일 경로 명시.
3. 팀원은 `SendMessage`로 직접 통신(대용량은 파일 경유).
4. 오케스트레이터는 상태 모니터링·결과 종합·Blocker 에스컬레이트만 담당.

### 서브 에이전트 모드
1. `Agent` 도구 직접 호출, `subagent_type`에 에이전트 이름, `model: "opus"` 명시.
2. 독립 작업은 단일 메시지에 다중 Agent 호출로 병렬화.

## Phase 3: 데이터 전달 규칙

`.claude/runs/{run-id}/{wave}/{pr}/{task}/` 하위에 중간 산출물을 저장한다. 파일명: `{순서}_{에이전트}_{아티팩트}.{확장자}`.

예:
- `01_docs_context.md` — 관련 설계/피드백 요약
- `02_go_changes.md` — 백엔드 변경 목록 + 라인 수
- `02_frontend_changes.md` — 프론트 변경 목록 (병렬)
- `03_test_report.md` — 테스트 결과 + 커버리지 델타
- `04_security_report.md` — 보안 발견

최종 산출물(코드)은 실제 경로에 직접 커밋. `.claude/runs/{run-id}/{wave}/{pr}/{task}/`는 보존(감사 추적용).

## Phase 4: 검증 및 에러 핸들링

- 빌드/타입/테스트 실패 시 담당 에이전트가 1회 재시도. 재실패 시 오케스트레이터에 에스컬레이트하고 사용자 확인.
- security-reviewer가 Blocker를 보고하면 머지 중단, 담당자에게 수정 task 재할당.
- 커버리지 하락 감지 시 test-engineer가 누락 테스트 task 생성.
- scope violation 감지 → Hook이 BLOCK → 사용자에게 plan 범위 확장 요청.

## Phase 5: 산출물 종합 및 완료

1. `.claude/runs/{run-id}/{wave}/{pr}/{task}/` 요약을 사용자에게 보고 (에이전트별 성과 + 미해결 항목).
2. 변경된 파일을 `wc -l`로 검증(200줄 리밋).
3. plan-autopilot 컨텍스트면 checklist 갱신 제안.
4. 사용자에게 피드백 1문 요청(Phase 7 진화 루프).

## 팀 크기 가이드
- 소규모(5-10 작업): 2-3명 서브 에이전트 / 파이프라인
- 중규모(10-20 작업): 3-5명 팀
- 대규모(20+ 작업): 5-6명 팀 + 작업 분할 wave

## 공용 스킬 참조
- QMD 검색 워크플로우 → `mmp-qmd-first`
- Go 파일 분할 패턴 → `mmp-200-line-rule`
- 모듈 Factory 템플릿 → `mmp-module-factory`
- 테스트 전략 매트릭스 → `mmp-test-strategy`
- 보안 체크리스트 → `mmp-security-rfc9457`

## 테스트 시나리오

**정상 흐름**: "세션 시작 경로에 감사 로그 추가해줘"
→ Phase 0 active-plan 확인 → Phase 1 "Go 백엔드 + 보안" 판정 → Phase 2 팀 3인(go, test, security) → go가 session 핸들러 수정 → test가 통합 테스트 → security가 redaction 검토 → Phase 5 보고.

**에러 흐름**: security가 "토큰이 로그에 노출됨" Blocker 보고
→ go-backend에 수정 task 재할당 → test가 로그 필드 마스킹 단위 테스트 추가 → 재검토 → 통과 시 머지.

## 후속 작업 대응

- "이전 PR 보안 리뷰 다시" → Phase 0에서 `.claude/runs/{run-id}/{wave}/{pr}/{task}/` 존재 확인 → 부분 재실행 모드 → security-reviewer만 재호출, 이전 04_security_report.md를 입력으로 개선 요청.
- "같은 방식으로 다른 핸들러에도 적용" → 기존 팀 재사용, task 목록에만 추가.
