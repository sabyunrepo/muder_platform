# Opus ↔ Sonnet 위임 (advisor 패턴)

> Anthropic advisor tool 패턴의 Claude Code 응용 — Opus는 판단·지시·종합, Sonnet은 실제 실행.

## 모델 기준 (2026-04-19 이후)

- **메인**: `claude-opus-4-7` (Opus 4.7 1M context)
- **서브에이전트 기본**: `claude-sonnet-4-6` — **Sonnet 4.5 사용 금지** (4.6 출시 이후 구버전)
- **간단 검색·요약**: `claude-haiku-4-5-20251001`
- **복잡 판단 재위임**: `claude-opus-4-7` (security / architecture / 설계)

## 위임 대상

- **탐색·검색** (sonnet): `Explore`, `oh-my-claudecode:explore` — 대량 파일 grep/find
- **MD 작성** (sonnet): `oh-my-claudecode:writer`, `oh-my-claudecode:executor` — README·refs·progress
- **테스트·빌드 실행** (sonnet): `general-purpose`, `oh-my-claudecode:qa-tester` — verbose 출력은 서브에서 소화
- **단일 도메인 구현** (sonnet): `oh-my-claudecode:executor` 또는 `general-purpose`
- **보안·아키텍처 판단** (opus): `oh-my-claudecode:critic`, `oh-my-claudecode:security-reviewer`, `oh-my-claudecode:architect`

> 프로젝트 전용 agents (`go-backend-engineer`, `react-frontend-engineer`, `module-architect`, `test-engineer`, `security-reviewer`, `docs-navigator`, `platform-*`) 는 2026-04-27 cleanup으로 제거됨. 위 OMC 일반 agent 사용.

## 위임 시 필수

- 프롬프트에 **"결과만 ≤200 단어로 보고"** 명시 (raw 로그 메인 유입 차단)
- Agent tool `model` 파라미터로 `claude-sonnet-4-6` 명시 (기본 inherit 대신)
- 병렬 가능한 독립 task는 한 메시지에 다중 Agent 호출
- 파일 크기·함수 한도 프롬프트에 재명시 (서브는 nested CLAUDE.md 자동 로드 안 될 수 있음)

## Opus 직접 수행 유지

보안 판단, 아키텍처 결정, PR 생성 승인, user-facing 답변, 여러 서브에이전트 결과 종합.

**참고**: advisor tool(Anthropic API beta)은 Claude Code CLI에서 직접 사용 불가 — 위 패턴이 기능적 등가.
