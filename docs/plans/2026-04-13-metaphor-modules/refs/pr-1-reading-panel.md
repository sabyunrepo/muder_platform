# PR-1: ReadingPanel — reading 모듈 UI

## 개요
페이즈별 텍스트 콘텐츠(프롤로그, 오프닝, 시크릿카드)를 표시하고 읽기 완료를 서버에 전송.

## scope_globs
- apps/web/src/features/game/components/ReadingPanel.tsx
- apps/web/src/features/game/components/__tests__/ReadingPanel.test.tsx

## 백엔드 참조
- apps/server/internal/module/progression/reading.go
- WS 이벤트: reading:content (서버→클라), reading:done (클라→서버)

## 구현 상세
1. ReadingPanel props: `{ send, moduleId }`
2. useModuleStore에서 content (title, body, type) 구독
3. 텍스트 렌더링 (마크다운 지원 불필요, plain text)
4. "읽기 완료" 버튼 → send("reading:done", {})
5. 완료 후 패널 닫힘 또는 다음 콘텐츠 대기

## 테스트
- ReadingPanel 렌더링 (content 있을 때/없을 때)
- 읽기 완료 버튼 클릭 시 send 호출 확인
