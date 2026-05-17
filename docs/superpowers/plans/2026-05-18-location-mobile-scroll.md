# 장소관리 모바일 스크롤 복구 계획

## 원인

- 장소관리 탭 최상위와 본문 wrapper가 모바일에서도 `overflow-hidden`을 사용한다.
- 상세 카드가 화면 높이보다 길어질 때 모바일에는 세로 스크롤 책임을 가진 컨테이너가 없어 하단 설정이 잘린다.
- 데스크톱은 목록/상세 패널 내부 스크롤이 필요하지만, 모바일은 단일 세로 흐름이 더 자연스럽다.

## 작업

- [x] 모바일 기본값은 장소관리 탭 전체 스크롤로 바꾼다.
- [x] `md` 이상에서는 기존처럼 내부 목록/상세 패널 스크롤을 유지한다.
- [x] 컴포넌트 테스트로 스크롤 클래스 회귀를 막는다.
- [x] Playwright 모바일 E2E로 실제 스크롤 가능 여부를 검증한다.

## 검증

- [x] `pnpm --filter @mmp/web test -- src/features/editor/components/design/__tests__/LocationsSubTab.test.tsx`
- [x] `pnpm --filter @mmp/web typecheck`
- [x] `pnpm --filter @mmp/web exec playwright test e2e/location-hierarchy.spec.ts --project=chromium --grep "모바일"`
- [ ] `scripts/mmp-local-ci.sh quick`
