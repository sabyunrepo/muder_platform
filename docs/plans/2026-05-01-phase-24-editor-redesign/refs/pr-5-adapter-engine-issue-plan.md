# Phase 24 PR-5A — Adapter/Engine 공통 계약 및 Issue 기반 작업 계획

## 목표

Phase 24 후속 작업을 “프론트 화면을 먼저 만들고 나중에 런타임을 맞추는 방식”으로 흩어지지 않게, 다음 경계를 고정한다.

- **Frontend Adapter**: 제작자가 이해하는 화면 상태와 API 저장 payload 변환을 담당한다.
- **Backend Runtime Engine**: 실제 게임 중 공개/지급/전환/판정 실행을 담당한다.
- **Entity Shell**: 캐릭터·장소·단서·페이즈·결말 화면의 공통 레이아웃과 선택 흐름만 담당한다.
- **GitHub Issue**: PR-5B부터 PR-9까지의 추적 단위다.

## 왜 이 PR을 먼저 끊는가

캐릭터·장소·단서·페이즈·결말은 제작 UI 요구가 서로 다르다. 하지만 “저장된 설정이 실제 게임에서 어떻게 실행되는가”는 공통 원칙이 있어야 한다. 이 문서는 그 공통 원칙을 먼저 고정해서, 후속 PR이 엔티티별 차이를 가져도 유지보수 가능한 구조를 유지하게 한다.

## EditorEntityAdapter 계약

### 책임

`EditorEntityAdapter`는 프론트엔드에서 엔티티별 제작 화면과 저장 API 사이를 연결한다.

반드시 담당한다:

1. API DTO 또는 flow node data를 제작자용 ViewModel로 변환한다.
2. ViewModel을 저장 가능한 payload로 되돌린다.
3. 검색/선택/다중 선택/업로드/삭제 확인처럼 제작자가 직접 조작하는 상태를 관리한다.
4. 모바일 세로 흐름과 데스크톱 보조 패널 배치를 유지한다.
5. 저장 전 제작자 친화 검증 메시지를 만든다.

### 금지사항

Adapter가 하면 안 된다:

- 게임 중 권한, 공개 여부, 단서 지급, 결말 판정을 최종 결정하지 않는다.
- backend engine config key, DB 필드명, raw JSON, internal ID를 기본 화면에 그대로 노출하지 않는다.
- 엔티티별 runtime 규칙을 React component 안에 하드코딩하지 않는다.
- 다른 엔티티 adapter의 payload shape에 직접 의존하지 않는다.

### 완료 기준

- 같은 저장 데이터를 불러와도 제작자가 이해하는 말과 순서로 보인다.
- 저장 payload round-trip 테스트가 있다.
- 내부 구현 정보 없이도 제작자가 다음 행동을 이해한다.

## RuntimeEntityEngine 계약

### 책임

`RuntimeEntityEngine`은 백엔드에서 저장된 editor 설정을 실제 게임 상태로 해석한다.

반드시 담당한다:

1. phase enter/start/reconnect/retry 시 실행할 runtime effect를 계산한다.
2. 캐릭터별 공개 상태를 player-aware state로 만든다.
3. 단서 지급/소모/조합/잠금 해제, 장소 접근/조사, 정보 전달, 결말 판정을 중복 없이 실행한다.
4. 삭제 또는 수정된 엔티티의 참조 정합성을 transaction 안에서 유지한다.
5. legacy config는 normalizer 또는 migration helper를 통해 같은 runtime shape로 해석한다.

### 금지사항

Engine이 하면 안 된다:

- UI label, 화면 탭 이름, CSS 상태에 의존하지 않는다.
- 제작자용 임시 ViewModel을 그대로 runtime source로 삼지 않는다.
- 재접속 또는 phase 재진입 때 같은 정보를 중복 지급하지 않는다.
- 권한 없는 플레이어에게 숨겨야 할 단서/정보/결말 근거를 public state에 포함하지 않는다.

### 완료 기준

- runtime 판단은 React 없이 Go unit/integration test로 검증 가능하다.
- player-aware redaction 테스트가 있다.
- 같은 이벤트가 여러 번 들어와도 결과가 한 번만 반영된다.

## EntityEditorShell 계약

### 책임

공통 Shell은 엔티티별 화면의 반복 구조만 담당한다.

담당한다:

- 목록/검색/선택
- 빈 상태
- 생성/삭제 CTA 위치
- 상세 영역 slot
- 보조 정보 slot
- 모바일 세로, 데스크톱 2열 배치

담당하지 않는다:

- `if entityType === "clue"` 같은 엔티티별 분기
- 단서 효과, 장소 접근, 캐릭터 역할, 결말 판정 같은 business rule
- API payload 직접 조립

## 저장/실행 데이터 흐름

```txt
제작자 입력
  -> EditorEntityAdapter ViewModel
  -> API 저장 payload
  -> DB / flow node / config_json
  -> normalizer 또는 migration helper
  -> RuntimeEntityEngine input
  -> player-aware public state / audit event / runtime effect
```

