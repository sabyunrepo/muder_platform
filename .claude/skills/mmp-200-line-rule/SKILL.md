---
name: mmp-200-line-rule
description: MMP v3 파일/함수 크기 티어 가드. Go 500줄/함수 80, TS·TSX 400줄/함수 60·컴포넌트 150, MD 500줄(CLAUDE.md만 200). 구현 전에 한도를 예측하고, 초과 예상 시 분할 설계를 먼저 제시하도록 강제. 리팩터·신규 파일·PR 준비 시 트리거.
---

# mmp-file-size-rule — 유형별 티어 하드 리밋

> 스킬 디렉터리명은 `mmp-200-line-rule` 이지만, 규칙은 유형별 티어로 진화했다.
> CLAUDE.md만 200줄 유지(자동 로딩 토큰 비용). 그 외 MD는 500. Go/TS는 아래 표 기준.

## 왜
파일이 커지면 단일 책임이 무너지고 리뷰·테스트가 어려워진다. 200줄 일괄 규칙은
Go 패키지(함수 시그니처 + error 체이닝) 에는 과도하게 타이트했다. 유형별로
업계 표준에 맞춘 하드 리밋을 쓰되, **구현 전에 분할 설계**를 먼저 제시한다.
2026-04-21: MD 200줄 일괄 강제가 plan/PR 스펙을 과도하게 잘라 refs 분할 노이즈를
누적시켰다. CLAUDE.md만 200으로 유지하고 그 외 MD는 500으로 완화.

## 한도 (하드)

| 유형 | 파일 | 함수/컴포넌트 | 예외 |
|------|------|-------------|------|
| `.go` | 500 | 80 (table-driven data 제외) | sqlc/mockgen 생성물 |
| `.ts` / `.tsx` | 400 | 일반 60, JSX 컴포넌트 150 | d.ts 자동 생성 |
| `.md` | 500 (분할 기준) | - | index 파일, refs 조합 |
| `CLAUDE.md` | 200 | - | 자동 로딩 토큰 직격 |

> MD는 "무조건 한도 이하로 요약"이 아니다. 한도가 넘으면 **요약 대신 분할**한다.
> 상위 문서는 index + 링크로 유지하고 상세는 `refs/` 하위로 옮겨 참조한다.
> 내용 보존이 줄 수 준수보다 우선이다.

## 점검 순서

1. **구현 전 예측**: 변경 예정 파일의 현재 `wc -l` + 추가 예상 라인 계산. 한도 넘으면 분할 먼저.
2. **분할 제안을 사용자에게 먼저 제시** (코드 없이).
3. 승인 후 구현.
4. **MD는 요약 금지 원칙**: 기술 결정 근거·대안 비교·시나리오 기록은 가치 있으므로 잘라내지 말고 `refs/<topic>.md`로 옮긴다.

## Go 분할 패턴

| 대상 | 분할 |
|------|------|
| 거대 handler | `handler.go`(라우팅) + `{feature}_handler.go`(도메인별) |
| 거대 service | 인터페이스는 `service.go` 유지, 구현은 `service_{verb}.go` |
| 모듈 | `core.go` + `schema.go` + `factory.go` + `reactor.go` + `events.go` |
| repository | sqlc 생성물은 그대로, 상위 래퍼는 도메인별 파일 분리 |
| ws envelope | `envelope.go`(registry) + `msg_{category}.go` |
| 긴 함수 (80+) | 헬퍼 추출 + early return / guard 정리 |

## TypeScript/React 분할 패턴

| 대상 | 분할 |
|------|------|
| 거대 컴포넌트 (150+) | 서브컴포넌트 추출 + `{Name}.Header.tsx`/`.Body.tsx` |
| 페이지 | `index.tsx`(조합) + `sections/` 폴더 |
| hook 모음 | `hooks/use{Name}.ts` 개별 파일 + `hooks/index.ts` 배럴 |
| api | `api/{domain}.ts` + `api/index.ts` 배럴 |
| store | 슬라이스별 파일 + `store/index.ts` 조합 |
| 긴 일반 함수 (60+) | 헬퍼 분리 / 순수 함수로 pull out |

## Markdown 분할 패턴

| 대상 | 분할 |
|------|------|
| design.md (phase) | `design.md`(index + 개요) + `refs/architecture.md` / `refs/data-model.md` / `refs/security.md` / `refs/testing.md` |
| plan.md (긴 PR 목록) | `plan.md`(Wave 요약 + 링크) + `refs/prs/pr-NN.md` (PR별 상세) |
| checklist.md | index 유지, wave별 서브 체크리스트가 길어지면 `refs/wave-N-checklist.md` |
| findings / retrospective | 이벤트별 `refs/findings-YYYY-MM-DD.md` 로 append |

## 금지 패턴
- 한 파일에 `// -- section X --` 주석으로 수백 줄 욱여넣기
- 배럴 파일이 재수출 외 로직 포함
- 함수는 작은데 파일 안에 거대 anonymous closure 만 쌓기
- 테스트도 동일 리밋 적용 (table-driven data lines는 카운트 제외)

## 검증
구현 완료 후:
```bash
wc -l <변경파일들>
# Go 함수 길이 스캔 (rough):
awk '/^func /{name=$0; start=NR} /^}$/{if(start){print NR-start, name; start=0}}' file.go
```
파일이 한도 초과면 추가 분할. 함수가 한도 초과면 헬퍼 추출.

## 체크리스트
- [ ] 변경 예정 파일의 현재 라인 수 확인
- [ ] 추가 후 예상 라인 수 계산 (유형별 한도 대조)
- [ ] 초과 예상 시 분할 계획 먼저 제시
- [ ] 구현 완료 후 `wc -l`로 검증
- [ ] 서브에이전트 프롬프트에 유형별 한도 명시
