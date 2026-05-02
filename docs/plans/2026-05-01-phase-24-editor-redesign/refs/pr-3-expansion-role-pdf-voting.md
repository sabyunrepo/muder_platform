# Phase 24 PR-3 Expansion — Character Roles, PDF Role Sheet, Voting Candidate Policy

## 배경

PR-3 기존 범위는 캐릭터/장소/단서 entity 화면의 첫 usable slice였다. 진행 중 사용자 결정으로 다음 요구가 추가되었다.

1. 캐릭터가 범인/공범/탐정/일반 용의자 중 어떤 역할인지 에디터에서 명확히 설정한다.
2. 최종 투표에서 탐정을 후보에 포함할지 제외할지 선택할 수 있어야 한다.
3. 역할지는 Markdown만이 아니라 PDF 또는 이미지 페이지 묶음도 지원한다.
4. 모든 프론트 화면은 모바일 우선 반응형 UI로 구현한다.

이 문서는 기존 PR-3를 과도하게 키우지 않기 위해 작업을 작은 PR 단위로 재분할하는 기준 문서다.

## 현재 코드 근거

| 영역 | 현재 상태 | 영향 |
|---|---|---|
| 캐릭터 범인 여부 | `theme_characters.is_culprit` 존재 | 범인 단일 boolean은 있으나 공범/탐정 표현 불가 |
| 공개 캐릭터 API | public response에서 `is_culprit` 숨김 테스트 존재 | 스포일러 보호 방향은 유지 가능 |
| 에디터 캐릭터 API | `EditorCharacterResponse.is_culprit` 노출 | 제작자 화면에서는 역할 편집 가능 |
| 투표 후보 | `VotingPanel`이 생존자 중 나 제외만 후보로 사용 | 탐정 제외/포함 정책 추가 필요 |
| 역할지 | `theme_contents` key-value API 기반 `role_sheet:<characterId>` 계획 | Markdown 외 typed format API 필요 |
| 미디어 | `theme_media.type` = `BGM/SFX/VOICE/VIDEO` | PDF용 `DOCUMENT` 또는 `PDF` 타입 추가 필요 |

## 결정

### D-PR3X-01 — 캐릭터 역할은 boolean 확장이 아니라 enum으로 관리

`is_culprit`에 `is_detective`, `is_accomplice`를 계속 추가하면 조합 오류가 생긴다. 예를 들어 한 캐릭터가 동시에 범인/탐정이 될 수 있다. 따라서 신규 필드는 enum이 맞다.

```ts
type MysteryRole = 'suspect' | 'culprit' | 'accomplice' | 'detective';
```

마이그레이션 기준:

- `is_culprit = true` → `mystery_role = 'culprit'`
- `is_culprit = false` → `mystery_role = 'suspect'`

`is_culprit`는 호환 기간 동안 남기되, 신규 UI/런타임 판단은 `mystery_role`을 우선한다.

### D-PR3X-02 — 탐정 투표 후보 포함 여부는 voting module config에 둔다

탐정 자체는 캐릭터 속성이지만, “투표 후보에 포함할지”는 게임 룰이므로 voting module 설정이다.

```json
{
  "modules": {
    "voting": {
      "enabled": true,
      "config": {
        "candidatePolicy": {
          "includeDetective": false,
          "includeSelf": false,
          "includeDeadPlayers": false
        }
      }
    }
  }
}
```

초기값:

- `includeDetective: false`
- `includeSelf: false`
- `includeDeadPlayers: false`

### D-PR3X-03 — 역할지는 typed model로 추상화한다

기존 `theme_contents` 직접 body 저장만으로는 Markdown/PDF/Images를 안전하게 구분하기 어렵다. API/프론트 모델은 typed role sheet로 설계한다.

```ts
type RoleSheet =
  | { format: 'markdown'; markdown: string }
  | { format: 'pdf'; mediaId: string }
  | { format: 'images'; imageUrls: string[] };
```

저장소는 첫 단계에서 `theme_contents`를 재사용할 수 있다. 단, 프론트와 API 경계는 typed model로 둔다.

