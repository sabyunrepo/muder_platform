# Issue #250 — Phase 24 Cleanup Sweep

## 목적

Phase 24 PR-5A~PR-9 이후 남은 legacy shape, dev preview/mock route, lazy normalizer 의존도를 정리한다. 이번 정리는 기능 확장이 아니라 다음 기능 PR이 실제 에디터 기준과 혼동하지 않도록 기준선을 고정하는 작업이다.

## 현재 확인 결과

### 1. Dev preview / mock route

- 실제 라우트(`/__dev/phase24-*`)는 현재 main에 남아 있지 않다.
- 과거 UI 검토용 컴포넌트 `EntityPageMockup.tsx`는 import가 없어 실제 서비스에서 쓰이지 않는다.
- 이 목업은 현재 캐릭터/장소/단서 shell 기반 화면과 다른 기준을 보여줄 수 있어 제거한다.

### 2. Uzu Studio 문서

- `docs/uzu-studio-docs/`는 외부 사용설명서를 로컬로 복사한 참고자료다.
- 에디터 설계 때 읽을 수는 있지만 repo source of truth는 아니다.
- 실수로 PR에 포함되지 않도록 `.gitignore`에 등록한다.

### 3. Lazy normalizer / legacy shape

- `NormalizeConfigJSON`는 기존 저장 데이터가 legacy config shape일 때 read path에서 canonical shape로 해석하는 안전장치다.
- 새 write path는 이미 legacy key를 거부한다.
- 따라서 지금 제거하지 않는다. 제거는 실제 데이터 sweep 또는 telemetry로 legacy read가 0임을 확인한 뒤 별도 cleanup PR에서 진행한다.

## 이번 PR 범위

- [x] untracked Uzu reference docs ignore
- [x] unused Phase 24 entity mockup component 제거
- [x] lazy normalizer 유지/제거 조건 문서화

## 이번 PR 제외

- DB 데이터 rewrite 또는 migration sweep
- `NormalizeConfigJSON` 제거
- `configShape.ts`의 legacy read 호환 제거
- 단서/장소/결말 runtime 기능 확장

## 후속 조건

lazy normalizer를 제거하려면 다음 중 하나가 필요하다.

1. 운영 DB/seed/preset 전체가 canonical shape임을 검증한다.
2. legacy read telemetry를 일정 기간 관찰해 0건임을 확인한다.
3. rollback 경로와 data backup을 포함한 별도 migration PR을 만든다.
