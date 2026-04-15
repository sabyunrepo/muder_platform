---
name: mmp-200-line-rule
description: MMP v3 모든 소스 파일(.go .ts .tsx .md)은 200줄 하드 리밋. 구현 전에 라인 수를 예측하고, 초과 예상 시 분할 설계를 먼저 제시하도록 강제. 리팩터·신규 파일·PR 준비 시 트리거.
---

# mmp-200-line-rule — 200줄 하드 리밋 분할 패턴

## 왜
200줄 이하 규칙은 프로젝트 CLAUDE.md의 하드 리밋이다. 파일이 커지면 단일 책임이 무너지고 리뷰·테스트가 어려워진다. 구현 후 쪼개기보다 **구현 전에 분할 설계**하면 변경이 적다.

## 점검 순서

1. **구현 전 예측**: 변경 예정 파일의 현재 `wc -l` + 추가 예상 라인을 계산. 200 넘으면 분할 먼저.
2. **분할 제안을 사용자에게 먼저 제시** (코드 없이).
3. 승인 후 구현.

## Go 분할 패턴

| 대상 | 분할 |
|------|------|
| 거대 handler | `handler.go`(라우팅) + `{feature}_handler.go`(도메인별) |
| 거대 service | 인터페이스는 `service.go` 유지, 구현은 `service_{verb}.go` |
| 모듈 | `core.go` + `schema.go` + `factory.go` + `reactor.go` + `events.go` |
| repository | sqlc 생성물은 그대로, 상위 래퍼는 도메인별 파일 분리 |
| ws envelope | `envelope.go`(registry) + `msg_{category}.go` |

## TypeScript/React 분할 패턴

| 대상 | 분할 |
|------|------|
| 거대 컴포넌트 | 서브컴포넌트 추출 + `{Name}.Header.tsx`/`.Body.tsx` |
| 페이지 | `index.tsx`(조합) + `sections/` 폴더 |
| hook 모음 | `hooks/use{Name}.ts` 개별 파일 + `hooks/index.ts` 배럴 |
| api | `api/{domain}.ts` + `api/index.ts` 배럴 |
| store | 슬라이스별 파일 + `store/index.ts` 조합 |

## 금지 패턴
- 한 파일에 `// -- section X --` 주석으로 수백 줄 욱여넣기
- 배럴 파일이 재수출 외 로직 포함
- 테스트 파일만 200줄 예외로 처리(테스트도 동일 리밋 적용)

## 검증
구현 완료 후:
```bash
wc -l <변경파일들>
```
하나라도 200 초과면 추가 분할.

## 체크리스트
- [ ] 변경 예정 파일의 현재 라인 수 확인
- [ ] 추가 후 예상 라인 수 계산
- [ ] 200 초과 예상 시 분할 계획 먼저 제시
- [ ] 구현 완료 후 `wc -l`로 검증
- [ ] 서브에이전트 프롬프트에도 "200줄 이하" 명시