이 흐름에서 프론트는 “무엇을 저장할지”를 돕고, 백엔드는 “게임 중 무엇이 실제로 일어나는지”를 결정한다.

## Issue 기반 후속 작업

| Issue | PR | 범위 | 게이트 |
| --- | --- | --- | --- |
| [#231](https://github.com/sabyunrepo/muder_platform/issues/231) | PR-5B | 페이즈 정보 전달 Frontend Adapter | 바로 구현 가능 |
| [#232](https://github.com/sabyunrepo/muder_platform/issues/232) | PR-5C | 정보 전달 Backend Engine 및 런타임 공개 상태 | PR-5B 후 구현 |
| [#233](https://github.com/sabyunrepo/muder_platform/issues/233) | PR-6 | 캐릭터 Adapter/Engine 브레인스토밍 및 이관 | 사용자 브레인스토밍 필수 |
| [#234](https://github.com/sabyunrepo/muder_platform/issues/234) | PR-7 | 단서 Adapter/Engine 브레인스토밍 및 이관 | 사용자 브레인스토밍 필수 |
| [#235](https://github.com/sabyunrepo/muder_platform/issues/235) | PR-8 | 장소 Adapter/Engine 브레인스토밍 및 이관 | 사용자 브레인스토밍 필수 |
| [#236](https://github.com/sabyunrepo/muder_platform/issues/236) | PR-9 | 결말/통합 Adapter-Engine 검증 및 E2E | 사용자 브레인스토밍 필수 |

## PR-5B / PR-5C 경계

### PR-5B — Frontend Adapter

목표: 모든 페이즈에서 “받을 캐릭터 + 전달할 정보 여러 개”를 제작자가 설정할 수 있게 한다.

포함:

- `PhaseEditorAdapter` 또는 동등한 adapter 추가
- flow node data와 제작자용 정보 전달 ViewModel round-trip
- 캐릭터 검색/선택 UI 재사용
- 전달할 정보 다중 선택 UI
- 스토리 진행 페이즈의 “모든 플레이어에게 전달” 편의 입력
- 내부 ID/JSON 숨김

완료 조건:

- Vitest adapter round-trip
- Vitest 다중 선택/삭제
- E2E: 페이즈 선택 → 정보 전달 추가 → 캐릭터 검색 → 정보 다중 선택 → 저장
- `pnpm --dir apps/web typecheck`

### PR-5C — Backend Engine

목표: 저장된 정보 전달 설정이 실제 게임 진행 중 캐릭터별 공개 상태로 반영되게 한다.

포함:

- phase enter/start에서 정보 전달 설정 해석
- character-specific delivery idempotency
- player-aware public state redaction
- reconnect 후 공개 상태 유지
- legacy flow node data normalizer

완료 조건:

- Go unit: config validation
- Go unit: phase enter -> character-specific delivery
- Go unit: player-aware state redaction
- Go integration: reconnect 후 공개 상태 유지

## PR-6~PR-9 브레인스토밍 게이트

PR-6~PR-9는 구현 전에 사용자와 범위를 먼저 확정한다. Codex는 다음 순서를 따른다.

1. 관련 Uzu 문서를 읽는다.
2. MMP에 그대로 가져올 것, 변형할 것, 제외할 것을 나눈다.
3. 제작자에게 꼭 보여야 하는 정보와 숨길 내부 정보를 분리한다.
4. Frontend Adapter 책임과 Backend Engine 책임을 나눈다.
5. E2E 70%+ 목표 범위와 대체 unit/integration test를 정한다.
6. 사용자가 승인한 뒤 새 branch에서 구현한다.

## 공통 테스트 기준

- 프론트 adapter는 round-trip unit test를 가진다.
- 제작자 핵심 흐름은 E2E 또는 명시적 대체 테스트를 가진다.
- 백엔드 engine은 React 없이 Go test로 검증 가능해야 한다.
- Codecov patch coverage 70% 이상을 merge 기준으로 본다.

## PR 운영 기준

- 새 작업은 새 branch/worktree에서 시작한다.
- PR 제목/본문은 한글로 작성한다.
- PR 생성 시 `ready-for-ci` 라벨을 붙이지 않는다.
- CodeRabbit valid review를 반영하고 unresolved thread 0을 확인한다.
- `scripts/pr-ready-for-ci-guard.sh` 통과 후 `ready-for-ci` 라벨을 붙인다.
- CI/Codecov 통과 후 merge한다.

## #230 완료 조건 매핑

- [x] Phase 24 checklist에서 이 상세 계획 문서로 이동 가능하게 한다.
- [x] PR-5B~PR-9 이슈가 생성되어 있고 본 문서에 링크되어 있다.
- [x] PR-6~PR-9는 사용자 브레인스토밍 게이트가 명시되어 있다.
