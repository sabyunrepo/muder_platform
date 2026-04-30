---
file: 11-glossary.md
purpose: MMP v3 도메인 용어 + 시스템 약어 정의 — AI가 다른 문서를 읽기 전 컨텍스트 확보
audience: design-AI
last_verified: 2026-04-30
sources_of_truth:
  - memory/project_overview.md
  - memory/project_module_system.md
  - memory/project_social_system.md
related: [01-system-overview.md, 05-realtime.md]
---

# 11. Glossary

> AI 진입 전 1회 통독 권장. 이 문서는 다른 모든 문서의 약어·도메인 어휘 해소용.

## 도메인 어휘 (머더미스터리 게임) {#domain}

| 용어 | 정의 | 출처 |
|---|---|---|
| **세션 (Session)** | 한 판의 게임. 호스트 1명 + 플레이어 N명. `session_id` UUID | memory/project_overview.md |
| **테마 (Theme)** | 게임 시나리오 템플릿. 사건·인물·배경·단서 묶음. 에디터에서 작성 | memory/project_phase170_plan.md |
| **라운드 (Round)** | 게임 진행 단위. 단서·장소가 라운드별로 활성/비활성 분기 | memory/project_phase20_progress.md |
| **단서 (Clue)** | 플레이어가 획득·조합하는 정보 조각. AUTO/CRAFT 두 종류 | memory/project_phase20_progress.md |
| **단서 그래프 (Clue Edge)** | 단서간 의존·결합 관계. DAG. `clue_edge_groups` 통합 스키마 (Phase 20) | apps/server/db/migrations/00024_unified_clue_edges.sql |
| **메타포 (Metaphor)** | 추리·해석을 강제하는 텍스트 템플릿. 단서에 부착 | memory/project_phase110_plan.md |
| **장소 (Location)** | 플레이어가 이동·조사하는 공간. 단서·이벤트 트리거 위치 | memory/project_phase20_progress.md |
| **배치 (Placement)** | 라운드별 단서/플레이어/이벤트의 시공간 배치 | memory/project_phase130_plan.md |
| **모듈 (Module)** | 한 게임 기능 단위 (chat, voting, exploration 등 33개) | memory/project_module_system.md |
| **PhaseAction** | 게임 진행 중 모듈에 발송되는 선언적 명령 (12종). `configJson.phases` 정의 | memory/project_module_system.md |
| **에디터 (Editor)** | 테마 작성 React UI. React Flow 캔버스 + 분기·엔딩·조건빌더 | memory/project_phase150_progress.md |
| **로비 (Lobby)** | 세션 시작 전 대기방 | memory/project_phase170_plan.md |
| **호스트 (Host) / GM** | 게임 진행자. `gm_control` 모듈 권한 보유 | memory/project_module_system.md |

## 시스템 약어 {#abbreviations}

| 약어 | 풀이 | 비고 |
|---|---|---|
| **MMP** | Murder Mystery Platform | v2(폐기, Node) → v3(현재, Go) |
| **WS** | WebSocket | gorilla/websocket. `?token=` 쿼리 인증 |
| **ARC** | Actions Runner Controller | KT Cloud K8s 기반 self-hosted runner. Phase 22~23 |
| **MSW** | Mock Service Worker | 프론트 테스트 API 목 |
| **RTL** | React Testing Library | Vitest와 함께 사용 |
| **SPA** | Single Page Application | React + Vite. SSR 없음 (Next.js 폐기) |
| **CDN** | Content Delivery Network | Cloudflare Pages |
| **PWA** | Progressive Web App | `vite-plugin-pwa` 사용 |
| **OMC** | Opus → Multi-agent → Compound | `compound-mmp` 플러그인 워크플로우 |
| **DAG** | Directed Acyclic Graph | 단서 그래프 구조 (`clue_edge_groups`) |
| **DI** | Dependency Injection | Go 백엔드는 생성자 주입 (수동, 프레임워크 X) |
| **GHCR** | GitHub Container Registry | runner 이미지 보관소 (Phase 23 이후) |
| **OTel** | OpenTelemetry | trace_id 백엔드↔프론트 연결 |
| **RFC 9457** | Problem Details for HTTP APIs | AppError 응답 포맷 |

## 핵심 패턴 어휘 {#patterns}

| 패턴 | 정의 | 강제 시점 |
|---|---|---|
| **PlayerAware 게이트** | 모든 `engine.Module`은 `BuildStateFor(playerID)` redaction **또는** `PublicStateMarker` 임베드 둘 중 하나 충족. 미충족 시 registry boot panic | F-sec-2 / Phase 19.1 PR-A 이후 |
| **BaseModule + ConfigSchema + PhaseReactor + Factory** | 모듈 4-pillar. 선언적 설정 + 자동 콘텐츠 + Phase 반응 + 세션별 인스턴스 | apps/server/internal/module/* |
| **Handler → Service → Repository** | Go 3계층. Service는 인터페이스, Repository는 sqlc 생성 코드 | apps/server/CLAUDE.md |
| **Connection / Domain / UI 3-layer state** | React 상태 분리. Connection=WsClient, Domain=Zustand, UI=local | apps/web/CLAUDE.md |
| **AUTO vs CRAFT 단서** | AUTO=라운드 진입 시 자동 부여, CRAFT=조합으로 생성 | memory/project_phase20_progress.md |
| **ConfigSchema** | Zod (TS) ↔ JSON Schema ↔ Go struct 단일 source. 에디터 자동 UI 렌더 근거 | memory/project_coding_rules.md |
| **EventBus** | 모듈간 비동기 메시지. `internal/eventbus/` | apps/server/internal/eventbus/ |
| **AppError** | RFC 9457 + i18n params + FieldError + Sentry 자동 캡처 | memory/project_error_system.md |
| **admin-skip merge** | `gh pr merge --admin --squash`. CI red 우회용. 부채 정리 phase 종료 시 만료 예정 | memory/project_ci_admin_skip_until_2026-05-01.md |

## 폐기·혼동 주의 {#deprecated-or-confusing}

- **v2 (Node.js + Socket.IO + Prisma + Next.js)**: 전면 폐기. v3는 새 레포에서 처음부터 작성. v2 docs는 `mmp-v2-docs` QMD 컬렉션에서 참조용으로만 유지.
- **`LocationClueModule` ≠ `LocationModule`**: 전자(#24, exploration, 공용 단서 풀) vs 후자(#30, crime_scene, per-player 이동·검사). 별개 모듈.
- **`/ws/game` ≠ `/ws/social`**: 게임 Hub(sessionID 기반) vs SocialHub(userID 기반). 혼용 금지.
- **세 종류의 음성**: `voice_chat` (전체) / `whisper` (1:1) / `spatial_voice` (근접 기반) — LiveKit 기반.
