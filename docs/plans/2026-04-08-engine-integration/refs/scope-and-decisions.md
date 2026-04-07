# Scope & 7대 결정 상세

> 부모: [../design.md](../design.md)

---

## 1. Scope 경계

### In scope (Phase 8.0, 12 모듈)

**Core (4)**
- `connection` — 연결/재연결 관리
- `room` — 방 상태, host/player 추적
- `ready` — 시작 전 ready 합의
- `clue_interaction` — 단서 상호작용 기본

**Progression (8)**
- `script` / `hybrid` / `event` — 3 progression strategies
- `skip_consensus` — 스킵 합의
- `gm_control` / `consensus_control` — GM 개입
- `reading` — 대사 진행 (Phase 7.7에서 준비됨, wiring만)
- `ending` — 게임 종료 처리

### Out of scope (Phase 8.0.x 후속)

| 카테고리 | 모듈 (17개) | 이유 |
|---------|------------|------|
| Communication (5) | text_chat, whisper, group_chat, voice_chat, spatial_voice | LiveKit 결합 필요, 별도 설계 |
| Decision (3) | voting, accusation, hidden_mission | Phase 8.0 패턴 복사 |
| Exploration (4) | floor/room/timed_exploration, location_clue | 동상 |
| Clue Distribution (5) | conditional/starting/round/timed_clue, trade_clue | 동상 |

### Out of scope (완전 제외)

| 항목 | 이동 위치 |
|------|----------|
| Playwright E2E | Phase 8.1 (통합 QA) |
| Prometheus 알람 룰 | 운영 phase |
| Multi-node Redis PubSub | Phase 9 또는 별도 |
| LiveKit 상위 안전성 | Phase 8.0.x communication |
| v2→v3 데이터 마이그레이션 | Phase 8.6 |
| WS 양방향 ack | Phase 9 |

---

## 2. 7대 결정 상세

### 결정 1: Scope
**선택**: B — Core 4 + Progression 8 (12 모듈)
- A (reading 1개): 패턴 미검증, 모듈 다양성 ↓
- **B (12)**: "한 게임 e2e 실행" 실서비스 최소 정의 ✅
- C (29 전부): 단일 PR reviewable 불가, 영역 겹침

### 결정 2: Architecture
**선택**: A — 100% Actor 패턴
- **A (actor)**: lock-free, race 원천 차단, design.md 일치 ✅
- B (hybrid): 두 동기화 모델 공존, 결국 A로 감
- C (lock): v2 race 버그 클래스 재현 위험

자세한 actor 이벤트 루프는 `architecture.md` 참조.

### 결정 3: Lifecycle
**선택**: 모든 서브 결정에 안전 옵션
- **Room↔Session**: 1:1 분리 lifecycle ("다시 하기" 자연스러움)
- **시작 트리거**: Host 명시 + 서버 ready 검증
- **종료 트리거**: 명시 + 10분 idle timeout + host abort
- API: `POST /api/v1/rooms/{id}/start`, `POST /api/v1/rooms/{id}/abort`

### 결정 4: WS↔Actor 통신
- **4-1 라우팅**: 모듈별 handler + 공통 `BaseModuleHandler.WithSession` 헬퍼
- **4-2 sync**: Reply 채널 통일 + 2초 타임아웃
- **4-3 broadcast**: 명시적 `GameEventMappings` 테이블 (bridge 파일 제거)
- **4-4 lifecycle**: Hub `SessionLifecycleListener` interface

상세는 `architecture.md` + `data-flow.md`.

### 결정 5: State Persistence
- **Client reconnect**: 짧은 단절(<60s) ReconnectBuffer replay + 긴 단절 snapshot push (하이브리드)
- **Server restart**: 5초 throttle + critical 이벤트(phase 전환, 모듈 init/cleanup, ending) 즉시 write
- **직렬화**: engine state + 모듈 BuildState + 세션 메타 + 타이머 deadline
- **복구**: Lazy — 첫 client reconnect 시점에 Restore

상세는 `persistence.md`.

### 결정 6: 운영 안전성
- **Panic**: 메시지 단 `defer recover()` + 세션당 3회 누적 시 abort
- **Observability**: Prometheus 9종 metric + per-session OTel span + zerolog (trace_id)
- **테스트**: Unit + in-process Integration (Playwright는 Phase 8.1)

상세는 `observability-testing.md`.

### 결정 7: 도입 전략
- **Wave 기반 병렬 PR 실행** (상세 `execution-model.md`)
- **Feature flag**: `MMP_ENGINE_WIRING_ENABLED` default false
- PR 4~8은 default off로 prod 영향 0
- PR 9 후 user 확인 거쳐 dev에서 flag flip → prod는 Phase 8.1
