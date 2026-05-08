# Issue #523 Checklist - 단서 Kill Effect Runtime 계약

## Coverage Plan

- Docs contract:
  - `docs/plans/2026-05-08-issue-523-kill-effect-contract/design.md`에 현재 owner, runtime event shape, state-owner boundary, 후속 구현 범위를 기록한다.
- Code coverage:
  - 이번 slice는 production code 변경이 없다.
  - 검증은 `git diff --check`와 Markdown review로 대체한다.

## Tasks

- [x] 현재 clue item effect runtime 지원 범위를 확인한다.
- [x] 현재 alive/dead state와 condition 사용 경로를 확인한다.
- [x] voting/accusation이 alive state에 의존하는 지점을 확인한다.
- [x] `kill`을 `clue_interaction` 내부에서 구현할 수 있는지 결정한다.
- [x] 최소 editor config, request event, authoritative status event, policy boundary를 문서화한다.
- [x] backend/frontend/test ownership을 포함한 후속 구현 이슈를 만든다: [#536](https://github.com/sabyunrepo/muder_platform/issues/536).
- [ ] `Closes #523`, `Refs #536`로 PR을 연다.

## Done When

- #523에 runtime 책임 결정이 커밋으로 남아 있다.
- 구현 후속 작업이 GitHub issue로 추적된다.
- PR local validation에 docs-only 변경임이 기록된다.