### D-PR3X-04 — PDF는 document media로 업로드한다

`theme_media`에 문서 타입을 추가한다.

추천 타입:

```txt
DOCUMENT
```

허용 MIME 1차 범위:

```txt
application/pdf
```

PDF viewer는 모바일에서 한 번에 전체 페이지를 렌더링하지 않고, 현재 페이지 중심으로 렌더링한다.

### D-PR3X-05 — 프론트는 모바일 우선 세로 흐름을 기본으로 한다

`apps/web/AGENTS.md`의 UIUX/반응형 규칙을 따른다.

- 모바일: entity 타입 → 목록 → 상세 → 검수 정보 순서
- 태블릿: 카드 2열 일부 허용
- 데스크톱: 핵심 편집 영역 폭을 먼저 확보하고 보조 패널은 아래 또는 우측에 제한적으로 배치
- 4열 고정 레이아웃 금지

## PR 재분할

### PR-3A — Character Entity + Mystery Role Foundation

목표: 캐릭터 entity에서 범인/공범/탐정/일반 용의자를 설정할 수 있게 한다.

#### Backend

- [x] migration: `theme_characters.mystery_role` 추가
- [x] 기존 `is_culprit` → `mystery_role` backfill
- [x] CHECK 제약: `suspect/culprit/accomplice/detective`
- [x] sqlc query/update 반영
- [x] editor DTO에 `mystery_role` 추가
- [x] public character response에는 `mystery_role` 숨김
- [x] validation: 최소 1명 culprit 필요
- [ ] validation: detective 2명 이상이면 warning 또는 error 정책 결정 후 적용

#### Frontend

- [x] `EditorCharacterResponse` 타입에 `mystery_role` 추가
- [x] 캐릭터 베이스 섹션에 role selector 추가
- [x] 기존 범인 checkbox는 role selector로 대체
- [ ] dev preview 목업도 role selector 기준으로 갱신
- [x] focused component/API type test 보강

#### 완료 기준

- [x] 에디터에서 캐릭터 역할을 저장/재조회할 수 있다.
- [x] public API에는 역할 스포일러가 노출되지 않는다.
- [x] 기존 `is_culprit` 데이터는 `culprit`로 보존된다.

### PR-3B — Voting Candidate Policy

목표: 최종 투표 후보에서 탐정을 포함/제외하는 옵션을 제공한다.

#### Backend / Config

- [x] voting module config schema에 `candidatePolicy` 추가
- [x] config/schema/runtime 기본값 보강
- [x] schema 기반 candidatePolicy shape 검증 경계 추가
- [x] 게임 런타임 후보 계산 지점 확인 및 정책 적용 — 프론트 후보 계산에서 즉시 필터링하고, 서버 voting 수신 경로도 `PlayerInfoProvider`가 제공하는 roster 정보로 자기 자신/탐정/탈락자 우회 투표를 거절하며, provider가 있는 세션에서는 UUID가 아닌 `targetCode`도 roster alias로 해석하거나 해석 실패 시 fail-close로 거절

#### Frontend

- [x] voting 설정 UI에 “탐정을 투표 후보에 포함” 토글 추가 — module schema object + nested config 보존
- [x] `VotingPanel`/`VotePanel` 후보 필터에서 정책 반영
- [x] 탐정 제외 시 빈 후보/적은 후보 상태 문구 추가

#### 완료 기준

- [x] `includeDetective=false`면 detective 캐릭터는 투표 후보에 보이지 않는다.
- [x] `includeDetective=true`면 detective도 후보에 포함된다.
- [x] 자기 자신 제외 정책은 유지된다.

### PR-3C — Typed Role Sheet API + Markdown Compatibility

목표: PDF/이미지 확장을 위해 역할지 저장 경계를 typed model로 바꾼다.

#### Backend

- [x] role sheet DTO 추가
- [x] `GET /editor/characters/{id}/role-sheet` 추가
- [x] `PUT /editor/characters/{id}/role-sheet` 추가
- [x] 내부 저장은 우선 `theme_contents` 재사용 가능
- [x] format별 validation 추가

#### Frontend

