# apps/web - React 프론트엔드 규칙

React 19 + Vite SPA + Zustand + Tailwind CSS 4 직접 사용 + `lucide-react`.

이 파일은 Codex에서 `apps/web/` 하위 파일을 작업할 때 자동으로 적용되는 프론트엔드 지침이다. Claude Code의 `CLAUDE.md`에 해당하는 Codex용 control surface는 `AGENTS.md`다.

## 기본 소통 언어

- 사용자-facing 설명, 작업 보고, UI/UX 의사결정 문서는 기본적으로 한국어로 작성한다.
- 비전문가도 이해할 수 있게 작성한다. 프론트엔드, 상태 관리, 접근성, 성능 용어는 처음 등장할 때 쉬운 말로 풀어쓰고, 사용자가 체감하는 영향을 함께 설명한다.
- 코드 식별자, 라이브러리명, 에러 메시지, 명령어는 원문을 유지한다.

## 프론트엔드 카논

- 라우팅: React Router lazy loading.
- 상태: Zustand 3레이어. Connection, Domain, UI.
- 데이터 fetching/cache: 서버 상태는 TanStack Query를 우선 사용한다.
- 스타일: Tailwind CSS 4 직접 사용. 별도 디자인 시스템 패키지를 추가하지 않는다.
- 색상/톤: 다크 모드 기본, slate/zinc + amber 계열을 기본 축으로 한다.
- 아이콘: `lucide-react`만 사용한다. 다른 아이콘 라이브러리를 추가하지 않는다.
- 글로벌 Claude 설정에 Seed Design, `@jittda/ui`, `/jittda-*` 스킬이 언급되어도 이 프로젝트에는 적용하지 않는다.

## 사용자 친화성 / UIUX 원칙

- 모든 프론트 작업은 기능 구현뿐 아니라 사용자가 실제로 이해하고 조작하기 쉬운지를 함께 검토한다.
- 화면은 “무엇을 해야 하는지 → 현재 상태가 무엇인지 → 다음 행동이 무엇인지”가 즉시 보이게 구성한다.
- 주요 액션은 명확한 라벨을 사용한다. 아이콘만 있는 버튼은 반드시 `aria-label` 또는 보이는 텍스트를 제공한다.
- 복잡한 에디터 작업은 한 화면에 모두 밀어 넣지 말고, 목록/상세/검수/저장 상태를 단계적으로 읽히게 배치한다.
- 사용자가 몰라도 되는 내부 정보는 기본 화면에 표시하지 않는다. 특히 제작자 에디터에서 internal ID, legacy code, 저장 JSON shape, config key, DB 필드명, 개발자용 모듈 key 같은 정보는 숨기고, 필요한 경우 dev-only 또는 admin/debug 접힘 영역에만 둔다.
- 정보가 많아질수록 사용자 편의가 떨어질 수 있으므로, 화면에는 현재 의사결정과 다음 행동에 필요한 정보만 우선 노출한다. 보조 검수 정보도 제작자가 이해하는 말로 요약하고 원문 key를 그대로 노출하지 않는다.
- 빈 상태, 로딩 상태, 오류 상태, 저장 성공/실패 상태를 사용자가 이해할 수 있는 문장으로 표시한다.
- 위험하거나 되돌리기 어려운 액션은 명확한 확인/경고를 제공한다. 예: 삭제, publish, 스포일러 공개.
- 색상만으로 상태를 전달하지 않는다. 텍스트, 아이콘, 배지 등 보조 단서를 함께 제공한다.
- 모바일 사용자를 2등 사용자로 취급하지 않는다. 모바일에서도 핵심 읽기/편집/확인 흐름이 완결되어야 한다.
- UI가 좁아질 때 정보를 숨기기보다 우선순위를 정해 세로로 재배치한다. 꼭 숨겨야 하면 접힘/더보기 패턴을 사용한다.
- 터치 환경을 고려해 클릭 영역, 카드 간격, 폼 필드 높이를 충분히 확보한다.
- 긴 텍스트, 역할지, PDF/이미지 문서, 설명문은 모바일에서 읽기 가능한 줄 길이와 여백을 유지한다.
- dev preview 또는 신규 UI를 만들면 가능하면 모바일 폭(예: 390px)과 데스크톱 폭을 모두 확인한다.

## 반응형 UI 원칙

- 모든 신규/수정 페이지는 모바일 우선으로 설계한다.
- 모든 프론트 페이지는 반응형 디자인을 기본 요구사항으로 본다. 별도 요청이 없어도 모바일/태블릿/데스크톱을 함께 고려한다.
- 모바일 기본 흐름은 세로 스택이다. 작은 화면에서 핵심 상세가 옆으로 밀리는 3열/4열 고정 레이아웃을 금지한다.
- 모바일에서는 가로 스크롤 없이 주요 정보를 읽고 조작할 수 있어야 한다.
- 데스크톱에서도 본문 폭을 과도하게 늘리지 않는다. 편집 폼/긴 텍스트/문서 뷰어는 읽기 가능한 폭을 유지한다.
- 보조 정보는 작은 화면에서 본문 아래로 내려간다. 예: 참조상태, backlink, inspector, metadata.
- Tailwind breakpoint 사용 기준:
  - 기본: 모바일 세로 스택
  - `sm`/`md`: 카드 2열까지 허용
  - `lg` 이상: 보조 패널을 옆에 둘 수 있으나 핵심 편집 영역 너비를 먼저 확보
  - 4열 이상은 dev-only diagnostics가 아니면 피한다
