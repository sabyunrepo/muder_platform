# Phase 18.4 — 에디터 UX Bugfix 설계 (index)

> **상태**: 확정
> **시작**: 2026-04-15
> **목적**: 에디터 저작 골든패스 복구 — 서버 라우트 누락, 낙관 업데이트 부재, 자동저장 debounce, 미구현 배치 UI 일괄 해소.
> **MD 200줄 제한** 준수.

---

## 배경

Phase 18.x 런타임 통합 이후 에디터 일상 사용 중 9건 회귀/미구현이 누적, 신규 테마 저작이 사실상 불가능. 사용자 보고(2026-04-15):

1. `POST /editor/themes/{id}/images/upload-url` → 404 (캐릭터 이미지 등록 시)
2. 캐릭터 배정탭 시작 단서 체크 한박자 지연
3. 글자 하나마다 저장 트리거 → 작성 불가
4. 단서 등록 후 이미지 즉시 미표시 (새로고침 요구)
5. `GET /editor/themes/{id}/clue-relations` → 500
6. `PUT /editor/themes/{id}/config` → 409 (모듈 토글)
7. `PUT /editor/themes/{id}/flow/nodes/{nodeId}` → 405
8. 장소탭에 "맵 + 단서 배치" UI 없음
9. `GET /api/v1/templates` → 404

---

## 근본 원인 매트릭스

| # | 증상 | 근본 원인 | Severity |
|---|------|-----------|----------|
| 1 | upload-url 404 | 라우트 정상 — 클라이언트 경로 합성 버그 (baseURL 2중) | High |
| 2 | 체크 지연 | React Query mutation만 호출, optimistic update 부재 | Medium |
| 3 | 잦은 저장 | Config 폼 debounce 500ms (너무 짧음), useAutoSave(5s) 미활용 | High |
| 4 | 이미지 지연 | uploadImage가 createClue.onSuccess 이후 비동기, invalidate 타이밍 앞섬 | Medium |
| 5 | clue-relations 500 | 신규 테마 빈 결과 시 ErrNoRows 미처리 추정 | High |
| 6 | config 409 | Optimistic lock: 캐시된 version 미갱신 → mismatch | High |
| 7 | flow/nodes 405 | 백엔드 PATCH only, 프론트 PUT 호출 | Medium |
| 8 | 배치 UI 없음 | `LocationsSubTab` CRUD만 구현, 배치 패널 미구현 | Medium |
| 9 | templates 404 | main.go 라우트 미등록 (핸들러만 존재) | High |

상세 소스 경로: [refs/findings.md](refs/findings.md)

**Out of scope**: 런타임 단서 발견 조건 연결(Phase 18.5 후보), 이미지 최적화/썸네일, clue-relations 사이클 검증 UI.

---

## 5대 결정

| # | 결정 | 선택 | 근거 |
|---|------|------|------|
| 1 | 405 해결 방향 | 프론트 PUT→PATCH | REST semantic (부분 업데이트), 기존 백엔드 계약 유지 |
| 2 | 409 rebase | 서버가 current_version 동봉, 프론트 자동 1회 재시도 | 모듈 토글 UX — 모달 대신 silent rebase |
| 3 | Debounce 정책 | Config 1500ms + onBlur flush | 단순 증가로 해결, useAutoSave 전면 교체 보류 |
| 4 | 장소 배치 schema | `locations[].clueIds: string[]` | 기존 config_json 확장, 신규 API 없이 |
| 5 | 이미지 동기화 | setQueryData merge + invalidate | 낙관 반영 + 정합성 보장 |

---

## 재사용 자산

- `useAutoSave` (apps/web/src/features/editor/hooks/useAutoSave.ts:34)
- React Query `onMutate/onError/onSettled` — `editorClueApi.ts:24-32` 패턴
- Presigned upload 3-step — 기존 오디오 미디어 플로우
- `AppError + RFC 9457` extension field (current_version)

---

## Verification

1. `go test -race ./internal/domain/editor/...` green
2. `pnpm test` + `pnpm exec tsc --noEmit` + `pnpm lint` green
3. 수동 골든패스: 새 테마 → 이미지 업로드 → 단서 → 장소 배치 → 모듈 토글 → 템플릿 → 흐름 노드 → 관계 탭
4. Playwright E2E 9 시나리오 추가 (PR-7)
5. 타이핑 중 `PUT /config` 호출이 마지막 입력 후 1.5s 뒤 1회만 발생

---

## 부록 — Config 409 Rebase 의미론 (W1 리뷰 H-2 반영)

**현 구현 (PR-4 `editorConfigApi.ts`)**: 409 수신 시 `payload.version`만 서버의 `current_version`으로 교체하여 1회 재시도. 즉 클라이언트의 `modules` / `module_configs` 배열을 그대로 유지한 채 버전 번호만 바꿔 보낸다.

**의미론 명시**: 이는 **"force overwrite with fresh version"** 정책이다. 다른 탭이 먼저 쓴 변경은 **조용히 덮어써진다** (Snackbar도 뜨지 않음, 사용자는 덮어썼다는 사실 인지 불가).

**정당화 (현 Phase 한정)**:
- 1인 에디터 가정 하에서 대부분의 409는 같은 사용자의 다른 탭/빠른 연속 저장이라 데이터 손실 위험 낮음.
- 모듈 토글 UX는 모달 대신 자동 해결이 압도적으로 우수.

**알려진 한계 (Phase 18.5 이상 후속 PR 후보)**:
- 실제 협업 에디터로 확장 시 3-way merge 필수. 서버가 `extensions.current_state` 까지 반환하고, 클라이언트가 delta만 재적용하는 방식 권장.
- 또는 modules/module_configs 같은 array/object 필드별로 "append-only / overwrite" 의미론을 서버가 선언하도록 schema 수정.

**지금은 덮어쓰기 정책임을 문서로 고정**, 실제 동시편집 요구 생길 때 위 후속 PR을 착수한다.
