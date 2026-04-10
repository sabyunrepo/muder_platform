# Editor + Engine Architecture Redesign

> **Status**: Approved (2026-04-10)
> **Scope**: 에디터 + 게임 엔진 전체 재설계 (Phase 8.0 갈아엎기)
> **Target**: 4 genres (Crime Scene, Script Kill, Jubensha, Murder Mystery Party)
> **User**: 비개발자 제작자 (작가/호스트)
> **원칙**: 추상화 + 디자인패턴 기반, 제작/사용 용이성 최우선

---

## 결정 요약

| # | 결정 | 선택 | 디자인패턴 |
|---|------|------|-----------|
| 1 | Phase 8.0 | 갈아엎고 새 Phase | Clean Slate |
| 2 | Architecture | Plugin-Backed Schema (A+C Hybrid) | Strategy + Plugin + Schema |
| 3 | Editor UX | 3-Layer Progressive Disclosure | Progressive Disclosure |
| 4 | Event Store | PostgreSQL Full Event Store | Event Sourcing + CQRS |
| 5 | Visual Editor | React Flow (@xyflow/react) | Node Graph |
| 6 | Rule Engine | JSON Logic + antonmedv/expr | Interpreter |
| 7 | State Machine | qmuntal/stateless (계층형) | State |
| 8 | Concurrency | Actor Model (1 goroutine/Session) | Actor |
| 9 | Clue System | 의존성 그래프 + 조합 + 위치 제한 | Graph + Chain of Responsibility |

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/patterns.md](refs/patterns.md) | 사용된 모든 디자인패턴과 적용 위치 |
| [refs/backend.md](refs/backend.md) | 백엔드 아키텍처 + 인터페이스 + 데이터 흐름 |
| [refs/frontend.md](refs/frontend.md) | 프론트엔드 에디터 + 게임플레이 구조 |
| [refs/clue-system.md](refs/clue-system.md) | 단서 시스템 상세 (의존성/조합/위치/가시성) |
| [refs/data-models.md](refs/data-models.md) | 핵심 데이터 모델 + Event Store 스키마 |
| [refs/libraries.md](refs/libraries.md) | 라이브러리 선택 + 근거 |
| [refs/genre-plugins.md](refs/genre-plugins.md) | 4개 장르별 GenrePlugin 구현 가이드 |
| [refs/implementation.md](refs/implementation.md) | 구현 단계 + MVP 로드맵 |

---

## 아키텍처 한 줄 그림

```
┌──────────────────────────────────────────────────────────┐
│  Client Layer                                            │
│  Editor (React+RF) │ Game (React+Zustand) │ Admin       │
└────────┬────────────────────┬──────────────────┬────────┘
         │ REST               │ WS+REST          │ REST
┌────────▼────────────────────▼──────────────────▼────────┐
│  Service Layer                                          │
│  Editor Svc │ Session Svc │ Theme Svc │ Auth Svc       │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Game Engine Core                                  │  │
│  │  Session (Actor)                                 │  │
│  │    ├─ Phase Engine (stateless, 계층형)            │  │
│  │    ├─ Event Bus (session-scoped)                  │  │
│  │    ├─ GenrePlugin (Strategy 패턴)                 │  │
│  │    │   ├─ CrimeScenePlugin                       │  │
│  │    │   ├─ ScriptKillPlugin                       │  │
│  │    │   ├─ JubenshaPlugin                         │  │
│  │    │   └─ MurderMysteryPlugin                    │  │
│  │    ├─ Clue System (Graph + Chain of Resp)        │  │
│  │    └─ EventMapping → Hub.Broadcast               │  │
│  └───────────────────────────────────────────────────┘  │
└────────┬────────────────────┬───────────────────────────┘
         │                    │
┌────────▼────────────────────▼───────────────────────────┐
│  Data Layer                                              │
│  PostgreSQL (events, snapshots, themes, users)           │
│  Redis (hot state, cache, pub/sub)                      │
│  Object Storage (images, audio, video)                  │
└─────────────────────────────────────────────────────────┘
```

---

## 핵심 디자인패턴 적용

이 설계는 15개 이상의 디자인패턴을 조합하여 **확장성(새 장르 추가 = 기존 코드 변경 0)**과 **사용성(비개발자가 에디터로 제작)**을 동시에 달성합니다. 자세한 패턴별 적용 위치는 `refs/patterns.md` 참조.

### 계층별 핵심 패턴

| 계층 | 패턴 | 효과 |
|------|------|------|
| Engine Core | **Actor** (1 goroutine/Session) | race condition 원천 차단 |
| Engine Core | **Strategy** (GenrePlugin) | 장르 교체 = 설정 변경 |
| Engine Core | **Observer** (Event Bus) | 모듈 간 느슨한 결합 |
| Engine Core | **Chain of Responsibility** (Validator) | 이벤트 검증 체인 |
| Phase | **State** (stateless 계층형 FSM) | 복잡한 페이즈 전환 관리 |
| Module | **Plugin** (Factory + init registration) | 핫 로드, 독립 개발 |
| Module | **Decorator** (PhaseAction pipeline) | 전/후처리 오버레이 |
| Clue | **Composite** (의존성 그래프) | 단서 조합/선행관계 표현 |
| Clue | **Specification** (가시성 규칙) | 복잡한 조건을 조합 가능 |
| Editor | **Builder** (ConfigSchema → UI) | 스키마에서 자동 폼 생성 |
| Editor | **Progressive Disclosure** (3레이어) | 입문→고급 점진적 노출 |
| Data | **Event Sourcing** + **CQRS** | 완전한 재생/복기/롤백 |
| Data | **Repository** (sqlc generated) | 데이터 접근 추상화 |
| DI | **Constructor Injection** (수동) | 의존성 명시적 관리 |