- 터치 조작 기준으로 버튼/클릭 영역은 충분한 높이와 간격을 둔다.
- 브라우저 확인 시 최소 1개 모바일 폭(예: 390px)과 데스크톱 폭을 같이 본다.

## 에디터 기능 설계 전 Uzu 참고

When:
- 캐릭터, 단서, 장소, 페이즈, 결말 등 에디터 기능을 새로 만들거나 개선할 때

Do:
1. `docs/uzu-studio-docs`에서 관련 문서를 먼저 확인한다.
2. Uzu가 어떤 제작 문제를 어떤 UI/흐름으로 해결하는지 요약한다.
3. MMP의 실시간 멀티플레이, 권한, R2 미디어, backend engine 구조에 맞게 반영할 점과 제외할 점을 나눈다.
4. 구현 전 브리핑에 `Uzu 참고점`, `MMP 적용 방식`, `제외/후순위`를 포함한다.

Done when:
- 에디터 기능 제안 또는 구현 계획에 Uzu 참고 결과와 MMP식 재해석이 포함되어 있다.

Avoid:
- Uzu 구조를 그대로 복제하지 않는다.
- Uzu에 있다는 이유만으로 MMP에 필요 없는 정보나 설정을 노출하지 않는다.

## 에디터 UI 원칙

- 제작자 에디터와 플레이어 런타임 UI를 분리한다.

### 제작자에게 필요한 정보만 표시

When:
- 에디터 화면, 검수 패널, 상세 패널, dev preview를 만들거나 수정할 때

Do:
1. 제작자가 지금 결정을 내리는 데 필요한 정보만 우선 표시한다.
2. internal ID, DB 필드명, config key, engine module key, 저장 JSON shape, legacy code는 기본 화면에서 숨긴다.
3. 필요한 검수 정보는 제작자 언어로 요약한다. 예: “이 단서는 아직 어디에도 연결되지 않았어요.”
4. 개발자용 원문 데이터는 필요할 때만 dev-only/debug 접힘 영역에 격리한다.

Done when:
- 화면을 보는 제작자가 다음 행동을 이해할 수 있고, 내부 구현 정보를 몰라도 작업을 완료할 수 있다.

Avoid:
- “혹시 필요할 수 있다”는 이유로 시스템 정보를 기본 화면에 늘어놓지 않는다.
- 검수 패널을 개발자 로그나 JSON viewer처럼 만들지 않는다.

- 에디터에는 제작자가 실제로 판단해야 하는 검수용 정보만 보일 수 있다. 예: 참조상태, 미사용 단서, backlink, 장소 tree-ready, validation warning. 내부 ID나 저장 구조처럼 제작자가 몰라도 되는 정보는 기본 검수 패널에서도 제외한다.
- 플레이어 화면에는 스포일러성 제작 정보가 노출되면 안 된다. 예: 범인 여부, 공범 여부, 단서 backlink, 다른 캐릭터 역할지.
- 캐릭터/장소/단서 entity 화면은 세로 흐름을 기본으로 한다.
  1. entity 타입 선택
  2. entity 목록/검색
  3. 선택 entity 상세
  4. 모듈별 섹션
  5. 참조/검수 패널
- 캐릭터 역할지는 format 확장 가능성을 고려한다.
  - Markdown: 텍스트 body
  - PDF: document media 참조 + 페이지 단위 viewer
  - Images: 이미지 배열 viewer
- PDF/이미지 viewer는 모바일에서 한 페이지씩 읽는 경험을 우선한다. 전체 PDF 페이지를 한 번에 렌더링하지 않는다.
- 범인/공범/탐정 같은 스포일러 속성은 에디터와 권한 있는 런타임 API에서만 다룬다.

## React 구조 원칙

### Frontend Adapter와 재사용 컴포넌트

When:
- 에디터 entity, phase, ending, role sheet, clue/location/character UI를 만들거나 개선할 때

Do:
1. API DTO와 저장 config를 화면 컴포넌트에 직접 흘리지 않고 제작자용 ViewModel로 변환한다.
2. 변환 책임은 `*Adapter`, mapper, feature-local helper에 둔다.
3. 반복되는 검색, 선택, 다중 선택, 업로드, 삭제 확인, 검수 패널은 재사용 가능한 컴포넌트로 분리한다.
4. 컴포넌트는 view, interaction, data adapter, persistence 책임을 섞지 않는다.
5. props가 과하게 늘어나면 compound component, hook, adapter 분리를 검토한다.

