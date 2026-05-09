# Phase Type Panels Design

## Goal

`PhasePanelBasicInfo`의 타입 선택을 4개 타입으로 정리하고, 타입별로 필요한 설정만 보여준다.

현재 문제는 타입 목록이 실제 편집 UI와 맞지 않고, `수사` 같은 타입을 선택해도 다른 타입용 섹션이 함께 노출된다는 점이다. 이 변경은 페이즈 패널을 제작자 관점의 실제 작업 단위로 정리한다.

## Phase Types

남길 타입은 4개다.

- `investigation` — 수사
- `discussion` — 토론
- `voting` — 투표/질문
- `story_progression` — 리딩

기존 `free`, `intermission` 옵션은 새 UI 선택지에서 제거한다.

새 저장 타입으로 `voting_question`이나 `reading`을 만들지 않는다. 현재 런타임은 투표 phase를 `voting`으로 알고 있고, 읽기 대사는 phase type이 아니라 `onEnter`의 정보 전달 액션으로 실행된다. 따라서 제작자 UI에서는 4개 타입처럼 보이지만 저장값은 기존 계약을 유지한다.

## Type-Specific UI

### 수사

수사는 장면 설정 안에 최소 필드만 둔다.

- 라벨
- 타입
- 진행 시간
- 자동 진행 안내

수사 타입은 당연히 자동 진행이다. 수사 시간이 끝나면 다음 연결 장면으로 이동한다.

수사 타입에서는 아래 내용을 편집하지 않는다.

- 라운드
- 수사 목표
- 단서 공개
- 장소 접근 조건
- 토론방
- 투표/질문
- 읽기 대사

단서 공개는 단서 화면에서 관리하고, 장소 접근 조건은 장소 화면에서 관리한다.

### 토론

토론은 라벨, 타입, 진행 시간과 토론방 설정을 둔다.

전체토론방은 항상 기본 1개가 존재한다.

- 전체토론방은 삭제할 수 없다.
- 전체토론방 이름은 설정할 수 있다.

밀담방은 여러 개 만들 수 있다.

- 각 밀담방은 방 이름을 설정할 수 있다.
- 각 밀담방은 인원수를 설정한다.
- 인원수는 2인부터 선택한다.
- 각 밀담방은 제한시간을 설정할 수 있다.
- 제한시간을 비워두면 무제한이다.
- 제한시간이 끝나면 플레이어는 전체토론방으로 자동 복귀한다.

토론방은 특정 참여자를 직접 고르는 방식이 아니다. 제작자는 방의 이름, 인원수, 시간만 정한다.

### 투표/질문

기존 `voting` 타입은 `투표/질문`으로 표시한다.

투표/질문은 별도 투표 규칙을 이 패널에서 편집하지 않는다. 질문관리에서 만든 질문을 진행하는 장면으로 본다.

페이즈 패널에는 최소 필드만 둔다.

- 라벨
- 타입
- 진행 시간

질문 선택, 선택지, 응답 대상, 집계 규칙은 질문관리 화면에서 관리한다.

### 리딩

리딩은 기존 `story_progression` 저장값을 사용하고, 읽기 대사 탭에서 저장한 읽기 대사 목록을 가져와 선택지로 보여준다.

페이즈 패널에는 다음을 둔다.

- 라벨
- 타입
- 읽기 대사 선택

리딩 타입에는 진행 시간을 두지 않는다. 완료 조건은 플레이어가 선택한 대사를 끝까지 읽는 것이다.

기존 `ReadingPlacementPanel`과 `useReadingSections(themeId)` 흐름을 활용한다.

## Data And Compatibility

타입 선택 UI는 4개만 보여준다. 저장 데이터에는 기존 타입이 남아 있을 수 있으므로 어댑터 계층에서 호환 표시를 처리한다.

- `story_progression`은 UI에서 `리딩`으로 표시한다.
- `voting`은 UI에서 `투표/질문`으로 표시한다.
- 새 저장도 `story_progression`, `voting`을 그대로 사용한다.
- `reading`, `voting_question`은 이번 작업에서 저장값으로 도입하지 않는다.

이 결정은 현재 코드 기준의 호환성을 우선한다.

