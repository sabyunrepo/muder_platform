# Issue #263 — Media/Effect Resource Adapter 정리

## 목표

BGM, 효과음, 음성/내레이션, 문서(PDF), 영상 리소스를 제작자가 한 가지 방식으로 검색·선택할 수 있게 정리한다. R2 object key, presign URL, raw storage path 같은 백엔드 저장 세부는 UI에 노출하지 않는다.

## Uzu 참고점

- `docs/uzu-studio-docs/basic-features/effect/bgm.md`: BGM은 단계/큐를 조건으로 반복 재생·정지 조건을 관리한다.
- `docs/uzu-studio-docs/basic-features/effect/se.md`: 효과음/내레이션은 조건 충족 시 1회 재생하며, 큐나 특정 캐릭터 대상 재생이 가능하다.
- `docs/uzu-studio-docs/basic-features/effect/movie.md`: 영상은 단계/큐/액션에서 재생될 수 있고 스킵 가능 여부 같은 런타임 설정이 붙는다.
- `docs/uzu-studio-docs/basic-features/texttab.md`: 텍스트/이미지 리소스는 그룹과 전달 조건으로 플레이어에게 배포된다.
- `docs/uzu-studio-docs/basic-features/effect/background.md`: 배경 이미지는 기본/조건부 리소스와 우선순위가 중요하다.

## MMP 적용 방식

- Uzu의 “리소스 + 조건/사용 위치” 모델을 그대로 복제하지 않고, MMP는 먼저 공통 Resource Adapter/Picker로 제작자 선택 경험을 통일한다.
- 프론트 어댑터는 `MediaResponse` API DTO를 제작자용 ViewModel로 변환한다.
- Phase Action, Role Sheet, Story/Reading, Location image 등은 같은 Picker 계약을 재사용하되, 실제 런타임 조건 실행은 후속 백엔드 engine PR에서 소유한다.
- 이미지 리소스는 현재 `MediaType`에 `IMAGE`가 없으므로 이번 PR에서 새 백엔드 타입을 만들지 않고, 기존 이미지 업로드 흐름과의 연결 지점을 명시한다.

## 제외/후순위

- 전체 미디어 viewer 재작성
- 영상/효과음 런타임 engine 완성
- `IMAGE` MediaType 추가 및 R2 이미지 통합 마이그레이션
- Phase cue/character-specific playback rule 실행

## 작업 체크리스트

- [x] `mediaResourceAdapter` 추가: 타입 라벨, 출처 라벨, duration/file size, 사용 위치별 선택 가능 여부, 검색 필터
- [x] `ResourcePicker` 순수 컴포넌트 추가: 검색, 선택, 빈 상태, 선택 불가 사유, raw URL/object key 비노출
- [x] 기존 `MediaPicker`를 `ResourcePicker` 기반으로 정리해 외부 API 유지
- [x] 어댑터 단위 테스트 추가
- [x] Resource picker/MediaPicker 컴포넌트 테스트 보강
- [ ] focused 검증 실행

## 완료 조건

- 제작자 UI에서 backend storage path/object key/public URL을 직접 보여주지 않는다.
- 새 미디어 선택 UI는 기능별 중복 구현 대신 공통 Resource Picker 계약을 사용한다.
- 순수 어댑터 테스트와 컴포넌트 테스트로 Codecov patch coverage 70% 이상을 방어한다.
