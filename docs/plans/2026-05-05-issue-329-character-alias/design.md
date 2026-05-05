# Issue #329 Character Alias Design

## 목표

조건부 이름/아이콘 표시를 캐릭터 엔티티의 제작 계약으로 고정한다. 제작자는 에디터에서 "플레이 중 표시" 규칙을 만들고, 백엔드는 같은 조건 계약으로 최종 표시값을 판정한다.

## 결정

- 저장 위치: `theme_characters.alias_rules` JSONB 배열.
- 규칙 형태: `id`, `label`, `display_name`, `display_icon_url`, `priority`, `condition`.
- 조건 계약: #301의 `engine.ConditionGroup`을 그대로 사용한다.
- 우선순위: 조건을 만족하는 규칙 중 `priority`가 가장 높은 규칙 하나만 적용한다.
- fallback: 조건 평가 실패, 조건 불충족, 규칙 없음이면 기본 `name`/`image_url`을 사용한다.
- redaction 경계: public/player-facing API는 원본 규칙과 원본 스포일러 값을 직접 해석하지 않고, backend가 계산한 표시값만 내려주는 구조로 확장한다.

## 제외

- 결과 카드/감상 화면 UX는 #280/#330 범위다.
- 투표/읽기/결과 화면 전체 표시 교체는 이번 PR에서 helper 계약까지만 고정하고, runtime snapshot 연결 PR에서 같은 helper를 사용한다.
- 조건 빌더 자체 확장은 #301 후속 범위다.

## Runtime 표시 경로 감사

- 소개/읽기: `ReadingPanel`과 `ReadingOverlay`는 현재 role/section/line 중심이며 캐릭터 표시 이름/아이콘을 직접 받지 않는다.
- 투표: `VotePanel`, `VotingPanel`, `VoteOptionList`는 `Player.nickname` 또는 voting module의 `targetCode` 결과를 표시한다. 공용 `Player` 타입에는 캐릭터 표시 이름/아이콘 필드가 없다.
- 결과: `ResultBreakdownPanel`과 `resultBreakdownAdapter`는 투표 결과 ID를 `Player.nickname`으로 매핑한다.
- Backend session: `session.PlayerState`와 `staticPlayerInfoProvider`는 `TargetCode`를 보유하지만, `theme_characters.alias_rules`를 로드해 player-facing 표시값으로 바꾸는 스냅샷 경로는 아직 없다.
- 판단: 이번 PR은 조건부 표시의 저장/검증/제작 UI/source-of-truth helper를 고정한다. 실제 게임 화면 적용은 세션 스냅샷/WS에 `CharacterDisplay`를 주입하는 별도 runtime PR에서 처리해야 한다.

## 검증

- Go: alias rule validation, 저장/보존/삭제, 조건 평가 fallback.
- Web: API DTO -> ViewModel -> 저장 payload 왕복, 제작자 UI 저장 액션.
- TypeScript: `@mmp/web` typecheck.