Done when:
- 같은 UI 패턴을 다른 entity에 옮길 때 복사/붙여넣기보다 재사용 또는 작은 adapter 교체로 대응 가능하다.

Avoid:
- 1회성 UI를 성급하게 범용 컴포넌트로 만들지 않는다.
- 컴포넌트가 backend engine config key나 JSON shape를 직접 표시/편집하게 하지 않는다.


- 컴포넌트는 변경 이유별로 분리한다. 긴 단일 TSX에 검색/list/detail/inspector/save 로직을 모두 넣지 않는다.
- 데이터 로직과 view를 분리한다. 서버 상태는 query hook, 화면 상태는 가까운 컴포넌트에 둔다.
- 단순 파생값은 `useEffect + setState`로 동기화하지 말고 render 중 계산한다.
- 복잡한 다중 필드 전환은 `useReducer` 또는 명확한 helper 함수로 분리한다.
- rapidly-changing 값에는 Context를 남용하지 않는다.
- 테스트는 구현 세부보다 사용자 행동/보이는 결과를 검증한다.

## 테스트

- 스택: Vitest + Testing Library + MSW.
- 현재 커버리지 gate: Lines 49%, Branches 77%, Functions 53%.
- 목표: Phase 21에서 75%+ coverage.
- E2E: `apps/web/e2e/` 아래 Playwright.
- 모든 코드 작성/수정 PR은 사용자 관점의 E2E 테스트를 필수로 작성하거나 기존 E2E를 갱신한다.
  - 새 페이지, 라우트, 핵심 버튼/폼, 저장/업로드/권한/리다이렉트 흐름은 Playwright E2E로 검증한다.
  - 백엔드 의존 흐름은 `localhost:8080/health` 같은 사전 확인으로 실행 불가 환경에서 자동 skip되게 작성한다.
  - 순수 내부 로직처럼 Playwright E2E가 부적합한 경우에도 integration/unit test로 대체하고, PR/보고에 “E2E 미작성 사유”와 대체 테스트를 명시한다.
  - dev-only preview를 만든 경우 최소 1개 E2E 또는 브라우저 확인으로 모바일 폭과 데스크톱 폭의 핵심 표시를 검증한다.
- 코드 작성/수정 PR은 Codecov patch coverage 70% 이상을 merge 기준으로 달성해야 한다. E2E로 커버하기 어려운 분기/에러 처리는 Vitest 단위 테스트로 보강한다.
- 백엔드가 없으면 lobby flow E2E는 자동 skip되어야 한다.
- 접근성 smoke: `@axe-core/playwright`, focus-visible, WCAG 2.1 AA 기본 항목.
- UI 변경 후 가능하면 focused Vitest + typecheck를 실행한다.

## 폴더 및 네이밍

- 폴더: `apps/web/src/{components,pages,hooks,services,stores,utils,mocks}`.
- 기능 단위 코드는 가능하면 `apps/web/src/features/<domain>/...` 아래에 둔다.
- 컴포넌트: `<Domain><Feature>.tsx`, 예: `EditorClueGraph.tsx`.
- 스토어: `gameSessionStore`, `moduleStoreFactory`처럼 도메인별로 둔다.
- dev-only preview는 `apps/web/src/pages/*PreviewPage.tsx` 또는 feature-local dev component로 분리한다.

## 에디터 Auto-Save

- debounce + optimistic update + rollback + `onBlur` flush + unmount cleanup 조합은 `apps/web/src/hooks/useDebouncedMutation.ts`를 사용한다.
- 에디터 패널에서 직접 `useRef + setTimeout` debounce boilerplate를 작성하지 않는다.
- `applyOptimistic`은 flush 시점에만 호출한다. schedule 시점에 cache write를 하지 않는다.
- 즉시 UI 반영이 필요하면 caller 쪽에서 `setQueryData`로 mirror하고, 진짜 pre-edit snapshot은 `pendingSnapshotRef`에 캡처한다.
- 카논 상세: `memory/feedback_optimistic_apply_timing.md`, `memory/feedback_optimistic_rollback_snapshot.md`.

## WebSocket Client

- `packages/ws-client`를 사용한다. 앱 코드에서 `WebSocket`을 직접 instantiate하지 않는다.
- 토큰은 `?token=` 쿼리 파라미터로 전달한다.
- 재접속 정책: PR-9 이후 exponential backoff + `auth.resume`.

## 프론트엔드 포인터

| 규칙 | Master |
| ---- | ------ |
| 파일/함수 크기: TS/TSX 400줄, 일반 함수 60줄, JSX 컴포넌트 150줄 | `memory/feedback_file_size_limit.md` |
| React/PWA/audio 리뷰 패턴 | `memory/feedback_code_review_patterns.md` |
| WebSocket 토큰 쿼리 파라미터 | `memory/feedback_ws_token_query.md` |
