# apps/web — React 프론트엔드 룰

> React 19 + Vite (SPA) + Zustand + **Tailwind CSS 4 (직접 사용)** + lucide-react.
>
> ⚠️ 글로벌 `~/.claude/CLAUDE.md` 의 "Seed Design 3단계" 규칙(@jittda/ui, @seed-design/react)은 **이 프로젝트에 적용되지 않는다**. Tailwind 4를 직접 사용하고 디자인 시스템 라이브러리 의존 없음.

## 라우팅·상태·스타일

- 라우팅: React Router (lazy loading)
- 상태: Zustand 3레이어 (Connection / Domain / UI)
- 스타일: Tailwind CSS only, 다크 모드 기본 (slate/zinc + amber)
- 아이콘: **lucide-react 전용** (다른 아이콘 라이브러리 금지)

## 테스트

- Vitest + Testing Library + MSW
- 커버리지 gate: Lines 49% / Branches 77% / Functions 53%
- 75%+ 커버리지 목표 (Phase 21)

## 파일 크기 (티어)

- `.ts` / `.tsx` 파일 하드 리밋 **400줄**
- 일반 함수 60줄 / JSX 컴포넌트 150줄
- 초과 예상 시 분할 설계 — 서브컴포넌트 추출 / hooks 개별 파일 + 배럴 / api 도메인별 파일 + 배럴

## 폴더 컨벤션

- `apps/web/src/{components,pages,hooks,services,stores,utils,mocks}`
- 컴포넌트: `<Domain><Feature>.tsx` (예: `EditorClueGraph.tsx`)
- 스토어: 도메인별 (`gameSessionStore`, `moduleStoreFactory`, ...)

## WS 클라이언트

- `packages/ws-client` 사용 (직접 `WebSocket` 인스턴스화 ❌)
- 토큰은 `?token=` 쿼리로 전달
- 재접속 정책: exponential backoff + auth.resume (PR-9 이후)

## E2E

- Playwright (`apps/web/e2e/`)
- 백엔드 없으면 로비 플로우 자동 스킵
- 접근성: `@axe-core/playwright` (focus-visible/WCAG 2.1 AA smoke)
