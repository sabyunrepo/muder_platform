# Phase 24 PR-6 — 캐릭터 Adapter/Engine 이관 계획

## 상태

- GitHub Issue: [#233](https://github.com/sabyunrepo/muder_platform/issues/233)
- Branch: `feat/issue-233-character-adapter-engine`
- 목표: 이미 구현된 캐릭터 역할/롤지/시작 단서 흐름을 유지하면서, 프론트는 제작자용 Adapter, 백엔드는 런타임 역할 정책 Engine 경계로 정리한다.

## Uzu 참고점

Uzu 캐릭터 문서에서 확인한 제작자 모델은 다음과 같다.

- PC/NPC를 구분하고, NPC는 플레이 중 등장인물 소개에 표시할지 선택한다.
- 캐릭터별 미션은 플레이 중 자동 배포가 아니라 감상/결과 공유 화면에서 판정된다.
- 아이콘/닉네임은 조건에 따라 바뀔 수 있다.
- 회차 플레이 캐릭터는 플레이 이력/예약/공개 운영 정책과 연결된다.

## MMP 적용 방식

PR-6에서는 Uzu 구조를 그대로 복제하지 않고 MMP의 현재 런타임 구조에 맞춰 다음만 적용한다.

1. 기존 캐릭터 역할 모델을 안정화한다.
   - `suspect`, `culprit`, `accomplice`, `detective`
   - legacy `is_culprit`와 새 `mystery_role`의 충돌을 backend policy에서 차단한다.
2. 프론트 캐릭터 화면은 API DTO를 직접 편집하지 않고 제작자용 ViewModel로 변환한다.
3. 백엔드는 캐릭터 역할이 투표/스포일러/런타임 권한에 어떤 의미를 갖는지 policy 함수로 분리한다.
4. 제작자 UI에는 internal ID, raw JSON, DB/config key를 노출하지 않는다.

## 제외 / 후순위

이번 PR에서 구현하지 않는다.

- NPC 전체 런타임: Phase 24에서는 설계 메모만 남기고 Phase 25 후보로 둔다.
- 캐릭터 미션 점수와 결말 통합: PR-9 결말/통합 검증에서 다룬다.
- 조건부 이름/아이콘 변경: phase/ending 조건 엔진과 연결해야 하므로 후속으로 둔다.
- 회차 플레이 캐릭터: 플레이 이력/예약/운영 정책이 필요하므로 Phase 25 후보로 둔다.

## 구현 범위

### Frontend Adapter

- `CharacterEditorAdapter` 추가
  - API `EditorCharacterResponse` → 제작자용 `CharacterEditorViewModel`
  - 역할 라벨/설명/배지/스포일러 여부를 한 곳에서 관리
  - 역할 변경 저장 payload 생성
- `CharacterAssignPanel`과 `CharacterDetailPanel`에서 adapter를 사용한다.
- adapter round-trip/role payload Vitest를 추가한다.

### Backend Engine / Policy

- `CharacterRolePolicy` 추가
  - 역할 정규화
  - legacy culprit flag 충돌 검증
  - 스포일러 역할 여부
  - 기본 투표 후보 포함 여부
- `CreateCharacter`/`UpdateCharacter`는 policy 결과를 사용해 `is_culprit`를 결정한다.
- policy unit test를 추가한다.

## 테스트 계획

- Frontend unit
  - API 캐릭터가 제작자용 ViewModel으로 변환된다.
  - legacy culprit flag가 `culprit` 배지로 보존된다.
  - 역할 변경 payload가 `mystery_role`과 `is_culprit`를 일관되게 만든다.
- Existing frontend component test
  - 캐릭터 역할 변경 UI 회귀 검증 유지.
- Backend unit
  - role 정규화, 충돌 차단, 스포일러 판정, 투표 후보 기본 정책 검증.
- Focused commands
  - `pnpm --dir apps/web test -- src/features/editor/entities/character/__tests__/characterEditorAdapter.test.ts src/features/editor/components/design/__tests__/CharacterAssignPanel.test.tsx`
  - `pnpm --dir apps/web typecheck`
  - `go test ./internal/domain/editor -run 'TestCharacterRolePolicy|TestNormalizeMysteryRole|TestService_(CreateCharacter|UpdateCharacter|DeleteCharacter)'`

## 완료 조건

- 캐릭터 UI가 기존 기능을 잃지 않는다.
- 캐릭터 역할/스포일러 정책이 React 없이 Go test로 검증된다.
- Adapter가 API DTO와 제작자 ViewModel 사이의 책임을 갖는다.
- PR 전 CodeRabbit/Codecov/CI 순서를 지킬 수 있게 변경 범위와 테스트 근거가 남는다.
