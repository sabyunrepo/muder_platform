# Editor + Engine Architecture Redesign

> **Status**: Revised (2026-04-10, review feedback 반영)
> **Scope**: 에디터 + 게임 엔진 재설계 (Phase 8.0 기반 점진적 발전)
> **Target**: 4 genres (Crime Scene, Script Kill, Jubensha, Murder Mystery Party)
> **User**: 비개발자 제작자 (작가/호스트)
> **원칙**: 추상화 + 디자인패턴, MVP 빠른 출시, 실제 병목에서 개선

---

## 결정 요약

| # | 결정 | 선택 | 디자인패턴 |
|---|------|------|-----------|
| 1 | Phase 8.0 | 기반 점진적 발전 (기존 코드 최대 재사용) | Incremental |
| 2 | Architecture | Plugin-Backed Schema (A+C Hybrid) | Strategy + Plugin |
| 3 | Editor UX | 3-Layer Progressive Disclosure | Progressive Disclosure |
| 4 | State Log | PG Audit Log + Redis Hot State (ES 간소화) | Repository |
| 5 | Visual Editor | React Flow (@xyflow/react) | Node Graph |
| 6 | Rule Engine | JSON Logic (클라이언트/서버 동일 엔진) | Interpreter |
| 7 | State Machine | qmuntal/stateless (계층형, wrapper 격리) | State |
| 8 | Concurrency | Actor Model (1 goroutine/Session) | Actor |
| 9 | Clue System | 의존성 그래프 + 조합 + 위치 제한 | Graph + Specification |
| 10 | Plugin Interface | Core + Optional 분리 (ISP 준수) | Interface Segregation |

### Review 반영 변경사항
- Event Sourcing → Audit Log + Redis로 간소화 (복잡도 감소)
- GenrePlugin 13개 메서드 → Core(7) + Optional(6)로 분리
- 서버 룰 엔진 antonmedv/expr → Go JSON Logic 라이브러리로 통일
- Phase 8.0 갈아엎기 → 기존 코드 최대 재사용으로 변경
- 시스템 제약 조건 추가 (최대 테마 크기, 단서 수 등)
- 테스트 전략 추가

---

## 문서 맵 (refs/)

| 파일 | 내용 |
|------|------|
| [refs/patterns.md](refs/patterns.md) | 핵심 디자인패턴과 적용 위치 |
| [refs/backend.md](refs/backend.md) | 백엔드 아키텍처 + 인터페이스 + 데이터 흐름 |
| [refs/frontend.md](refs/frontend.md) | 프론트엔드 에디터 + 게임플레이 구조 |
| [refs/clue-system.md](refs/clue-system.md) | 단서 시스템 상세 (의존성/조합/위치/가시성) |
| [refs/data-models.md](refs/data-models.md) | 핵심 데이터 모델 + Audit Log 스키마 |
| [refs/libraries.md](refs/libraries.md) | 라이브러리 선택 + 근거 |
| [refs/genre-plugins.md](refs/genre-plugins.md) | 4개 장르별 GenrePlugin 구현 가이드 |
| [refs/implementation.md](refs/implementation.md) | 구현 단계 + MVP 로드맵 + 테스트 전략 |

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
│  │    ├─ GenrePlugin (Core + Optional)               │  │
│  │    │   ├─ CrimeScenePlugin                       │  │
│  │    │   ├─ ScriptKillPlugin                       │  │
│  │    │   ├─ JubenshaPlugin                         │  │
│  │    │   └─ MurderMysteryPlugin                    │  │
│  │    ├─ Clue System (Graph + Validator)            │  │
│  │    └─ EventMapping → Hub.Broadcast               │  │
│  └───────────────────────────────────────────────────┘  │
└────────┬────────────────────┬───────────────────────────┘
         │                    │
┌────────▼────────────────────▼───────────────────────────┐
│  Data Layer                                              │
│  PostgreSQL (audit_log, snapshots, themes, users)        │
│  Redis (hot state, cache)                                │
│  Object Storage (images, audio, video)                  │
└─────────────────────────────────────────────────────────┘
```

---

## 핵심 디자인패턴

실제로 구현에 필요한 패턴만 적용합니다.

| 계층 | 패턴 | 효과 |
|------|------|------|
| Engine Core | **Actor** (1 goroutine/Session) | race condition 원천 차단 |
| Engine Core | **Strategy + ISP** (GenrePlugin core + optional) | 장르 교체 + 인터페이스 최소화 |
| Engine Core | **Observer** (Event Bus) | 모듈 간 느슨한 결합 |
| Phase | **State** (계층형 FSM, wrapper 격리) | 복잡한 페이즈 전환 + 라이브러리 교체 자유 |
| Clue | **Graph** (의존성 + 조합) | 단서 관계 표현 |
| Clue | **Specification** (가시성 규칙) | 복잡한 조건을 조합 가능 |
| Editor | **Builder** (ConfigSchema → UI) | 스키마에서 자동 폼 생성 |
| Editor | **Progressive Disclosure** (3레이어) | 입문→고급 점진적 노출 |
| Data | **Repository** (sqlc generated) | 데이터 접근 추상화 |
| DI | **Constructor Injection** (수동) | 의존성 명시적 관리 |

---

## 시스템 제약

| 항목 | 제한 | 이유 |
|------|------|------|
| 최대 단서 수/테마 | 200 | React Flow 성능 보장 |
| 최대 캐릭터 수/테마 | 20 | 게임 밸런스 |
| 최대 페이즈 수/테마 | 50 | 에디터 성능 |
| 최대 페이즈 깊이 | 5단계 | 계층형 FSM 복잡도 제한 |
| 테마 JSON 크기 | 5MB | API payload 제한 |
| WS 메시지 레이트 | 10msg/s/player | 서버 보호 |
| 동시 세션 수/서버 | 500 | Redis 메모리 한계 |
| 세션 최대 시간 | 8시간 | 자원 정리 |
| React Flow 노드 한도 | 200 | 렌더링 성능 (onlyRenderVisibleElements) |
| 에디터 언두 스택 | 50단계 | 메모리 제한 |
