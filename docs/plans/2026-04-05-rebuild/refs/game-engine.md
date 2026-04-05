# 게임 엔진 상세 — 동적 페이즈 + 모듈 + 이벤트 버스

## 핵심: 고정 FSM이 아닌 configJson.phases 배열 기반 동적 스크립트 러너

## GameProgressionEngine

### 3가지 Strategy (상호 배타적)
```go
type ProgressionStrategy interface {
    Init(ctx, config) error
    CurrentPhase() *PhaseInfo
    Advance(ctx) (hasNext, error)
    SkipTo(ctx, phaseID) error         // GM 오버라이드용
    HandleTrigger(ctx, type, cond) error // Hybrid/Event용
    HandleConsensus(ctx, playerID, action) error
    BuildState() map[string]any
    Cleanup(ctx) error
}
```
- **Script**: phases[] 인덱스 순차 실행
- **Hybrid**: 타이머+트리거+합의 조합
- **Event**: 방향성 그래프 (비선형)

### GM 오버라이드
GM도 엔진 경유 → onExit/onEnter 보장 (TS의 "우회" 문제 해결)
```
GM 이벤트 → engine.GMOverride(phaseID) → onExit → strategy.SkipTo → onEnter
```

### ActionDispatcher (PhaseAction 실행)
- 모듈의 PhaseReactor 인터페이스로 액션 위임
- OCP: 새 PhaseAction → 모듈만 수정, 엔진 무변경

### modules ↔ phases 교차 검증
ActionRequiresModule 테이블: OPEN_VOTING → voting 필요 등
에디터/서버 양쪽 검증.

## 세션별 goroutine (Actor-like)
```
WebSocket → ConnReader → Session channel → Session goroutine
    → Module dispatch / ProgressionEngine / ActionDispatcher
    → DB write / Redis sync / Hub broadcast
        ConnWriter ←
```
이벤트 루프: wsChan | timerChan | gmChan | consensusChan | triggerChan | ctx.Done

## 이벤트 버스
- callback 기반, 세션 스코프 (전역 싱글턴 폐기)
- 상향식: skip:consensus, consensus:reached, trigger:fired, gm:override
- 하향식: PhaseAction → ActionDispatcher → PhaseReactor
- 모듈간: clue.acquired, clue.unlocked, player.joined/disconnected
- 에러 격리, GC 자동 정리

## 에디터 → 서버 → 클라이언트 흐름
```
에디터 → configJson.phases[] / modules / readingSection / bgm
  → PUT /api/editor/themes/:id
서버 → startModularGame() → 전략 선택 → 모듈 초기화 → 엔진 시작
  → enterCurrentPhase() → onEnter → 타이머 → WS broadcast
클라이언트 → phase_changed → Zustand → UI 리렌더
```
