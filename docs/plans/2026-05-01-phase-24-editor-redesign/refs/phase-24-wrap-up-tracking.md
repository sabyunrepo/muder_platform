# Phase 24 Wrap-up Tracking — PR-5A~PR-9 이후

## 목적

PR-5A~PR-9에서 에디터 Adapter와 백엔드 Engine 경계를 1차로 닫았다. 이제 다음 기능을 바로 추가하기 전에, 현재 main 기준 상태와 후속 작업 범위를 분리한다.

## 현재 완료

- PR-5A: Adapter/Engine 공통 계약 및 Issue 기반 전환
- PR-5B: 페이즈 정보 전달 Frontend Adapter
- PR-5C: 정보 전달 Backend Engine 및 런타임 공개 상태
- PR-6: 캐릭터 Adapter/Engine 이관
- PR-7: 단서 Adapter/Engine 이관
- PR-8: 장소 Adapter/Engine 이관
- PR-9: 결말/통합 Adapter-Engine 검증 및 E2E — PR #245 merged

## 다음 추적 이슈

- GitHub Issue: #246 `[Phase 24][Wrap-up] 마이그레이션 sweep 및 후속 런타임 확장 정리`

## 후속 분리 기준

1. **마이그레이션/운영 cleanup**
   - lazy normalizer와 legacy shape가 실제로 더 필요한지 확인한다.
   - sweep/telemetry/preview route 정리는 기능 PR과 섞지 않는다.
   - 추적 이슈: #250 `[Phase 24][Cleanup] legacy shape/dev preview/lazy normalizer sweep`

2. **런타임 기능 확장**
   - 단서 효과 engine, 장소 조사 runtime, 결말/투표 breakdown은 각각 별도 이슈/PR로 분리한다.
   - 프론트는 Adapter, 백엔드는 Engine 소유 원칙을 유지한다.
   - 추적 이슈: #247 단서 효과 Engine, #248 장소 조사 Runtime, #249 결말/투표 breakdown

3. **제작자 UI 원칙**
   - 내부 ID, raw JSON, module key, legacy shape는 기본 화면에 노출하지 않는다.
   - Uzu 문서는 참고하되 MMP의 멀티플레이 runtime과 데이터 정합성에 맞게 변형한다.

## 완료 조건

- checklist 상태가 main과 일치한다.
- 다음 기능자가 어떤 이슈부터 시작할지 알 수 있다.
- Phase 24에서 의도적으로 미룬 항목이 추적 가능한 이슈로 분리되어 있다.
