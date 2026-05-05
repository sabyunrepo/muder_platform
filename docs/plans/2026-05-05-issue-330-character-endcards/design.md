# Issue #330 Character Endcards

## 결정

- 엔드카드는 Character Entity가 소유한다.
- 기존 `name`/`description`/`image_url`은 공개 소개 필드로 유지한다.
- `endcard_title`/`endcard_body`/`endcard_image_url`은 결과 이후 표시할 스포일러 가능 필드로 분리한다.
- #280은 RESULT/감상 화면의 전체 레이아웃, GM override, 공유 정책, 공개 타이밍을 계속 소유한다.

## 이번 PR 범위

- `theme_characters` 저장 계약에 결과 카드 필드를 추가한다.
- editor character API request/response와 frontend type/adapter를 확장한다.
- 실제 `/editor/:id/characters` 제작 화면의 캐릭터 상세에 결과 카드 섹션을 추가한다.
- 역할 변경, PC/NPC visibility 변경, 기본 캐릭터 수정이 기존 결과 카드 값을 지우지 않도록 보존한다.

## 후속 연결

- player-aware RESULT redaction과 카드 표시 위치는 #280에서 backend runtime response를 기준으로 연결한다.
- ending node id cleanup/source-of-truth는 #293 PR 완료 후 그 계약을 따른다.
