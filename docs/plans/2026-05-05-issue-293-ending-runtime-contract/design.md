# Issue #293 — 결말 runtime 계약

## 결정

`ending_branch` runtime의 `selectedEnding`은 사람이 읽는 결말 이름이 아니라 `flow_nodes(type=ending).id` 문자열로 다룬다. 제작 화면은 이 id를 결말 카드의 제목과 본문으로 해석하고, 게임 결과 화면은 후속 #280/#330 구현에서 같은 id를 사용해 플레이어용 문구를 resolve한다.

## 삭제 정합성

결말 node 삭제는 backend `flow.DeleteNode`가 소유한다. 삭제 요청이 들어오면 service가 node의 theme와 creator 소유권을 확인하고, 같은 transaction에서 `themes.config_json.modules.ending_branch.config.defaultEnding`과 `matrix[].ending` 중 삭제된 ending id를 제거한 뒤 node를 삭제한다.

`flow_edges`는 DB foreign key의 `ON DELETE CASCADE`로 정리된다. JSON 설정은 DB가 알 수 없는 제작 설정이므로 service layer에서 명시적으로 정리한다.

## 후속

`#280`은 결과 화면 UX와 감상 공유 정책을 다룬다. `#330`은 character-owned 엔드카드 확장을 다룬다. GM override는 권한, 감사 로그, 재평가 정책이 필요하므로 별도 범위로 유지한다.
