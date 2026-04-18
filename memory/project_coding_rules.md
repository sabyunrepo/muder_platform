---
name: MMP v3 코딩 규칙
description: Go 백엔드와 React 프론트엔드 코딩 규칙 - 계층구조, DI, 에러처리, 상태관리, 테스트
type: project
---

**Go 백엔드:**
- 계층: Handler → Service(인터페이스) → Repository/Provider(구현)
- DI: 생성자 주입 (수동, 프레임워크 없음)
- 에러: AppError + RFC 9457 Problem Details + 에러 코드 레지스트리
- 로깅: zerolog (console.log 금지)
- 테스트: mockgen + testcontainers-go, 75%+ 커버리지
- HTTP: Chi 라우터, WS: gorilla/websocket

**React 프론트엔드:**
- 라우팅: React Router (lazy loading)
- 상태: Zustand 3레이어 (Connection / Domain / UI)
- 스타일: Tailwind CSS only, 다크 모드 기본 (slate/zinc + amber)
- 아이콘: lucide-react 전용
- 테스트: Vitest + Testing Library + MSW

**Go ↔ TS 타입 공유:**
- REST: Go → OpenAPI spec → openapi-typescript
- WebSocket: packages/shared/ws/ (source of truth) → Go struct 수동 동기화 + CI 검증
- configJson: Zod(TS) + JSON Schema → Go struct

**버전관리:** Semantic Versioning, Conventional Commits (feat/fix/perf/docs/test/chore)

**Why:** 일관성 유지, 타입 안전성, 테스트 용이성
**How to apply:** 모든 코드 작성 시 이 규칙 준수 필수
