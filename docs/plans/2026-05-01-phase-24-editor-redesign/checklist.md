---
phase_id: "phase-24-editor-redesign"
phase_title: "Phase 24 — 에디터 ECS 재설계 (Adapter/Engine 경계 정리)"
created: 2026-05-01
status: "wrap-up ready — Phase 25 candidate queue defined"
spec: "docs/superpowers/specs/2026-05-01-phase-24-editor-redesign/design.md"
prs_estimated: "issue-based: Phase 24 mainline merged; Phase 25 runtime candidates split"
parent_phase: "phase-21-editor-ux"
---

# Phase 24 — 에디터 ECS 재설계 Implementation Plan

## 현재 기준선 (2026-05-04)

Phase 24의 목표는 제작자용 에디터를 **프론트 Adapter / 백엔드 Engine** 경계로 다시 정리하는 것이었다.

- **프론트 Adapter**: 저장/API 형태를 제작자가 이해하기 쉬운 ViewModel로 바꾸고, 내부 ID/raw JSON/module key를 기본 UI에 숨긴다.
- **백엔드 Engine**: 게임 중 자동 진행, 조건 판정, 공개 상태, 삭제 정합성 같은 runtime truth를 소유한다.
- **Uzu 문서**: 제작 흐름을 참고하되 그대로 복제하지 않고, MMP의 멀티플레이 runtime과 반응형 제작 UI에 맞게 변형한다.

## 완료된 Issue/PR 흐름

| Issue | 범위 | 상태 |
| --- | --- | --- |
| [#230](https://github.com/sabyunrepo/muder_platform/issues/230) | Adapter/Engine 공통 계약 및 Issue 기반 전환 | done |
| [#231](https://github.com/sabyunrepo/muder_platform/issues/231) | 페이즈 정보 전달 Frontend Adapter | done |
| [#232](https://github.com/sabyunrepo/muder_platform/issues/232) | 정보 전달 Backend Engine 및 런타임 공개 상태 | done |
| [#233](https://github.com/sabyunrepo/muder_platform/issues/233) | 캐릭터 Adapter/Engine 이관 | done |
| [#234](https://github.com/sabyunrepo/muder_platform/issues/234) | 단서 Adapter/Engine 이관 | done |
| [#235](https://github.com/sabyunrepo/muder_platform/issues/235) | 장소 Adapter/Engine 이관 | done |
| [#236](https://github.com/sabyunrepo/muder_platform/issues/236) | 결말/통합 Adapter-Engine 검증 및 E2E | done |
| [#250](https://github.com/sabyunrepo/muder_platform/issues/250) | legacy shape/dev preview/lazy normalizer sweep | done |
| [#255](https://github.com/sabyunrepo/muder_platform/issues/255) | 페이즈 엔티티 Adapter 정식화 | done |
| [#256](https://github.com/sabyunrepo/muder_platform/issues/256) | 조건·액션·정보전달 공통 Adapter 분리 | done |
| [#257](https://github.com/sabyunrepo/muder_platform/issues/257) | 결말 분기 질문·매트릭스 편집 UI 보강 | done |
| [#258](https://github.com/sabyunrepo/muder_platform/issues/258) | 스토리·텍스트 정보 섹션 Adapter 정리 | done |
| [#259](https://github.com/sabyunrepo/muder_platform/issues/259) | 미션·덱 조사·미디어 효과 후속 엔티티 정리 | done |
| [#261](https://github.com/sabyunrepo/muder_platform/issues/261) | Mission Adapter/Engine 경계 정리 | done — PR #272 merged |
| [#260](https://github.com/sabyunrepo/muder_platform/issues/260) | 미전환 에디터 엔티티 Adapter Epic | ready to close |
| [#246](https://github.com/sabyunrepo/muder_platform/issues/246) | Phase 24 wrap-up 및 후속 범위 정리 | done |

## Phase 25 후보 큐

다음 기능 작업은 Phase 24 문서에 섞지 않고 아래 이슈로 분리한다.

1. [#247](https://github.com/sabyunrepo/muder_platform/issues/247) — 단서 효과 Engine 계약 및 런타임 실행
   - 사용 시 단서 지급/소모/정보 공개/조건 검사 같은 실제 게임 효과를 백엔드 Engine으로 옮긴다.
2. [#248](https://github.com/sabyunrepo/muder_platform/issues/248) — 장소 조사 Runtime 및 장소 단서 발견 흐름
   - 장소를 조사했을 때 어떤 단서가 언제 누구에게 공개되는지 runtime 흐름을 만든다.
3. [#249](https://github.com/sabyunrepo/muder_platform/issues/249) — 결말/투표 결과 breakdown 및 종료 화면 연결
   - 게임 종료 시 공통 결말, 캐릭터별 결과, 투표/미션 점수 요약을 연결한다.
4. [#271](https://github.com/sabyunrepo/muder_platform/issues/271) — RFC 9457 + Google AIP-193 에러 계약
   - PR-1 감사 문서화부터 착수했다. API/런타임 에러 응답 표준화는 PR-2 이후 코드 변경으로 나눈다.

## 유지할 원칙

- 제작자가 몰라도 되는 내부 정보는 기본 화면에 노출하지 않는다.
- 모든 프론트 에디터 화면은 모바일에서도 세로 흐름으로 읽히는 반응형 UI를 기본으로 한다.
- 새 엔티티/기능은 재사용 가능한 Adapter, ViewModel, form section 컴포넌트로 나눈다.
- 백엔드 runtime 동작은 Engine 계약으로 모으고, 프론트는 엔진 후보 계약 초안까지만 만든다.
- 모든 코드 PR은 focused test와 E2E 또는 명시적 대체 테스트를 포함하고, Codecov patch 70% 이상을 목표로 한다.
- PR은 라벨 없이 생성하고, CodeRabbit 리뷰 정리 후 `ready-for-ci` 라벨로 full CI를 실행한다.

## 남은 리스크와 처리 기준

| 리스크 | 지금 상태 | 처리 기준 |
| --- | --- | --- |
| legacy normalizer 제거 | 유지 | 운영 DB/seed/preset이 canonical shape임을 검증하고, legacy read telemetry를 일정 기간 관찰해 0건임을 확인한 뒤, rollback 경로와 data backup을 포함한 별도 migration PR을 만든다 |
| dev preview/mock route 혼동 | #250에서 정리 | 새 mock은 실제 구현 컴포넌트와 분리하지 않는다 |
| 단서/장소 runtime 효과 미완성 | Phase 25 후보 | #247, #248에서 백엔드 Engine 우선 설계 |
| 결말/투표 breakdown 미완성 | Phase 25 후보 | #249에서 종료 화면과 함께 처리 |
| 에러 계약 표준화 | 진행 중 | #271 PR-1에서 현재 HTTP/FE/WS 에러 계약 감사를 먼저 문서화하고, PR-2 이후 backend registry/front recovery로 분리한다 |

## 검증 게이트

PR 생성 전:
- [ ] 변경 범위에 맞는 focused check 실행
- [ ] 문서 링크와 이슈 상태가 현재 main 기준과 일치하는지 확인
- [ ] PR 제목/본문은 한국어로 작성

PR 진행:
- [ ] CodeRabbit valid feedback 반영 및 thread resolve
- [ ] CodeRabbit 재검토 clear 확인
- [ ] `ready-for-ci` 라벨 부착 후 CI/Codecov 확인

머지 후:
- [ ] 관련 이슈 자동 close 확인
- [ ] main 동기화
- [ ] 다음 작업 후보를 사용자에게 짧게 브리핑
