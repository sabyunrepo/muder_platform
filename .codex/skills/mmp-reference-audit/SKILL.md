---
name: mmp-reference-audit
description: 우로보스 등 외부 레퍼런스 저장소를 분석해 MMP 훅/스크립트/워크플로우를 흡수 후보로 비교한다.
---

# MMP Reference Audit

## 목적

`mmp` 기준 핵심 워크플로우(훅, 스크립트, seed/seed-status 루틴)를 기준점으로,
우로보스/기타 레퍼런스를 정량적으로 비교해 **채택 / 보류 / 유지** 항목을 바로 정리한다.

코드 구현 전에 “무엇을 가져오고, 무엇은 보류할지”를 명확하게 잡고자 할 때 사용한다.

## 언제 사용

- 우로보스 리포지토리 링크를 받았을 때 비교 분석이 필요할 때
- 다른 도구를 참고해서 스크립트/훅을 흡수할 때
- “삭제 후보 / 유지 후보”를 문서화할 때

## 사용 절차

1. 먼저 분석 실행:
   - `bash scripts/mmp-reference-audit.sh --target <repo-url-or-path> --name "<라벨>"`
   - JSON 확인이 필요하면 `--format json`
   - 결과 저장: `--report /tmp/<라벨>-reference-audit.md`
2. 결과를 `docs/plans/`의 해당 계획 문서에 반영해 `체크리스트`를 갱신한다.
3. 바로 수정 가능한 항목(즉시 채택)은 `scripts/*` 또는 `.codex/*` 변경으로 분할한다.
4. 외부 전제(MCP/도구 등록, 런타임 환경 차이)가 필요한 항목은 `보류`로 남기고, 후속 이슈를 분리한다.
5. 분석 기반으로 새 훅/seed/gate/스크립트 변경이 끝나면:
   - `bash -n scripts/*.sh`
   - `bash .codex/scripts/mmp-workflow-hook-smoke-test.sh`
   - 변경 범위에 맞는 `scripts/mmp-local-ci.sh quick`

## 실행 예시

- `scripts/mmp-reference-audit.sh --target https://github.com/Q00/ouroboros.git --name ouroboros --report /tmp/ouroboros-audit.md`
- `scripts/mmp-reference-audit.sh --target /tmp/ouroboros --format json`

## 종료 조건

- 채택할 항목이 `docs/plans`에 반영되었는지
- 보류 항목은 `follow-up` 이슈 또는 `Deferred / Follow-up`로 기록되었는지
- 실행 가능한 변경(스크립트/훅)은 `scripts/mmp-reference-audit.sh` 결과와 일치하는지