- [x] `RoleSheet` 타입 추가
- [x] `useCharacterRoleSheet` / `useUpsertCharacterRoleSheet` hook 추가
- [x] 기존 Markdown 역할지 섹션을 typed API로 전환
- [x] 기존 `role_sheet:<id>` content는 호환 읽기 처리

#### 완료 기준

- [x] 기존 Markdown 역할지가 깨지지 않는다.
- [x] 프론트는 format에 따라 renderer를 분기할 수 있다.

### PR-3D — DOCUMENT/PDF Upload + Page Viewer

목표: 역할지 PDF 업로드와 한 페이지씩 읽는 viewer를 제공한다.

#### Backend

- [ ] migration: `theme_media` valid type에 `DOCUMENT` 추가
- [ ] upload request에서 `DOCUMENT` 허용
- [ ] `application/pdf` MIME 검증
- [ ] role sheet `pdf.mediaId`가 DOCUMENT media인지 검증
- [ ] media delete 시 role sheet 참조 충돌 처리

#### Frontend

- [ ] PDF 업로드 UI 추가
- [ ] role sheet format selector: Markdown / PDF / Images
- [ ] PDF page viewer 추가
- [ ] 모바일에서 1페이지 단위 읽기 UX 구현
- [ ] PDF viewer dependency는 lazy load

#### 완료 기준

- [ ] 제작자는 PDF 역할지를 업로드하고 캐릭터에 연결할 수 있다.
- [ ] 플레이어/preview는 PDF를 한 페이지씩 읽을 수 있다.
- [ ] 모바일에서 가로 스크롤 없이 조작 가능하다.

### PR-3E — Image Role Sheet Viewer

목표: PDF가 아닌 이미지 페이지 묶음 역할지도 지원한다.

#### Backend

- [ ] image URL 배열 validation
- [ ] 필요 시 image asset 참조 검증

#### Frontend

- [ ] 이미지 페이지 추가/삭제/순서 변경 UI
- [ ] image page viewer 추가
- [ ] 모바일 1페이지 단위 viewer 공유

#### 완료 기준

- [ ] 이미지 여러 장을 역할지처럼 순서대로 볼 수 있다.

## 기존 PR-3와의 관계

현재 PR-3에서 이미 진행한 helper/캐릭터 detail 일부는 유지한다.

- 유지: entityReferences helper
- 유지: entityMeta helper
- 유지: 캐릭터 base/detail UI 방향
- 수정: `CharacterRoleSheetSection`은 Markdown-only에서 typed role sheet로 후속 전환
- 수정: `is_culprit` UI는 `mystery_role` selector로 후속 전환
- 유지: 장소/단서 entity 작업은 PR-3A 이후 이어서 진행 가능

## 작업 우선순위

1. PR-3A 캐릭터 역할 모델
2. PR-3B voting 후보 정책
3. PR-3C typed role sheet API
4. PR-3D PDF/DOCUMENT 업로드 + viewer
5. PR-3E 이미지 역할지 viewer
6. 기존 PR-3 장소/단서 entity 마무리

## 검증 전략

### Backend

```bash
cd apps/server && go test ./internal/domain/editor ./internal/domain/theme ./internal/module/... ./internal/db/...
```

### Frontend

```bash
cd apps/web && pnpm exec vitest run \
  src/features/editor/components/design/__tests__/CharacterAssignPanel.test.tsx \
  src/pages/Phase24EditorPreviewPage.test.tsx

cd apps/web && pnpm typecheck
```

### Browser

- `/__dev/phase24-editor-preview`
- 모바일 폭 390px
- 데스크톱 폭 1365px

## 리스크

| 리스크 | 대응 |
|---|---|
| PR-3 범위 과대 | PR-3A~E로 분리 |
| 기존 `is_culprit` 호환 깨짐 | backfill + 호환 기간 유지 |
| public API 스포일러 노출 | public DTO/test 유지 및 확장 |
| PDF 렌더링 성능 | lazy load + 현재 페이지 중심 렌더 |
| 모바일 UI 혼잡 | `apps/web/AGENTS.md` 반응형 원칙 강제 |