- `packages/shared/src/game/types.ts`의 게임 진행 phase enum에는 `voting`이 있고 `voting_question`은 없다.
- `apps/server/internal/engine/module_types.go`의 `PhaseDefinition.Type`은 런타임 분기 기준이 아니라 표시/메타데이터 성격이다.
- 읽기 대사는 `apps/web/src/features/editor/entities/phase/readingPlacementAdapter.ts`가 `DELIVER_INFORMATION` 액션의 `reading_section_ids`로 저장한다.
- 질문관리는 현재 ending branch 설정의 `questions` 영역에 있으며, phase panel 안에서 질문 선택/규칙을 직접 저장하지 않는다.

토론방은 별도 계약 변경이 필요하다. 현재 frontend `DiscussionRoomPolicy`와 backend `engine.DiscussionRoomPolicy`는 단일 private room/conditional room 중심이며, 사용자 요구인 여러 밀담방, 방별 인원수, 방별 제한시간을 그대로 담는 배열 구조가 없다.

권장 계약:

```ts
type DiscussionRoomPolicy = {
  enabled: true;
  mainRoomName: string;
  privateRooms: Array<{
    id: string;
    name: string;
    maxMembers: number;
    timeLimitSeconds: number | null;
  }>;
  closeBehavior: "return_to_main";
};
```

`timeLimitSeconds: null`은 무제한을 뜻한다. 백엔드 `group_chat` 런타임은 `privateRooms[]`를 여러 방으로 생성하고, 방별 제한시간이 끝난 플레이어를 전체토론방으로 복귀시키는 동작을 지원해야 한다.

타입 변경 시 이전 타입의 설정이 남아 UI에 보이면 안 된다. 다만 기존 데이터를 즉시 삭제하지 않고, 타입별 패널이 자기 타입에 맞는 필드만 읽고 저장하도록 한다.

## Component Structure

`PhaseNodePanel`이 타입별 UI를 직접 모두 품으면 파일이 커지고 변경 이유가 섞인다. 타입별 패널을 분리한다.

권장 구조:

- `PhasePanelBasicInfo.tsx` — 라벨/타입 공통 입력
- `InvestigationPhasePanel.tsx` — 수사 전용 설정
- `DiscussionPhasePanel.tsx` — 토론방 설정
- `VotingQuestionPhasePanel.tsx` — 투표/질문 전용 최소 설정
- `ReadingPhasePanel.tsx` — 읽기 대사 선택
- `phaseTypeOptions.ts` 또는 adapter 파일 — 타입 옵션, label, legacy mapping

개별 컴포넌트가 500줄을 넘을 가능성이 있으면 하위 컴포넌트로 분리한다. 특히 토론방 설정은 `MainDiscussionRoomEditor`, `PrivateDiscussionRoomList`, `PrivateDiscussionRoomCard`처럼 분리 가능한 경계를 둔다.

## Error Handling

`수사` 선택 시 오류가 나지 않아야 한다.

필수 방어:

- 타입 값이 빈 문자열이거나 legacy 값이어도 패널 렌더가 깨지지 않는다.
- 읽기 대사 목록 로딩 실패는 기존처럼 재시도 UI를 보여준다.
- 토론 밀담방 제한시간이 비어 있으면 validation error가 아니라 무제한으로 처리한다.
- 밀담방 인원수는 최소 2 이상이다.

## Testing

프론트엔드 focused test를 추가한다.

- 타입 select에는 4개 타입만 보인다.
- `수사` 선택 시 라벨/타입/진행 시간/자동 진행 안내만 보인다.
- `토론` 선택 시 전체토론방 기본값과 밀담방 이름/인원수/제한시간 입력이 보인다.
- 토론 밀담방 제한시간을 비우면 무제한으로 저장된다.
- `투표/질문` 선택 시 저장값은 `voting`이고, 질문 상세 섹션 없이 라벨/타입/진행 시간만 보인다.
- `리딩` 선택 시 진행 시간 없이 읽기 대사 목록 선택 UI가 보인다.
- `리딩` 선택 시 저장값은 `story_progression`이다.

## Resolved Decisions

- 리딩은 새 `reading` 타입을 저장하지 않고 기존 `story_progression`을 유지한다.
- 투표/질문은 새 `voting_question` 타입을 저장하지 않고 기존 `voting`을 유지한다.
- 질문 선택, 선택지, 응답 대상, 집계 규칙은 phase panel에서 제거하고 질문관리/ending branch 쪽 계약으로 남긴다.
- 토론 다중 밀담방은 frontend-only 작업이 아니라 shared contract, backend runtime, frontend adapter를 함께 바꾸는 작업으로 본다.
