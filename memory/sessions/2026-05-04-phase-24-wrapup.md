# 2026-05-04 — Phase 24 Editor Wrap-up Handoff

## 완료 기준

Phase 24 에디터 Adapter/Engine 전환은 main 기준으로 1차 완료되었다.

- #230~#236: PR-5A~PR-9 Adapter/Engine mainline 완료
- #250: legacy shape/dev preview/lazy normalizer sweep 완료
- #255~#259: 미전환 프론트 엔티티 Adapter 정리 완료
- #261 / PR #272: Mission Adapter/Engine 경계 정리 완료

## 다음 후보

1. #247 단서 효과 Engine 계약 및 런타임 실행
2. #248 장소 조사 Runtime 및 장소 단서 발견 흐름
3. #249 결말/투표 결과 breakdown 및 종료 화면 연결
4. #271 RFC 9457 + Google AIP-193 에러 계약

## 유지할 결정

- 프론트는 제작자 친화 Adapter/ViewModel을 담당한다.
- 백엔드는 게임 중 실제 판정/공개/삭제 정합성 Engine을 담당한다.
- 제작자가 몰라도 되는 내부 ID/raw JSON/module key는 기본 UI에 노출하지 않는다.
- Uzu 문서는 참고자료이며 MMP 요구에 맞게 변형한다.
- PR lifecycle은 라벨 없는 PR → CodeRabbit 정리 → ready-for-ci → CI/Codecov → merge 순서다.

## 주의

- lazy normalizer는 아직 제거하지 않는다. 운영 데이터 sweep 또는 telemetry가 필요하다.
- 다음 기능 PR은 기존 Phase 24 checklist에 새 범위를 끼워 넣지 말고 해당 GitHub Issue에서 시작한다.
