# Issue #261 — Mission Adapter/Engine 경계 정리

## Uzu 참고점

- Uzu mission은 캐릭터별 목표를 만들고, 달성 조건/점수를 결과 공유 화면에서 판정한다.
- 미션은 플레이 중 자동 배포되지 않으며, 플레이어에게 알려야 하는 내용은 별도 텍스트에 써야 한다.

## MMP 적용 방식

- 제작자 UI는 캐릭터 내부의 “히든 미션” 섹션으로 유지한다.
- 프론트는 `missionAdapter`가 제작자용 ViewModel, 경고, legacy `character_missions` 저장 경계를 담당한다.
- 백엔드는 `hidden_mission` engine이 player-aware state, 자동 판정, 점수, 결과 breakdown, audit event의 runtime truth를 담당한다.

## 완료 조건

- [x] Mission Frontend Adapter 추가
- [x] Mission Adapter unit test 추가
- [x] CharacterAssignPanel이 직접 config shape를 만지지 않고 adapter를 사용
- [x] hidden_mission runtime result breakdown 계약 추가
- [x] mission.completed audit event 계약 추가
- [x] Go unit test로 TargetCharacterID 자동 판정과 breakdown 검증

## 후순위

- `character_missions` legacy 저장을 `modules.hidden_mission.config.playerMissions`로 완전 마이그레이션하려면 캐릭터 ID와 실제 player ID 매핑 정책이 먼저 필요하다.
- 종료 화면 breakdown 전체 UI 연결은 #249에서 처리한다.
