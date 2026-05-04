# Issue #261 — Mission Adapter/Engine 경계 정리

## 원인

Uzu의 미션 기능은 캐릭터별 목표를 만들고, 조건을 만족하면 자동으로 판정하며, 점수는 종료 후 감상/결과 화면에서 보여주는 구조다. MMP에도 `hidden_mission` 모듈과 캐릭터별 `character_missions` 설정이 있지만, 제작자 UI와 런타임 엔진의 책임 경계가 흐려지면 플레이 중 스포일러 노출이나 프론트 단독 판정 문제가 생길 수 있다.

## Uzu 참고점

- 캐릭터별 미션을 추가한다.
- 미션에는 내용, 달성 조건, 점수가 있다.
- 미션 내용은 플레이 중 자동 배포되지 않는다.
- 달성 여부와 점수는 결과/감상 공유 화면에서 확인한다.

## MMP 적용 방식

- 제작자 UI는 미션 내용, 점수, 판정 방식, 대상 캐릭터/단서만 보여준다.
- 내부 module key, raw JSON, player UUID 매핑은 기본 UI에 노출하지 않는다.
- 프론트 Adapter는 제작자용 `MissionViewModel`과 백엔드 후보 계약 `MissionEngineContractDraft`를 만든다.
- 백엔드 `hidden_mission` 모듈은 실제 달성 판정, 점수 계산, player-aware 결과 공개를 담당한다.
- 캐릭터 ID → 실제 플레이어 UUID 매핑은 런타임 세션 배정 이후 백엔드가 소유한다.

## 이번 PR 범위

- `missionAdapter`에 결과 공개 시점과 백엔드 판정 owner를 명시한다.
- 캐릭터별 미션을 엔진 후보 계약으로 요약하는 `toMissionEngineContractDraft`를 추가한다.
- `MissionEditor`에서 제작자가 판정 방식을 선택할 수 있게 하고, “결과 화면에서만 공개 / 게임 판정은 백엔드 담당”을 제작자용 문구로 보여준다.
- Adapter/component test를 보강한다.

## 제외 범위

- 미션 런타임 대규모 재작성.
- 종료 화면 전체 리디자인.
- 캐릭터 ID → 플레이어 UUID 세션 매핑 구현.
- 미션 달성 조건 DSL 전체 재설계.

## 완료 조건

- 제작자 UI와 runtime engine 경계가 타입과 문서에 남는다.
- 미션 결과는 결과 화면 공개 전 플레이어 전체에게 노출되지 않는다는 경계가 유지된다.
- 후속 Mission Engine 구현자가 어떤 payload를 받아야 하는지 알 수 있다.
